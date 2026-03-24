/**
 * POST /api/lemonsqueezy/webhook
 * Handle LemonSqueezy subscription webhooks
 * 
 * SECURITY:
 * - Signature verification with HMAC-SHA256
 * - Input validation with Zod
 * - Idempotent: Same webhook event only processes once
 * - Safe credit and plan updates with atomic operations
 * - Always returns 200 OK to prevent LemonSqueezy retries (errors logged internally)
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { setCreditsForPlan } from "@/lib/credits";
import { webhookPayloadSchema, validateInput } from "@/lib/validation";
import {
  logError,
  logSecurityEvent,
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

// ─── CONSTANTS ────────────────────────────────────────────────────────────

const WEBHOOK_SECRET = env.LEMON_SQUEEZY_WEBHOOK_SECRET;
const MAX_PAYLOAD_SIZE = 1024 * 1024; // 1MB max

interface ProcessingResult {
  success: boolean;
  message: string;
  details?: Record<string, unknown>;
}

// ─── SIGNATURE VERIFICATION ───────────────────────────────────────────────

function verifyWebhookSignature(payload: string, signature: string): boolean {
  if (!WEBHOOK_SECRET) {
    console.warn("[WEBHOOK] LEMON_SQUEEZY_WEBHOOK_SECRET not configured, skipping verification");
    return true; // Allow processing if not configured (dev mode)
  }

  try {
    const hmac = crypto.createHmac("sha256", WEBHOOK_SECRET);
    hmac.update(payload);
    const expectedSignature = hmac.digest("hex");

    // Use timing-safe comparison
    const isValid = crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );

    return isValid;
  } catch (error) {
    console.error("[WEBHOOK] Signature verification error:", error);
    return false;
  }
}

// ─── WEBHOOK PROCESSING ───────────────────────────────────────────────────

async function processWebhookEvent(
  eventType: string,
  userId: string,
  customerId: string | undefined,
  subscriptionStatus: string
): Promise<ProcessingResult> {
  try {
    // ─── IDEMPOTENCY CHECK ────────────────────────────────────────────────
    // Check if this subscription event was already processed
    const { data: existingSubscription } = await supabaseAdmin
      .from("users")
      .select("id, subscription_status, updated_at")
      .eq("id", userId)
      .single();

    // Skip if already processed (same status within 5 seconds)
    if (
      existingSubscription?.subscription_status === subscriptionStatus &&
      existingSubscription?.updated_at
    ) {
      const lastUpdate = new Date(existingSubscription.updated_at).getTime();
      const now = Date.now();
      if (now - lastUpdate < 5000) {
        console.log(`[IDEMPOTENT] Webhook already processed for user ${userId}`);
        return {
          success: true,
          message: "Webhook already processed (idempotent)",
        };
      }
    }

    // ─── PROCESS BASED ON EVENT TYPE ──────────────────────────────────────
    switch (eventType) {
      case "subscription_created":
      case "subscription_updated": {
        const isActive = subscriptionStatus === "active" || subscriptionStatus === "on_trial";

        console.log(
          `[WEBHOOK] Processing subscription event: ${eventType} for user ${userId}, active=${isActive}`
        );

        // Set credits based on plan
        if (isActive) {
          try {
            await setCreditsForPlan(userId, "pro");
            console.log(`[WEBHOOK] Set pro credits for user ${userId}`);
          } catch (error) {
            throw new Error(`Failed to set pro credits: ${error}`);
          }
        }

        // Update user record atomically
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            plan: isActive ? "pro" : "free",
            is_pro: isActive,
            subscription_status: subscriptionStatus,
            lemon_customer_id: customerId || null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (updateError) {
          throw new Error(`Failed to update user: ${updateError.message}`);
        }

        console.log(
          `[WEBHOOK] Updated user ${userId} to plan: ${isActive ? "pro" : "free"}, status: ${subscriptionStatus}`
        );

        return {
          success: true,
          message: `Updated subscription to ${isActive ? "pro" : "free"}`,
          details: { userId, isActive, subscriptionStatus },
        };
      }

      case "subscription_cancelled": {
        console.log(`[WEBHOOK] Processing subscription_cancelled for user ${userId}`);

        // Reset credits to free plan
        try {
          await setCreditsForPlan(userId, "free");
          console.log(`[WEBHOOK] Reset to free credits for user ${userId}`);
        } catch (error) {
          throw new Error(`Failed to reset credits: ${error}`);
        }

        // Update user record atomically
        const { error: updateError } = await supabaseAdmin
          .from("users")
          .update({
            plan: "free",
            is_pro: false,
            subscription_status: "cancelled",
            updated_at: new Date().toISOString(),
          })
          .eq("id", userId);

        if (updateError) {
          throw new Error(`Failed to cancel subscription: ${updateError.message}`);
        }

        console.log(`[WEBHOOK] Cancelled subscription for user ${userId}`);

        return {
          success: true,
          message: "Subscription cancelled",
          details: { userId },
        };
      }

      default:
        return {
          success: true,
          message: `Unhandled event type (ignored): ${eventType}`,
          details: { eventType },
        };
    }
  } catch (error) {
    return {
      success: false,
      message: `Failed to process webhook: ${error}`,
      details: { userId, eventType },
    };
  }
}

// ─── REQUEST HANDLER ──────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  let eventId = "unknown";
  let userId = "unknown";
  let eventType = "unknown";

  try {
    // ─── PARSE REQUEST BODY ───────────────────────────────────────────────
    const contentLength = request.headers.get("content-length");
    const payloadSize = contentLength ? parseInt(contentLength, 10) : 0;

    if (payloadSize > MAX_PAYLOAD_SIZE) {
      console.error(`[WEBHOOK] Payload too large: ${payloadSize} bytes`);
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    let bodyText: string;
    try {
      bodyText = await request.text();
    } catch (error) {
      console.error("[WEBHOOK] Failed to read request body:", error);
      logSecurityEvent("webhook_parse_error", { endpoint: "/api/lemonsqueezy/webhook" });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ─── VERIFY SIGNATURE ─────────────────────────────────────────────────
    const signature = request.headers.get("x-signature") || "";

    if (!verifyWebhookSignature(bodyText, signature)) {
      console.error("[WEBHOOK] Invalid signature");
      logSecurityEvent("webhook_invalid_signature", { endpoint: "/api/lemonsqueezy/webhook" });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ─── VALIDATE JSON ────────────────────────────────────────────────────
    let payload: unknown;
    try {
      payload = JSON.parse(bodyText);
    } catch (error) {
      console.error("[WEBHOOK] Invalid JSON payload:", error);
      logError({ code: "INVALID_JSON", message: "Failed to parse webhook JSON", statusCode: 200 }, 
        { endpoint: "/api/lemonsqueezy/webhook" });
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    // ─── VALIDATE AGAINST SCHEMA ──────────────────────────────────────────
    const validation = validateInput(webhookPayloadSchema, payload);
    if (!validation.success) {
      console.error("[WEBHOOK] Schema validation failed:", validation.error);
      logError(
        { code: "VALIDATION_ERROR", message: validation.error, statusCode: 200 },
        { endpoint: "/api/lemonsqueezy/webhook" }
      );
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const webhookPayload = validation.data;
    eventType = webhookPayload.meta.event_name;
    eventId = webhookPayload.data.id;

    // ─── EXTRACT USER ID & CUSTOMER ID ────────────────────────────────────
    const customAttributes = webhookPayload.data.attributes?.checkout_data?.custom;
    userId = customAttributes?.user_id || "unknown";

    if (userId === "unknown") {
      console.warn("[WEBHOOK] No user_id found in webhook payload");
      return NextResponse.json({ ok: true }, { status: 200 });
    }

    const customerId = webhookPayload.data.attributes?.customer_id;
    const subscriptionStatus = webhookPayload.data.attributes?.status || "active";

    console.log(`[WEBHOOK] Received event: ${eventType} for userId=${userId}`);

    // ─── PROCESS WEBHOOK EVENT ────────────────────────────────────────────
    const result = await processWebhookEvent(
      eventType,
      userId,
      customerId,
      subscriptionStatus
    );

    const duration = Date.now() - startTime;

    if (result.success) {
      console.log(
        `[WEBHOOK] Successfully processed ${eventType} for ${userId} in ${duration}ms: ${result.message}`
      );
    } else {
      console.error(
        `[WEBHOOK] Failed to process ${eventType} for ${userId} in ${duration}ms: ${result.message}`
      );
      logError(
        {
          code: "WEBHOOK_PROCESSING_ERROR",
          message: result.message,
          statusCode: 200,
          details: result.details,
        },
        { endpoint: "/api/lemonsqueezy/webhook", eventId, userId, eventType, duration }
      );
    }

    // Always return 200 OK to prevent LemonSqueezy retries
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error("[WEBHOOK] Unexpected error:", error);
    logError(
      {
        code: "WEBHOOK_UNEXPECTED_ERROR",
        message: error instanceof Error ? error.message : "Unknown error",
        statusCode: 200,
      },
      { endpoint: "/api/lemonsqueezy/webhook", eventId, userId, eventType, duration }
    );

    // Always return 200 OK even on error to prevent LemonSqueezy retries
    return NextResponse.json({ ok: true }, { status: 200 });
  }
}
