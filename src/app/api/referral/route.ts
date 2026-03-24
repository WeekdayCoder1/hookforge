/**
 * POST /api/referral
 * Process a referral and award credits to the referrer
 * 
 * SECURITY:
 * - Rate limited (10 requests/minute per IP + user)
 * - Input validation with Zod (UUID format validation)
 * - Auth required (Bearer token)
 * - Self-referral prevention
 * - Idempotent: Same referral only awards once
 * - Safe credit addition with atomic operations
 */

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { addCredits } from "@/lib/credits";
import { referralRequestSchema, validateInput } from "@/lib/validation";
import { applyRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import {
  errorResponse,
  successResponse,
  unauthorizedError,
  validationError,
  internalError,
  logError,
  logSecurityEvent,
  toApiError,
} from "@/lib/error";
import { getEnv } from "@/lib/env";

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const REFERRAL_REWARD = 20; // credits awarded to referrer

// UUID v4 regex for validation
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── INITIALIZATION ───────────────────────────────────────────────────────

const env = getEnv();

const supabaseAdmin = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  }
);

// ─── REQUEST HANDLER ──────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(req);
  let userId: string | null = null;

  try {
    // ─── AUTHENTICATION & RATE LIMITING ───────────────────────────────────
    const authHeader = req.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (!token) {
      const error = unauthorizedError("Authentication required");
      logSecurityEvent("missing_auth", { endpoint: "/api/referral", ip });
      return errorResponse(error);
    }

    try {
      const { data } = await supabaseAdmin.auth.getUser(token);
      if (!data.user?.id) {
        const error = unauthorizedError("Invalid authentication token");
        logSecurityEvent("invalid_token", { endpoint: "/api/referral", ip });
        return errorResponse(error);
      }
      userId = data.user.id;
    } catch (error) {
      const apiError = unauthorizedError("Authentication failed");
      logSecurityEvent("auth_error", { endpoint: "/api/referral", ip });
      return errorResponse(apiError);
    }

    // Apply rate limiting
    const rateLimitCheck = await applyRateLimit(req, userId, RATE_LIMITS.REFERRAL);
    if (rateLimitCheck.response) {
      logSecurityEvent("rate_limit_exceeded", { endpoint: "/api/referral", ip, userId });
      return rateLimitCheck.response;
    }

    // ─── INPUT VALIDATION ─────────────────────────────────────────────────
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      const error = validationError("Invalid JSON in request body");
      logError(error, { endpoint: "/api/referral", userId, ip });
      return errorResponse(error);
    }

    const validation = validateInput(referralRequestSchema, requestBody);
    if (!validation.success) {
      const error = validationError(`Validation failed: ${validation.error}`);
      logError(error, { endpoint: "/api/referral", userId, ip });
      return errorResponse(error);
    }

    const { referrerId, newUserId } = validation.data;

    // ─── ADDITIONAL BUSINESS LOGIC VALIDATION ─────────────────────────────

    // Validate UUID format
    if (!UUID_REGEX.test(referrerId)) {
      const error = validationError("referrerId must be a valid UUID");
      logError(error, { endpoint: "/api/referral", userId, ip });
      return errorResponse(error);
    }

    if (!UUID_REGEX.test(newUserId)) {
      const error = validationError("newUserId must be a valid UUID");
      logError(error, { endpoint: "/api/referral", userId, ip });
      return errorResponse(error);
    }

    // Prevent self-referral
    if (referrerId === newUserId) {
      const error = validationError("Cannot refer yourself");
      logError(error, { endpoint: "/api/referral", userId, ip });
      return errorResponse(error);
    }

    // Verify authenticated user matches newUserId
    if (userId !== newUserId) {
      const error = unauthorizedError("Can only process referrals for your own account");
      logSecurityEvent("user_mismatch", {
        endpoint: "/api/referral",
        authenticatedUser: userId,
        requestedUser: newUserId,
        ip,
      });
      return errorResponse(error);
    }

    // ─── IDEMPOTENCY CHECK ────────────────────────────────────────────────
    try {
      const { data: existingReferral } = await supabaseAdmin
        .from("referrals")
        .select("id, created_at")
        .eq("referrer_id", referrerId)
        .eq("referred_user_id", newUserId)
        .single();

      if (existingReferral) {
        // Already processed — return success without re-awarding
        console.log(`[IDEMPOTENT] Referral already exists for ${referrerId} → ${newUserId}`);
        return successResponse({
          ok: true,
          already_processed: true,
          credits_awarded: 0,
        });
      }
    } catch (error) {
      // No existing record is expected, continue
    }

    // ─── VERIFY REFERRER EXISTS ───────────────────────────────────────────
    try {
      const { data: referrer, error: referrerError } = await supabaseAdmin
        .from("users")
        .select("id")
        .eq("id", referrerId)
        .single();

      if (referrerError || !referrer) {
        const error = validationError("Referrer not found");
        logError(error, { endpoint: "/api/referral", userId, ip, referrerId });
        return errorResponse(error);
      }
    } catch (error) {
      const apiError = internalError("Failed to verify referrer");
      logError(apiError, { endpoint: "/api/referral", userId, ip });
      return errorResponse(apiError);
    }

    // ─── CREATE REFERRAL RECORD ───────────────────────────────────────────
    try {
      await supabaseAdmin.from("referrals").insert({
        referrer_id: referrerId,
        referred_user_id: newUserId,
        credits_awarded: true,
        created_at: new Date().toISOString(),
      });
    } catch (error) {
      const apiError = internalError("Failed to create referral record");
      logError(apiError, { endpoint: "/api/referral", userId, ip });
      return errorResponse(apiError);
    }

    // ─── AWARD CREDITS ────────────────────────────────────────────────────
    try {
      await addCredits(referrerId, REFERRAL_REWARD);
    } catch (error) {
      const apiError = internalError("Failed to award referral credits");
      logError(apiError, { endpoint: "/api/referral", userId, ip, referrerId });
      return errorResponse(apiError);
    }

    // ─── SUCCESS RESPONSE ─────────────────────────────────────────────────
    const duration = Date.now() - startTime;
    console.log(
      `[SUCCESS] /api/referral user=${userId} referrer=${referrerId} reward=${REFERRAL_REWARD} duration=${duration}ms`
    );

    return successResponse({
      ok: true,
      credits_awarded: REFERRAL_REWARD,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const apiError = toApiError(error, "An unexpected error occurred");
    logError(apiError, { endpoint: "/api/referral", userId, ip, duration });
    return errorResponse(apiError);
  }
}
