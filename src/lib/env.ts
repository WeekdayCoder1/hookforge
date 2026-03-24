/**
 * Environment variable validation
 * Ensures all required secrets and configs are set before app starts
 * Runs at build/startup time to catch missing env vars early
 */

// ─── VALIDATION ────────────────────────────────────────────────────────────

interface EnvVars {
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: string;
  NEXT_PUBLIC_SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;

  // OpenRouter AI
  OPENROUTER_API_KEY: string;

  // Lemon Squeezy
  LEMONSQUEEZY_API_KEY: string;
  LEMONSQUEEZY_STORE_ID: string;
  LEMONSQUEEZY_VARIANT_ID: string;
  LEMON_SQUEEZY_WEBHOOK_SECRET: string;

  // App
  NEXT_PUBLIC_APP_URL?: string;
}

/**
 * Validate required environment variables
 * Call this at app startup to fail fast if config is missing
 */
export function validateEnv(): EnvVars {
  const required: (keyof EnvVars)[] = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'OPENROUTER_API_KEY',
    'LEMONSQUEEZY_API_KEY',
    'LEMONSQUEEZY_STORE_ID',
    'LEMONSQUEEZY_VARIANT_ID',
    'LEMON_SQUEEZY_WEBHOOK_SECRET',
  ];

  const missing: string[] = [];

  for (const key of required) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables:\n${missing.map(k => `  - ${k}`).join('\n')}\n\nPlease set these in your .env.local file.`
    );
  }

  return {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL!,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY!,
    OPENROUTER_API_KEY: process.env.OPENROUTER_API_KEY!,
    LEMONSQUEEZY_API_KEY: process.env.LEMONSQUEEZY_API_KEY!,
    LEMONSQUEEZY_STORE_ID: process.env.LEMONSQUEEZY_STORE_ID!,
    LEMONSQUEEZY_VARIANT_ID: process.env.LEMONSQUEEZY_VARIANT_ID!,
    LEMON_SQUEEZY_WEBHOOK_SECRET: process.env.LEMON_SQUEEZY_WEBHOOK_SECRET!,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  };
}

// ─── SAFE ENV ACCESS ──────────────────────────────────────────────────────

/**
 * Get a secret from environment
 * NEVER use this client-side
 * Only expose environment variables that start with NEXT_PUBLIC_
 */
export function getSecret(key: keyof Omit<EnvVars, keyof { [K in keyof EnvVars as K extends `NEXT_PUBLIC_${string}` ? never : K]: true }>): string {
  const value = process.env[key];
  
  if (!value) {
    throw new Error(`Secret not found: ${key}`);
  }

  // Log (to CloudWatch, etc.) that this secret was accessed
  // But NEVER log the actual value
  if (process.env.NODE_ENV === 'development') {
    // Safe to log in development for debugging
    // console.log(`[ENV] Accessed secret: ${key}`);
  }

  return value;
}

/**
 * Check if running in development
 */
export const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Check if running in production
 */
export const isProduction = process.env.NODE_ENV === 'production';

// ─── EXPORT VALIDATED VARS ────────────────────────────────────────────────

let validatedEnv: EnvVars | null = null;

/**
 * Get validated environment variables
 */
export function getEnv(): Readonly<EnvVars> {
  if (!validatedEnv) {
    validatedEnv = validateEnv();
  }
  return validatedEnv;
}
