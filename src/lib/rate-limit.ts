/**
 * Rate limiting utility
 * Implements both IP-based and user-based rate limiting
 * Uses in-memory store with automatic cleanup
 * 
 * For production at scale, use Redis instead
 */

import { NextRequest, NextResponse } from 'next/server';

// ─── TYPES ────────────────────────────────────────────────────────────────

interface RateLimit {
  windowStart: number;
  count: number;
}

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number; // milliseconds
}

// ─── GLOBAL STATE ─────────────────────────────────────────────────────────
// In production, use Redis instead of in-memory storage

const ipRateLimits = new Map<string, RateLimit>();
const userRateLimits = new Map<string, RateLimit>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  const staleThreshold = 1000 * 60 * 60; // 1 hour

  // Clean IP limits
  Array.from(ipRateLimits.entries()).forEach(([key, value]) => {
    if (now - value.windowStart > staleThreshold) {
      ipRateLimits.delete(key);
    }
  });

  // Clean user limits
  Array.from(userRateLimits.entries()).forEach(([key, value]) => {
    if (now - value.windowStart > staleThreshold) {
      userRateLimits.delete(key);
    }
  });
}, 5 * 60 * 1000);

// ─── HELPERS ──────────────────────────────────────────────────────────────

/**
 * Extract client IP from request
 * Respects X-Forwarded-For header for proxied requests
 */
export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  return req.headers.get('x-real-ip') || 'unknown';
}

/**
 * Check if request exceeds rate limit
 * Returns true if rate limit exceeded, false otherwise
 */
function checkRateLimit(
  key: string,
  store: Map<string, RateLimit>,
  config: RateLimitConfig
): boolean {
  const now = Date.now();
  const limit = store.get(key);

  if (!limit) {
    // First request in window
    store.set(key, { windowStart: now, count: 1 });
    return false;
  }

  // Check if window has expired
  if (now - limit.windowStart > config.windowMs) {
    // Reset window
    store.set(key, { windowStart: now, count: 1 });
    return false;
  }

  // Increment counter
  limit.count++;

  // Check if exceeded
  return limit.count > config.maxRequests;
}

// ─── RATE LIMIT PRESETS ───────────────────────────────────────────────────

export const RATE_LIMITS = {
  // AI generation endpoints (heavy operations)
  GENERATE: { maxRequests: 10, windowMs: 60 * 1000 } as RateLimitConfig,
  REGENERATE: { maxRequests: 15, windowMs: 60 * 1000 } as RateLimitConfig,

  // Auth endpoints
  AUTH: { maxRequests: 5, windowMs: 60 * 1000 } as RateLimitConfig,

  // Checkout (typically low volume)
  CHECKOUT: { maxRequests: 5, windowMs: 60 * 1000 } as RateLimitConfig,

  // Referral system
  REFERRAL: { maxRequests: 10, windowMs: 60 * 1000 } as RateLimitConfig,

  // General API
  API: { maxRequests: 30, windowMs: 60 * 1000 } as RateLimitConfig,
} as const;

// ─── MIDDLEWARE ───────────────────────────────────────────────────────────

/**
 * Apply rate limiting to a request
 * Checks both IP-based and user-based limits
 * 
 * @param req - Next.js request object
 * @param userId - Optional user ID for user-level limiting
 * @param config - Rate limit configuration
 * @returns null if allowed, NextResponse with 429 if rate limited
 */
export async function applyRateLimit(
  req: NextRequest,
  userId: string | null,
  config: RateLimitConfig
): Promise<{ allowed: boolean; response?: NextResponse }> {
  const ip = getClientIp(req);

  // Check IP-based rate limit
  if (checkRateLimit(ip, ipRateLimits, config)) {
    return {
      allowed: false,
      response: NextResponse.json(
        {
          error: 'Too many requests from your IP address',
          retryAfter: Math.ceil(config.windowMs / 1000),
        },
        {
          status: 429,
          headers: {
            'Retry-After': Math.ceil(config.windowMs / 1000).toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Window': `${config.windowMs}ms`,
          },
        }
      ),
    };
  }

  // If authenticated, check user-based rate limit
  if (userId) {
    // Use separate config for authenticated users (usually stricter)
    const userConfig: RateLimitConfig = {
      maxRequests: Math.ceil(config.maxRequests * 1.5), // More lenient than IP limit
      windowMs: config.windowMs,
    };

    if (checkRateLimit(`user:${userId}`, userRateLimits, userConfig)) {
      return {
        allowed: false,
        response: NextResponse.json(
          {
            error: 'You have exceeded the rate limit for this endpoint',
            retryAfter: Math.ceil(userConfig.windowMs / 1000),
          },
          {
            status: 429,
            headers: {
              'Retry-After': Math.ceil(userConfig.windowMs / 1000).toString(),
              'X-RateLimit-Limit': userConfig.maxRequests.toString(),
              'X-RateLimit-Window': `${userConfig.windowMs}ms`,
            },
          }
        ),
      };
    }
  }

  return { allowed: true };
}

/**
 * Middleware decorator for Next.js API routes
 * Wraps route handler with rate limiting
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<Response>,
  config: RateLimitConfig,
  getUserId?: (req: NextRequest) => string | null | Promise<string | null>
) {
  return async (req: NextRequest) => {
    const userId = getUserId ? await Promise.resolve(getUserId(req)) : null;
    const { allowed, response } = await applyRateLimit(req, userId, config);

    if (!allowed) {
      return response;
    }

    return handler(req);
  };
}
