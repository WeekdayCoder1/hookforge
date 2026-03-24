/**
 * Standardized error handling and response utilities
 * Ensures consistent error formats and proper logging
 */

import { NextResponse } from 'next/server';

// ─── TYPES ────────────────────────────────────────────────────────────────

export interface ApiError {
  code: string;
  message: string;
  statusCode: number;
  details?: unknown;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// ─── ERROR CODES ──────────────────────────────────────────────────────────

export const ERROR_CODES = {
  // Auth errors
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',

  // Validation errors
  INVALID_INPUT: 'INVALID_INPUT',
  MISSING_FIELD: 'MISSING_FIELD',
  INVALID_FORMAT: 'INVALID_FORMAT',

  // Resource errors
  NOT_FOUND: 'NOT_FOUND',
  ALREADY_EXISTS: 'ALREADY_EXISTS',
  CONFLICT: 'CONFLICT',

  // Business logic errors
  INSUFFICIENT_CREDITS: 'INSUFFICIENT_CREDITS',
  INVALID_CREDITS: 'INVALID_CREDITS',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',

  // Server errors
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
  THIRD_PARTY_ERROR: 'THIRD_PARTY_ERROR',

  // Rate limiting
  RATE_LIMITED: 'RATE_LIMITED',
} as const;

// ─── ERROR CREATORS ───────────────────────────────────────────────────────

/**
 * Create a standardized API error
 */
export function createError(
  code: string,
  message: string,
  statusCode: number = 500,
  details?: unknown
): ApiError {
  return {
    code,
    message,
    statusCode,
    details,
  };
}

/**
 * Unauthorized error (401)
 */
export function unauthorizedError(message = 'Unauthorized'): ApiError {
  return createError(ERROR_CODES.UNAUTHORIZED, message, 401);
}

/**
 * Forbidden error (403)
 */
export function forbiddenError(message = 'Forbidden'): ApiError {
  return createError(ERROR_CODES.FORBIDDEN, message, 403);
}

/**
 * Not found error (404)
 */
export function notFoundError(resource = 'Resource'): ApiError {
  return createError(ERROR_CODES.NOT_FOUND, `${resource} not found`, 404);
}

/**
 * Validation error (400)
 */
export function validationError(message: string, details?: unknown): ApiError {
  return createError(ERROR_CODES.INVALID_INPUT, message, 400, details);
}

/**
 * Insufficient credits error (403)
 */
export function insufficientCreditsError(creditsNeeded: number, creditsAvailable: number): ApiError {
  return createError(
    ERROR_CODES.INSUFFICIENT_CREDITS,
    `You need ${creditsNeeded} credits but only have ${creditsAvailable}`,
    403,
    { creditsNeeded, creditsAvailable }
  );
}

/**
 * Rate limit error (429)
 */
export function rateLimitError(retryAfter: number): ApiError {
  return createError(
    ERROR_CODES.RATE_LIMITED,
    'Too many requests. Please try again later.',
    429,
    { retryAfter }
  );
}

/**
 * Internal server error (500)
 */
export function internalError(message = 'Internal server error', details?: unknown): ApiError {
  return createError(ERROR_CODES.INTERNAL_ERROR, message, 500, details);
}

// ─── RESPONSE HELPERS ─────────────────────────────────────────────────────

/**
 * Create a success response
 */
export function successResponse<T>(data: T, statusCode = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status: statusCode }
  );
}

/**
 * Create an error response
 */
export function errorResponse(error: ApiError): NextResponse<ApiResponse> {
  const headers: Record<string, string> = {};

  // Add retry-after header for rate limit errors
  if (
    error.code === ERROR_CODES.RATE_LIMITED &&
    typeof error.details === 'object' &&
    error.details !== null &&
    'retryAfter' in error.details
  ) {
    const retryAfter = (error.details as { retryAfter?: number }).retryAfter;
    if (typeof retryAfter === 'number') {
      headers['Retry-After'] = retryAfter.toString();
    }
  }

  const responseBody: ApiResponse = {
    success: false,
    error: {
      code: error.code,
      message: error.message,
    },
  };

  // Only include details if it's a non-empty object
  if (error.details && typeof error.details === 'object' && Object.keys(error.details as Record<string, any>).length > 0) {
    responseBody.error!.details = error.details;
  }

  return NextResponse.json(responseBody, {
    status: error.statusCode,
    headers,
  });
}

// ─── LOGGING ──────────────────────────────────────────────────────────────

interface LogContext {
  endpoint: string;
  userId?: string | null;
  ip?: string;
  timestamp?: string;
  duration?: number;
  eventId?: string;
  eventType?: string;
}

/**
 * Log API error (safe - no secrets)
 */
export function logError(error: ApiError, context: LogContext): void {
  const log = {
    type: 'API_ERROR',
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    context,
    timestamp: new Date().toISOString(),
  };

  // In production, send to error tracking service (Sentry, etc.)
  console.error('[API Error]', JSON.stringify(log, null, 2));
}

/**
 * Log successful API call
 */
export function logSuccess(context: LogContext & { dataSize?: number }): void {
  const log = {
    type: 'API_SUCCESS',
    context,
    timestamp: new Date().toISOString(),
  };

  // In production, send to analytics service
  console.log('[API Success]', JSON.stringify(log, null, 2));
}

/**
 * Log security event
 */
export function logSecurityEvent(event: string, context: LogContext & { details?: unknown }): void {
  const log = {
    type: 'SECURITY_EVENT',
    event,
    context,
    timestamp: new Date().toISOString(),
  };

  // ALWAYS log security events
  console.warn('[SECURITY]', JSON.stringify(log, null, 2));
}

// ─── SAFE ERROR CONVERSION ────────────────────────────────────────────────

/**
 * Convert unknown error to ApiError
 * Prevents accidental secret leakage in error messages
 */
export function toApiError(error: unknown, defaultMessage = 'An error occurred'): ApiError {
  if (error instanceof Error) {
    // Only include specific error messages we control
    // Never include raw error.message which might contain secrets
    if (error.message.includes('user') || error.message.includes('database')) {
      return internalError('Database error occurred');
    }
    if (error.message.includes('auth')) {
      return unauthorizedError('Authentication failed');
    }
    return internalError(defaultMessage);
  }

  return internalError(defaultMessage);
}
