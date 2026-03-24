# Hookforge Credit-Based Billing System - Refactor Complete ✨

## Overview

Successfully refactored Hookforge from a generation-based quota system to a modern credit-based billing system.

---

## 📊 PRICING MODEL

### FREE PLAN

- **30 credits per month**
- Basic hook = 1 credit
- Pro hook = 3 credits

### PRO PLAN

- **300 credits per month**
- **Price: $10/month** (was $15, now at limited-time offer price)
- Same credit cost per action
- Unlimited hook history

---

## 🗄 DATABASE MIGRATION REQUIRED

### Users Table Schema Changes

Run the following SQL migrations in Supabase:

```sql
-- Remove old generation-based columns
ALTER TABLE users DROP COLUMN IF EXISTS generations_used CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS daily_generations CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS monthly_generations CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS daily_reset_date CASCADE;
ALTER TABLE users DROP COLUMN IF EXISTS monthly_reset_date CASCADE;

-- Add credit-based system columns
ALTER TABLE users
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS is_pro BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS credits_remaining INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS credits_total INT DEFAULT 30,
ADD COLUMN IF NOT EXISTS last_credit_reset TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Set existing pro users to new schema
UPDATE users
SET
  is_pro = true,
  credits_remaining = 300,
  credits_total = 300,
  last_credit_reset = NOW()
WHERE plan = 'pro';

-- Set free users to default
UPDATE users
SET
  is_pro = false,
  credits_remaining = 30,
  credits_total = 30,
  last_credit_reset = NOW()
WHERE plan = 'free' OR plan IS NULL;
```

### Hook History Table Updates (Optional)

Add a new column to track hook type:

```sql
ALTER TABLE hook_history
ADD COLUMN IF NOT EXISTS hook_type TEXT DEFAULT 'basic' CHECK (hook_type IN ('basic', 'pro'));
```

---

## 🔧 CODE CHANGES SUMMARY

### 1. **NEW: `/lib/credits.ts`** ⭐

Centralized credit management utility with:

- `CREDIT_COSTS`: Defines credit requirements (basic=1, pro=3)
- `DEFAULT_CREDITS`: Monthly credit amounts (free=30, pro=300)
- `getRequiredCredits(hookType)`: Returns credit cost for hook type
- `checkAndResetCredits(userId)`: Checks if 30+ days passed, resets monthly credits
- `deductCredits(userId, amount)`: Deducts credits and returns success/failure
- `getUserCredits(userId)`: Gets current credit state
- `setCreditsForPlan(userId, plan)`: Sets credits when user upgrades/downgrades

**Key Logic:**

- Monthly reset happens automatically when 30+ days since `last_credit_reset`
- Free plan always resets to 30 credits
- Pro plan always resets to 300 credits

### 2. **REFACTORED: `/api/generate/route.ts`**

- Accepts `hookType` in request body ('basic' | 'pro')
- Uses `checkAndResetCredits()` to handle monthly resets
- Validates user has sufficient credits before generating
- Returns 403 status if insufficient credits
- Calls `deductCredits()` after successful generation
- Saves `hook_type` in history records

### 3. **UPDATED: `/api/lemonsqueezy/webhook/route.ts`**

- Imports `setCreditsForPlan` from credits utility
- On `subscription_created`/`subscription_updated`: Calls `setCreditsForPlan(userId, 'pro')`
- On `subscription_cancelled`: Calls `setCreditsForPlan(userId, 'free')`
- Updates `is_pro` flag in sync with plan change

### 4. **REFACTORED: `/app/page.tsx` (Dashboard)**

- **State Changes:**
  - `usage` → `creditsRemaining` (0-30/300)
  - `usagePct` → `creditProgressPct` (0-100%)
  - New state: `hookType` ('basic' | 'pro')
  - New state: `creditsTotal` (tracks limit for progress bar)

- **Bootstrap Logic:**
  - Creates new users with default 30 credits
  - Fetches `credits_remaining` and `credits_total` instead of `generations_used`

- **Generation Logic:**
  - Validates `hookType` selected
  - Calculates `requiredCredits` based on type (1 or 3)
  - Checks `creditsRemaining >= requiredCredits`
  - Sends `hookType` in API request
  - Deducts credits from UI state on success

- **UI Updates:**
  - Hook Type Toggle: Basic (1 credit) vs Pro (3 credits)
  - Credit Progress Bar: Shows `creditsRemaining/creditsTotal`
  - "Not enough credits" banner replaces old limit reached message
  - Disabled states updated to use `!hasEnoughCredits`

### 5. **UPDATED: `/app/pricing/page.tsx` (Pricing Page)**

- **Free Plan Features:**
  - 30 credits/month
  - Shows credit system (not generations)
- **Pro Plan Features:**
  - **Price: $10/month** (struck through $15)
  - 300 credits/month
  - Badge changed from "Popular" to "⏰ Limited Time Offer"
  - Emphasizes credit allowance

---

## 🎯 KEY IMPLEMENTATION DETAILS

### Monthly Credit Reset

```typescript
// Automatic in checkAndResetCredits()
if (daysSinceReset >= 30) {
  if (isPro) {
    credits_remaining = 300;
  } else {
    credits_remaining = 30;
  }
  last_credit_reset = NOW();
}
```

### Credit Deduction Flow

1. User selects hook type (basic=1 credit, pro=3 credits)
2. Frontend checks `creditsRemaining >= requiredCredits`
3. API call includes `hookType` parameter
4. Backend validates credits again
5. After generation succeeds, `deductCredits()` updates database
6. Frontend optimistically updates UI immediately

### Error Handling

- `401`: Unauthorized (not logged in)
- `400`: Invalid hook type
- `403`: Insufficient credits (old code returned 429, now 403)
- `500`: Server error

---

## 🧪 TESTING CHECKLIST

- [ ] **User Creation**: New signups get 30 free credits
- [ ] **Generation - Basic**: Using 1 credit
- [ ] **Generation - Pro**: Using 3 credits
- [ ] **Insufficient Credits**: Shows "not enough credits" message
- [ ] **Monthly Reset**: After 30 days, credits reset automatically
- [ ] **Upgrade to Pro**: Sets 300 credits immediately
- [ ] **Downgrade to Free**: Caps credits at 30
- [ ] **Webhook Success**: Payment sets is_pro=true, credits=300
- [ ] **Webhook Cancel**: Cancellation sets is_pro=false, credits=30
- [ ] **Progress Bar**: Displays correctly (remaining/total)
- [ ] **UI Responsiveness**: No visual regressions
- [ ] **Dark Mode**: All credit UI compatible

---

## ⚠️ MIGRATION NOTES

### For Existing Users:

1. Existing free users will be set to 30 credits
2. Existing pro users will be set to 300 credits
3. All generation tracking is reset (intentional - new system)
4. `last_credit_reset` initialized to current time for all users

### Backward Compatibility:

- Old `generation_count` fields are removed
- No migration needed for existing hooks in history (only generation count dropped)
- LemonSqueezy checkout flow unchanged
- Supabase auth unchanged

---

## 📝 CHECKLIST FOR DEPLOYMENT

- [ ] Run SQL migrations on production Supabase
- [ ] Deploy all updated code
- [ ] Test webhook with test payment
- [ ] Verify credit deduction in real environment
- [ ] Check monthly reset logic (or manually test with past `last_credit_reset`)
- [ ] Monitor pricing page conversion
- [ ] Update user documentation if needed

---

## 🔐 SECURITY NOTES

- Credit deduction happens server-side (backend always authoritative)
- Frontend UI deduction is optimistic (database is source of truth)
- All user operations validated with authentication
- Webhook signature verification preserved
- Service role key only used server-side

---

**Refactor Complete! 🎉**

All generation-based logic has been cleanly replaced with centralized, scalable credit system.
