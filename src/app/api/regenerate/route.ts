/**
 * POST /api/regenerate
 * Regenerate different AI hooks for the same topic
 *
 * SECURITY:
 * - Rate limited (15 requests/minute per IP + user)
 * - Input validation with Zod
 * - Auth required (Bearer token)
 * - Server-side credit checks
 * - Safe credit deduction with atomic operations
 */

import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { CREDIT_COSTS, checkAndResetCredits, deductCredits } from "@/lib/credits";
import { regenerateRequestSchema, validateInput } from "@/lib/validation";
import { applyRateLimit, RATE_LIMITS, getClientIp } from "@/lib/rate-limit";
import {
  errorResponse,
  successResponse,
  insufficientCreditsError,
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
      logSecurityEvent("missing_auth", { endpoint: "/api/regenerate", ip });
      return errorResponse(error);
    }

    try {
      const { data } = await supabaseAdmin.auth.getUser(token);
      if (!data.user?.id) {
        const error = unauthorizedError("Invalid authentication token");
        logSecurityEvent("invalid_token", { endpoint: "/api/regenerate", ip });
        return errorResponse(error);
      }
      userId = data.user.id;
    } catch (error) {
      const apiError = unauthorizedError("Authentication failed");
      logSecurityEvent("auth_error", { endpoint: "/api/regenerate", ip });
      return errorResponse(apiError);
    }

    // Apply rate limiting
    const rateLimitCheck = await applyRateLimit(req, userId, RATE_LIMITS.REGENERATE);
    if (rateLimitCheck.response) {
      logSecurityEvent("rate_limit_exceeded", { endpoint: "/api/regenerate", ip, userId });
      return rateLimitCheck.response;
    }

    // ─── INPUT VALIDATION ─────────────────────────────────────────────────
    let requestBody: unknown;
    try {
      requestBody = await req.json();
    } catch {
      const error = validationError("Invalid JSON in request body");
      logError(error, { endpoint: "/api/regenerate", userId, ip });
      return errorResponse(error);
    }

    const validation = validateInput(regenerateRequestSchema, requestBody);
    if (!validation.success) {
      const error = validationError(`Validation failed: ${validation.error}`);
      logError(error, { endpoint: "/api/regenerate", userId, ip });
      return errorResponse(error);
    }

    const { topic, platform, niche, tone } = validation.data;

    // ─── CREDIT CHECK ─────────────────────────────────────────────────────
    const requiredCredits = CREDIT_COSTS.regenerate; // 1 credit
    let userCredits = 0;

    try {
      const userWithCredits = await checkAndResetCredits(userId);
      userCredits = userWithCredits.credits_remaining;

      if (userCredits < requiredCredits) {
        const error = insufficientCreditsError(requiredCredits, userCredits);
        logError(error, { endpoint: "/api/regenerate", userId, ip });
        return errorResponse(error);
      }
    } catch (error) {
      const apiError = internalError("Failed to check credits");
      logError(apiError, { endpoint: "/api/regenerate", userId, ip });
      return errorResponse(apiError);
    }

    // ─── AI GENERATION (WITH VARIATION) ───────────────────────────────────
    const platformKey = platform.toLowerCase();
    const platformInstructions: Record<string, string> = {
      youtube: "Style: Strong curiosity gap. Bold, high-retention claims. Fast-paced energy. Optimised for YouTube Shorts.",
      instagram: "Style: Relatable and emotion-driven. Scroll-stopping. Punchy and personal. Optimised for Instagram Reels.",
      tiktok: "Style: Casual and conversational. Slightly provocative. Trend-aware and raw. Optimised for TikTok.",
      twitter: "Style: Sharp and opinionated. Under 15 words. Big claim up front. Optimised for Twitter/X.",
      x: "Style: Sharp and opinionated. Under 15 words. Big claim up front. Optimised for Twitter/X.",
      linkedin: "Style: Professional and insightful. Authority-building. Data or lesson-driven. Optimised for LinkedIn.",
    };

    const platformInstruction =
      platformInstructions[platformKey] ||
      "Style: High curiosity, bold, and scroll-stopping for any platform.";

    const prompt = `You are a viral short-form content strategist.
Generate 5 completely NEW and DIFFERENT scroll-stopping hooks about "${topic}".
Niche: ${niche}
Tone: ${tone}
${platformInstruction}
Rules: Maximum 12 words per hook. Pattern interrupt style. No emojis. No generic phrases. Make them feel dangerous, controversial or irresistible. These MUST be DIFFERENT from previous hooks.
Return only hooks separated by new lines. No numbering, no explanations.`;

    let hooks: string[] = [];
    try {
      const aiResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-3.5-turbo",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.95,
        }),
      });

      if (!aiResponse.ok) {
        throw new Error(`OpenRouter API error: ${aiResponse.status}`);
      }

      const aiData = await aiResponse.json();
      const text = aiData.choices?.[0]?.message?.content || "";

      hooks = text
        .split("\n")
        .map((line: string) => line.replace(/^\d+[\.)\-]\s*/, "").trim())
        .filter((line: string) => line.length > 0)
        .slice(0, 5);

      if (hooks.length === 0) {
        throw new Error("AI returned empty hooks");
      }
    } catch (error) {
      const apiError = internalError("Failed to regenerate hooks. Please try again.");
      logError(apiError, { endpoint: "/api/regenerate", userId, ip });
      return errorResponse(apiError);
    }

    // ─── CREDIT DEDUCTION ─────────────────────────────────────────────────
    let newCredits = userCredits;
    try {
      newCredits = await deductCredits(userId, requiredCredits);
    } catch (error) {
      const apiError = internalError("Failed to process transaction. Regeneration cancelled.");
      logError(apiError, { endpoint: "/api/regenerate", userId, ip });
      return errorResponse(apiError);
    }

    // ─── SAVE TO HISTORY (NON-CRITICAL) ──────────────────────────────────
    try {
      await supabaseAdmin
        .from("generated_hooks")
        .insert({
          user_id: userId,
          topic,
          platform,
          hooks: JSON.stringify(hooks),
          created_at: new Date().toISOString(),
        })
        .select();
    } catch {
      try {
        await supabaseAdmin.from("hook_history").insert({
          user_id: userId,
          topic,
          platform,
          hooks: hooks.join("\n"),
          created_at: new Date().toISOString(),
        });
      } catch {
        console.warn(`[HISTORY] Failed to save regenerate for user ${userId}`);
      }
    }

    // ─── SUCCESS RESPONSE ─────────────────────────────────────────────────
    const duration = Date.now() - startTime;
    console.log(
      `[SUCCESS] /api/regenerate user=${userId} duration=${duration}ms credits=${newCredits}`
    );

    return successResponse({
      hooks,
      credits_remaining: newCredits,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    const apiError = toApiError(error, "An unexpected error occurred");
    logError(apiError, { endpoint: "/api/regenerate", userId, ip, duration });
    return errorResponse(apiError);
  }
}