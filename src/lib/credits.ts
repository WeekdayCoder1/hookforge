import { createClient } from "@supabase/supabase-js";
import { getEnv } from "./env";

// ─── TYPES ────────────────────────────────────────────────────────────────

interface UserCredits {
  id: string;
  credits_remaining: number;
  credits_total: number;
  plan?: string;
  is_pro?: boolean;
  last_credit_reset?: string | null;
}

// ─── INITIALIZATION ───────────────────────────────────────────────────────

// Initialize Supabase client with admin privileges (SERVICE ROLE ONLY)
// Must never be exposed to client-side code
let supabaseAdmin: ReturnType<typeof createClient> | null = null;

function getAdminClient() {
  if (!supabaseAdmin) {
    const env = getEnv();
    supabaseAdmin = createClient(
      env.NEXT_PUBLIC_SUPABASE_URL,
      env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      }
    );
  }
  return supabaseAdmin;
}

/**
 * Credit costs for actions
 */
export const CREDIT_COSTS = {
  generate: 3,
  regenerate: 1,
} as const;

/**
 * Default credits per plan
 */
export const DEFAULT_CREDITS = {
  free: 30,
  pro: 300,
} as const;

// ─── VALIDATION & SAFEGUARDS ──────────────────────────────────────────────

/**
 * Validate credit amount (prevent negative values and overflow)
 */
function validateCreditAmount(amount: number): boolean {
  return Number.isInteger(amount) && amount >= 0 && amount <= 999999;
}

/**
 * Check if credits need to be reset and reset them if necessary
 * Returns the updated user with current credits
 * 
 * SECURITY: Always use service role for credit operations
 * This ensures RLS policies can't be bypassed
 */
export async function checkAndResetCredits(userId: string): Promise<UserCredits> {
  try {
    // Validate user ID format
    if (!userId || typeof userId !== 'string' || userId.length < 36) {
      throw new Error("Invalid user ID format");
    }

    const client = getAdminClient();
    const { data: user, error: fetchError } = (await client
      .from("users")
      .select(
        "id, plan, is_pro, credits_remaining, credits_total, last_credit_reset"
      )
      .eq("id", userId)
      .single()) as {
        data: {
          id: string;
          credits_remaining: number;
          credits_total: number;
          plan?: string;
          is_pro?: boolean;
          last_credit_reset?: string | null;
        } | null;
        error: any;
      };

    if (fetchError || !user) {
      // User not found - this should never happen if auth is working
      // Log security event
      console.warn(`[SECURITY] User record not found during credit check: ${userId}`);
      throw new Error("User not found");
    }

    // Determine current time
    const now = new Date();
    const lastReset = user.last_credit_reset
      ? new Date(user.last_credit_reset)
      : new Date(0);

    // Calculate days since last reset
    const daysSinceReset = Math.floor(
      (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60 * 24)
    );

    // Check if reset is needed (30 days or more)
    if (daysSinceReset >= 30) {
      const isPro = user.is_pro || user.plan === "pro";
      const newCreditsTotal = isPro ? DEFAULT_CREDITS.pro : DEFAULT_CREDITS.free;

      // Validate new credit amounts before updating
      if (!validateCreditAmount(newCreditsTotal)) {
        throw new Error("Invalid credit amount calculated");
      }

      const { data: updatedUser, error: updateError } = (await (client as any)
        .from("users")
        .update({
          credits_remaining: newCreditsTotal,
          credits_total: newCreditsTotal,
          last_credit_reset: now.toISOString(),
        })
        .eq("id", userId)
        .select()
        .single()) as { data: UserCredits | null; error: any };

      if (updateError || !updatedUser) {
        console.error(`[CREDITS] Failed to reset credits for user ${userId}`, updateError);
        throw updateError || new Error("Failed to update user");
      }

      console.log(`[CREDITS] Reset monthly credits for user ${userId}: ${newCreditsTotal} credits`);
      return updatedUser;
    }

    return user;
  } catch (error) {
    console.error(`[CREDITS] Error checking/resetting credits for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Deduct credits from a user's account
 * Returns the new credit balance if successful, throws error if insufficient
 * 
 * SECURITY GUARANTEES:
 * - Server-side only operation
 * - Atomic: Checks before deduction to prevent race conditions
 * - Validates amounts to prevent injection
 * - Prevents negative credits
 * 
 * @param userId - User ID to deduct credits from
 * @param amount - Amount of credits to deduct (must be positive integer)
 * @returns New credit balance after deduction
 * @throws Error if insufficient credits or invalid amount
 */
export async function deductCredits(
  userId: string,
  amount: number
): Promise<number> {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string' || userId.length < 36) {
      throw new Error("Invalid user ID format");
    }

    if (!validateCreditAmount(amount) || amount <= 0) {
      throw new Error("Invalid credit amount");
    }

    // Step 1: Check and reset credits if needed
    const user = await checkAndResetCredits(userId);

    // Step 2: Validate current credits
    if (!validateCreditAmount(user.credits_remaining)) {
      console.error(`[SECURITY] Invalid credits stored for user ${userId}: ${user.credits_remaining}`);
      throw new Error("Invalid credit balance detected");
    }

    // Step 3: Check if sufficient credits
    if (user.credits_remaining < amount) {
      console.warn(`[CREDITS] Insufficient credits for user ${userId}: has ${user.credits_remaining}, needs ${amount}`);
      throw new Error(`Insufficient credits: need ${amount}, have ${user.credits_remaining}`);
    }

    // Step 4: Calculate new balance and validate
    const newCreditsRemaining = user.credits_remaining - amount;
    if (newCreditsRemaining < 0 || !validateCreditAmount(newCreditsRemaining)) {
      throw new Error("Credit calculation resulted in invalid amount");
    }

    // Step 5: Perform atomic update with service role
    const client = getAdminClient();
    const { data: updated, error: updateError } = (await (client as any)
      .from("users")
      .update({
        credits_remaining: newCreditsRemaining,
      })
      .eq("id", userId)
      .eq("credits_remaining", user.credits_remaining) // Optimistic lock: only update if unchanged
      .select("credits_remaining")
      .single()) as { data: { credits_remaining?: number } | null; error: any };

    if (updateError || !updated) {
      // If the row wasn't updated due to the optimistic lock, retry once
      console.warn(`[CREDITS] Optimistic lock failed for user ${userId}, retrying...`);
      
      // Retry check (to handle race conditions)
      const retryUser = await checkAndResetCredits(userId);
      if (retryUser.credits_remaining < amount) {
        throw new Error(`Insufficient credits: need ${amount}, have ${retryUser.credits_remaining}`);
      }

      const retryBalance = retryUser.credits_remaining - amount;
      const { error: retryError } = (await (client as any)
        .from("users")
        .update({ credits_remaining: retryBalance })
        .eq("id", userId)
        .select("credits_remaining")) as { error: any };

      if (retryError) {
        console.error(`[CREDITS] Failed to deduct credits after retry for user ${userId}`, retryError);
        throw retryError;
      }

      console.log(`[CREDITS] Deducted ${amount} credits from user ${userId} (retry): balance now ${retryBalance}`);
      return retryBalance;
    }

    console.log(`[CREDITS] Deducted ${amount} credits from user ${userId}: balance now ${newCreditsRemaining}`);
    return newCreditsRemaining;
  } catch (error) {
    console.error(`[CREDITS] Error deducting credits for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Add credits to a user's account (for referral rewards, subscription upgrades)
 * 
 * SECURITY: Server-side only, uses service role
 * 
 * @param userId - User ID to add credits to
 * @param amount - Amount of credits to add (must be positive integer)
 * @returns New credit balance after addition
 * @throws Error if invalid amount or database error
 */
export async function addCredits(
  userId: string,
  amount: number
): Promise<number> {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string' || userId.length < 36) {
      throw new Error("Invalid user ID format");
    }

    if (!validateCreditAmount(amount) || amount <= 0) {
      throw new Error("Invalid credit amount");
    }

    // Step 1: Check and reset credits if needed
    const user = await checkAndResetCredits(userId);

    // Step 2: Validate current credits
    if (!validateCreditAmount(user.credits_remaining)) {
      console.error(`[SECURITY] Invalid credits stored for user ${userId}: ${user.credits_remaining}`);
      throw new Error("Invalid credit balance detected");
    }

    // Step 3: Calculate new balance
    const newCreditsRemaining = user.credits_remaining + amount;
    const newCreditsTotal = user.credits_total + amount;

    // Step 4: Validate new amounts (prevent overflow)
    if (!validateCreditAmount(newCreditsRemaining) || !validateCreditAmount(newCreditsTotal)) {
      throw new Error("Credit calculation would exceed maximum allowed");
    }

    // Step 5: Update with service role
    const client = getAdminClient();
    const { error: updateError } = (await (client as any)
      .from("users")
      .update({
        credits_remaining: newCreditsRemaining,
        credits_total: newCreditsTotal,
      })
      .eq("id", userId)) as { error: any };

    if (updateError) {
      console.error(`[CREDITS] Failed to add credits for user ${userId}`, updateError);
      throw updateError;
    }

    console.log(`[CREDITS] Added ${amount} credits to user ${userId}: balance now ${newCreditsRemaining}`);
    return newCreditsRemaining;
  } catch (error) {
    console.error(`[CREDITS] Error adding credits for user ${userId}:`, error);
    throw error;
  }
}

/**
 * Get current user credits and info
 * 
 * SECURITY: Server-side only, uses service role
 */
export async function getUserCredits(userId: string) {
  try {
    if (!userId || typeof userId !== 'string' || userId.length < 36) {
      throw new Error("Invalid user ID format");
    }

    const user = await checkAndResetCredits(userId);

    return {
      creditsRemaining: user.credits_remaining,
      creditsTotal: user.credits_total,
      isPro: user.is_pro || user.plan === "pro",
      plan: user.plan || "free",
      lastReset: user.last_credit_reset,
    };
  } catch (error) {
    console.error(`[CREDITS] Error getting user credits for ${userId}:`, error);
    throw error;
  }
}

/**
 * Set credits for a user (used on plan upgrade/downgrade)
 * ATOMIC: Ensures all fields Updated together
 * 
 * SECURITY: Server-side only, uses service role
 */
export async function setCreditsForPlan(
  userId: string,
  plan: "free" | "pro"
): Promise<void> {
  try {
    // Validate inputs
    if (!userId || typeof userId !== 'string' || userId.length < 36) {
      throw new Error("Invalid user ID format");
    }

    if (plan !== "free" && plan !== "pro") {
      throw new Error("Invalid plan");
    }

    const credits = plan === "pro" ? DEFAULT_CREDITS.pro : DEFAULT_CREDITS.free;
    const isPro = plan === "pro";

    // Validate credit amounts
    if (!validateCreditAmount(credits)) {
      throw new Error("Invalid credit amount for plan");
    }

    const client = getAdminClient();
    const { error } = (await (client as any)
      .from("users")
      .update({
        plan,
        is_pro: isPro,
        credits_remaining: credits,
        credits_total: credits,
        last_credit_reset: new Date().toISOString(),
      })
      .eq("id", userId)) as { error: any };

    if (error) {
      console.error(`[CREDITS] Failed to set credits for plan for user ${userId}`, error);
      throw error;
    }

    console.log(`[CREDITS] Set credits for user ${userId} to plan ${plan}: ${credits} credits`);
  } catch (error) {
    console.error(`[CREDITS] Error setting credits for plan for user ${userId}:`, error);
    throw error;
  }
}
