/**
 * POST /api/lemonsqueezy/checkout
 * Create a LemonSqueezy checkout session
 * 
 * SECURITY:
 * - Rate limited (5 requests/minute per IP + user)
 * - Auth required (Bearer token)
 * - User verification and validation
 * - Safe LemonSqueezy API calls
 * - Prevents duplicate checkouts (already Pro)
 */

import { createCheckoutSession } from "@/lib/lemonsqueezy";
import { createClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
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

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIp(request);
  let userId: string | null = null;

  try {
    // ─── AUTHENTICATION & RATE LIMITING ───────────────────────────────────
    const authHeader = request.headers.get("authorization");
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null;

    if (!token) {
      const error = unauthorizedError("Authentication required");
      logSecurityEvent("missing_auth", { endpoint: "/api/lemonsqueezy/checkout", ip });
      return errorResponse(error);
    }

    try {
      const { data } = await supabaseAdmin.auth.getUser(token);
      if (!data.user?.id) {
        const error = unauthorizedError("Invalid authentication token");
        logSecurityEvent("invalid_token", { endpoint: "/api/lemonsqueezy/checkout", ip });
        return errorResponse(error);
      }
      userId = data.user.id;
    } catch (error) {
      const apiError = unauthorizedError("Authentication failed");
      logSecurityEvent("auth_error", { endpoint: "/api/lemonsqueezy/checkout", ip });
      return errorResponse(apiError);
    }

    // Apply rate limiting
    const rateLimitCheck = await applyRateLimit(request, userId, RATE_LIMITS.CHECKOUT);
    if (rateLimitCheck.response) {
      logSecurityEvent("rate_limit_exceeded", { endpoint: "/api/lemonsqueezy/checkout", ip, userId });
      return rateLimitCheck.response;
    }

    // ─── FETCH USER RECORD ────────────────────────────────────────────────
    let userData: { id: string; email?: string; plan?: string } | null = null;

    try {
      const { data, error: userFetchError } = await supabaseAdmin
        .from("users")
        .select("id, email, plan")
        .eq("id", userId)
        .single();

      if (userFetchError || !data) {
        const error = validationError("User record not found");
        logError(error, { endpoint: "/api/lemonsqueezy/checkout", userId, ip });
        return errorResponse(error);
      }

      userData = data;
    } catch (error) {
      const apiError = internalError("Failed to fetch user data");
      logError(apiError, { endpoint: "/api/lemonsqueezy/checkout", userId, ip });
      return errorResponse(apiError);
    }

    // ─── PREVENT DUPLICATE UPGRADES ───────────────────────────────────────
    if (userData?.plan === "pro") {
      const error = validationError("Already subscribed to Pro plan");
      logError(error, { endpoint: "/api/lemonsqueezy/checkout", userId, ip });
      return errorResponse(error);
    }

    // ─── VALIDATE EMAIL ───────────────────────────────────────────────────
    const email = userData?.email;

    if (!email || !email.includes("@")) {
      const error = validationError("Valid email required for checkout");
      logError(error, { endpoint: "/api/lemonsqueezy/checkout", userId, ip });
      return errorResponse(error);
    }

    // ─── BUILD REDIRECT URLS ──────────────────────────────────────────────
    const appUrl = "http://localhost:3000";

    // ─── CREATE CHECKOUT SESSION ──────────────────────────────────────────
    let checkoutUrl: string | null = null;

    try {
      checkoutUrl = await createCheckoutSession(email, userId);

      if (!checkoutUrl) {
        throw new Error("No checkout URL returned from LemonSqueezy");
      }
    } catch (error) {
      const apiError = internalError(error instanceof Error ? error.message : "Failed to create checkout session");
      logError(apiError, { endpoint: "/api/lemonsqueezy/checkout", userId, ip });
      return errorResponse(apiError);
    }

    // ─── SUCCESS RESPONSE ─────────────────────────────────────────────────
    const duration = Date.now() - startTime;
    console.log(`[SUCCESS] /api/lemonsqueezy/checkout user=${userId} duration=${duration}ms`);

    return successResponse({
      checkout_url: checkoutUrl,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const apiError = toApiError(error, "An unexpected error occurred");
    logError(apiError, { endpoint: "/api/lemonsqueezy/checkout", userId: userId || undefined, ip, duration });
    return errorResponse(apiError);
  }
}