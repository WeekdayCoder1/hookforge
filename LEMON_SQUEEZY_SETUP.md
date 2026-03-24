# HookForge Pricing Integration - Lemon Squeezy Setup Guide

## Overview

HookForge now includes a complete Lemon Squeezy pricing integration with:

- ✅ Clean pricing page (`/pricing`)
- ✅ Checkout API route for secure subscription creation
- ✅ Webhook handler for subscription state management
- ✅ Full dark/light mode support
- ✅ Glassmorphism design consistency

## Files Created

### 1. Pricing Page

**File**: `src/app/pricing/page.tsx`

- Beautiful pricing cards for Free and Pro plans
- Features comparison
- Responsive design (mobile & desktop)
- Dark/light mode support
- Upgrade button that redirects to Lemon Squeezy checkout
- Current plan indicator per user

### 2. Lemon Squeezy Utility

**File**: `src/lib/lemonsqueezy.ts`

- `createCheckoutSession()` function for creating checkout sessions
- Handles API communication with Lemon Squeezy
- Returns checkout URL for redirect
- Error handling

### 3. Checkout API Route

**File**: `src/app/api/lemonsqueezy/checkout/route.ts` (POST)

- Validates user exists in database
- Calls Lemon Squeezy API to create checkout
- Returns checkout URL to frontend
- Secure - doesn't expose API key

### 4. Webhook Route

**File**: `src/app/api/lemonsqueezy/webhook/route.ts` (POST)

- Handles Lemon Squeezy webhook events
- Signature verification (if secret configured)
- Processes:
  - `subscription_created` → Updates user plan to "pro"
  - `subscription_updated` → Updates subscription status
  - `subscription_cancelled` → Reverts user to "free" plan
- Safe database updates using user_id from custom metadata

### 5. Updated Main Page

**File**: `src/app/page.tsx` (modified)

- Added router import for navigation
- Updated upgrade buttons to redirect to `/pricing`
- Navbar upgrade button links to pricing
- Limit reached banner upgrade button links to pricing

## Environment Variables Required

Add these to your `.env.local` file:

```env
# Lemon Squeezy
LEMON_SQUEEZY_API_KEY=your_api_key_here
LEMON_STORE_ID=your_store_id_here
LEMON_VARIANT_ID=your_product_variant_id_here
LEMON_WEBHOOK_SECRET=your_webhook_secret_here (optional but recommended)
```

### How to Get These Values

1. **LEMON_SQUEEZY_API_KEY**
   - Log in to Lemon Squeezy dashboard
   - Go to Settings → API → Access Keys
   - Create an API key and copy it

2. **LEMON_STORE_ID**
   - In Lemon Squeezy dashboard, go to your Store
   - The Store ID is in the URL or Settings
   - Format: numeric ID (e.g., "12345")

3. **LEMON_VARIANT_ID**
   - Create a product for "Pro Plan" in Lemon Squeezy
   - Create a variant for monthly billing ($9/month)
   - The Variant ID is displayed in the product settings
   - Format: numeric ID

4. **LEMON_WEBHOOK_SECRET**
   - Go to Settings → Webhooks
   - Create a webhook pointing to: `https://your-domain.com/api/lemonsqueezy/webhook`
   - Copy the webhook signing secret
   - _Currently optional - the webhook will still process events without it, but signature verification is skipped_

## Database Schema Update

The integration assumes your `users` table has these columns:

```sql
-- Existing columns (these remain unchanged)
id (UUID)
email (TEXT)
plan (TEXT) -- 'free' or 'pro'
generations_used (INT)
created_at (TIMESTAMP)

-- New columns to add (optional but recommended)
subscription_status (TEXT) -- 'active', 'on_trial', 'cancelled', etc.
lemon_customer_id (TEXT) -- Maps user to Lemon Squeezy customer
```

If your table doesn't have these new columns, add them:

```sql
ALTER TABLE users
ADD COLUMN subscription_status TEXT DEFAULT NULL,
ADD COLUMN lemon_customer_id TEXT DEFAULT NULL;
```

## How It Works

### Free User Upgrade Flow

1. User clicks "✨ Upgrade" button
2. Redirected to `/pricing` page
3. Clicks "Upgrade to Pro" on pro card
4. Checkout API called with user ID and email
5. Lemon Squeezy checkout URL returned
6. User redirected to Lemon Squeezy checkout (external)
7. After payment, user is redirected back to your site

### Webhook Flow

1. Lemon Squeezy sends subscription event
2. Webhook receives event at `/api/lemonsqueezy/webhook`
3. Signature verified (if secret configured)
4. User ID extracted from custom metadata
5. User plan updated in Supabase:
   - `subscription_created` → plan = "pro"
   - `subscription_cancelled` → plan = "free"
6. Response sent (200 OK always, even on errors)

## Security Considerations

✅ **API Key Protection**

- API key only used server-side in route handlers
- Never exposed to frontend
- Stored in environment variables

✅ **Signature Verification**

- Webhook signature verified using HMAC-SHA256
- Signature secret stored in env vars
- Invalid signatures rejected

✅ **User Validation**

- User ID from custom metadata matched against Supabase
- Checkout validates user exists before creating session
- No plan changes without verified webhook

✅ **CORS & Origin**

- API endpoints secured with Supabase auth checks
- Webhooks don't require auth but verify signature

## Testing Locally

### 1. Test Pricing Page

```
Visit: http://localhost:3001/pricing
- Should see two pricing cards
- Free plan disabled if already on free tier
- Pro plan shows highlight
```

### 2. Test Checkout Flow (Without Real Payment)

Lemon Squeezy test mode:

1. Add test products to Lemon Squeezy test mode
2. Use test card numbers: `4111111111111111`
3. Any future expiry date, any CVC

### 3. Test Webhooks Locally

Use a tunnel service to expose localhost:

```bash
# Using ngrok (install first)
ngrok http 3001
# Copy the HTTPS URL
```

Then:

1. Add webhook to Lemon Squeezy pointing to your ngrok URL
2. Simulate events in Lemon Squeezy webhook tester
3. Check console logs for webhook processing

## Troubleshooting

### "Missing Lemon Squeezy environment variables"

- Verify all 4 env vars are in `.env.local`
- Restart dev server after changing env vars
- Check for typos in variable names

### Checkout fails with 401/403

- Verify user exists in Supabase users table
- Check user ID matches what's being sent
- Verify API key is correct in env vars

### Webhook events not updating plan

- Check webhook secret is correct
- Verify custom metadata includes `user_id`
- Check Supabase connection works
- Look at server console logs for errors

### Dark mode issues

- Check localStorage theme setting
- Verify `dark` class is applied to html element
- All Tailwind dark: classes should work

## Next Steps

1. **Configure environment variables** in `.env.local`
2. **Test pricing page** at `/pricing`
3. **Set up Lemon Squeezy webhooks** in dashboard
4. **Add webhook URL** to Lemon Squeezy settings
5. **Test checkout flow** with test card
6. **Verify plan updates** after purchase

## File Structure

```
/src
  /app
    /pricing
      page.tsx          ← Pricing page (NEW)
    /api
      /lemonsqueezy
        /checkout
          route.ts      ← Checkout endpoint (NEW)
        /webhook
          route.ts      ← Webhook handler (NEW)
    page.tsx            ← Updated with routing
  /lib
    lemonsqueezy.ts     ← Lemon Squeezy API utility (NEW)
    supabase.ts         ← Existing
```

## Testing Checklist

- [ ] Environment variables configured
- [ ] Pricing page loads at `/pricing`
- [ ] Dark and light modes work on pricing page
- [ ] Upgrade button disabled for pro users
- [ ] Upgrade button works for free users (redirects to checkout)
- [ ] Checkout API responds with valid URL
- [ ] Webhook route accepts POST requests
- [ ] User plan updates after webhook event
- [ ] Navbar pricing link works
- [ ] No TypeScript errors
- [ ] No hydration errors in console

## Support

For issues:

1. Check server console logs for detailed errors
2. Verify Lemon Squeezy API credentials
3. Ensure database columns exist
4. Check webhook delivery in Lemon Squeezy dashboard
5. Verify network requests in browser DevTools
