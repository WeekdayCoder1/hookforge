/**
 * Input validation schemas using Zod
 * Ensures all API inputs are properly typed and sanitized
 */

import { z } from 'zod';

// ─── SHARED SCHEMAS ───────────────────────────────────────────────────────

/**
 * Platform validation
 * Supports: YouTube, Instagram, TikTok, Twitter/X, LinkedIn
 */
export const platformSchema = z.enum(
  ['Youtube', 'Instagram', 'TikTok', 'Twitter', 'X', 'LinkedIn'],
  {
    errorMap: () => ({
      message: 'Invalid platform. Supported: Youtube, Instagram, TikTok, Twitter, X, LinkedIn'
    })
  }
);

/**
 * Topic validation
 * - Required
 * - Max 200 characters to prevent abuse
 * - Must be non-empty string
 */
export const topicSchema = z
  .string()
  .min(1, 'Topic is required')
  .max(200, 'Topic must not exceed 200 characters')
  .trim();

/**
 * Niche validation
 */
export const nicheSchema = z
  .string()
  .min(1, 'Niche is required')
  .max(100, 'Niche must not exceed 100 characters')
  .optional()
  .default('Motivation');

/**
 * Tone validation
 */
export const toneSchema = z
  .string()
  .min(1, 'Tone is required')
  .max(100, 'Tone must not exceed 100 characters')
  .optional()
  .default('Bold');

// ─── API REQUEST SCHEMAS ──────────────────────────────────────────────────

/**
 * /api/generate request validation
 */
export const generateRequestSchema = z.object({
  topic: topicSchema,
  platform: platformSchema,
  niche: nicheSchema,
  tone: toneSchema,
}).strict(); // Reject unexpected fields

/**
 * /api/regenerate request validation
 */
export const regenerateRequestSchema = z.object({
  topic: topicSchema,
  platform: platformSchema,
  niche: nicheSchema,
  tone: toneSchema,
}).strict();

/**
 * /api/referral request validation
 */
export const referralRequestSchema = z.object({
  referrerId: z.string().uuid('Invalid referrer ID format'),
  newUserId: z.string().uuid('Invalid new user ID format'),
}).strict();

/**
 * /api/lemonsqueezy/webhook payload validation
 */
export const webhookPayloadSchema = z.object({
  meta: z.object({
    event_name: z.string(),
  }),
  data: z.object({
    id: z.string(),
    type: z.string(),
    attributes: z.object({
      status: z.string().optional(),
      customer_id: z.string().optional(),
      checkout_data: z.object({
        custom: z.object({
          user_id: z.string().optional(),
        }).optional(),
      }).optional(),
    }).passthrough(), // Allow additional fields in attributes
    relationships: z.object({
      customer: z.object({
        data: z.object({
          id: z.string(),
        }).optional(),
      }).optional(),
    }).optional(),
  }),
}).passthrough(); // Allow additional root fields

// ─── TYPE EXPORTS ─────────────────────────────────────────────────────────

export type GenerateRequest = z.infer<typeof generateRequestSchema>;
export type RegenerateRequest = z.infer<typeof regenerateRequestSchema>;
export type ReferralRequest = z.infer<typeof referralRequestSchema>;
export type WebhookPayload = z.infer<typeof webhookPayloadSchema>;

// ─── VALIDATION HELPER ────────────────────────────────────────────────────

/**
 * Safe validation helper
 * Returns validated data or error object
 */
export function validateInput<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const fieldErrors = (error as z.ZodError).errors
        .map((e) => `${e.path.join('.')}: ${e.message}`)
        .join('; ');
      return {
        success: false,
        error: fieldErrors || 'Validation failed'
      };
    }
    return {
      success: false,
      error: 'Validation failed'
    };
  }
}
