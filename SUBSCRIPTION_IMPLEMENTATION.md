# HookForge Subscription Flow Implementation - Complete Setup Guide

## Implementation Summary

The complete Lemon Squeezy subscription flow has been implemented with:
✅ Enhanced checkout API with auth tokens  
✅ Improved webhook handler for subscription events  
✅ Generation limits enforcement (plan-based)  
✅ Daily/monthly counter resets  
✅ Success/cancelled messaging on pricing page  
✅ Full TypeScript type safety

---

## Database Schema Updates

Add these columns to your `users` table in Supabase:

```sql
ALTER TABLE users
ADD COLUMN daily_generations INT DEFAULT 0,
ADD COLUMN monthly_generations INT DEFAULT 0,
ADD COLUMN daily_reset_date TIMESTAMP DEFAULT NOW(),
ADD COLUMN monthly_reset_date TIMESTAMP DEFAULT NOW(),
ADD COLUMN subscription_status TEXT DEFAULT 'cancelled',
ADD COLUMN lemon_customer_id TEXT;

-- Optional: Add index for faster lookups
CREATE INDEX idx_users_lemon_customer_id ON users(lemon_customer_id);
```

### Column Explanations

- **daily_generations**: Count of generations per day (resets at 00:00 UTC)
- **monthly_generations**: Count of generations per month (resets on 1st of month)
- **daily_reset_date**: When daily counter was last reset
- **monthly_reset_date**: When monthly counter was last reset
- **subscription_status**: Current subscription status ('active', 'on_trial', 'cancelled')
- **lemon_customer_id**: Maps user to Lemon Squeezy customer (for support lookups)

---

## Environment Variables

Ensure `.env.local` has:

```env
# Existing variables
NEXT_PUBLIC_SUPABASE_URL=your_url
SUPABASE_SERVICE_ROLE_KEY=your_key
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_key
OPENROUTER_API_KEY=your_key

# Lemon Squeezy integration
LEMON_SQUEEZY_API_KEY=your_api_key
LEMON_STORE_ID=your_store_id
LEMON_VARIANT_ID=your_variant_id
LEMON_SQUEEZY_WEBHOOK_SECRET=your_webhook_secret

# For checkout redirects
NEXT_PUBLIC_APP_URL=http://localhost:3000  # Change for production
```

---

## File Changes Summary

### 1. Checkout Route (`/app/api/lemonsqueezy/checkout/route.ts`)

**What changed:**

- Now uses Supabase JWT token authentication
- Extracts user from auth token instead of request body
- Generates success/cancel URLs using `NEXT_PUBLIC_APP_URL`
- Passes URLs to Lemon Squeezy checkout creation

**Key flow:**

```
Client → Auth token in header → Route validates token →
Gets user from token → Creates checkout with redirect URLs → Returns checkout URL
```

### 2. Lemon Squeezy Utility (`/lib/lemonsqueezy.ts`)

**What changed:**

- `createCheckoutSession()` now accepts optional `successUrl` and `cancelUrl`
- URLs are passed to Lemon Squeezy API in correct format

### 3. Webhook Handler (`/app/api/lemonsqueezy/webhook/route.ts`)

**What changed:**

- Uses service role key to create Supabase client
- Improved user_id extraction from `checkout_data.custom`
- Better error handling and logging
- Always returns 200 OK (prevents Lemon Squeezy retries)
- Handles: `subscription_created`, `subscription_updated`, `subscription_cancelled`

**Events handled:**

- **subscription_created/updated**: Sets plan to 'pro' if active, updates subscription_status
- **subscription_cancelled**: Reverts plan to 'free', marks subscription_status as 'cancelled'

### 4. Generation Route (`/app/api/generate/route.ts`)

**What changed:**

- ✅ Authenticates user via Bearer token
- ✅ Fetches user plan and generation counters
- ✅ Resets daily counter if day changed
- ✅ Resets monthly counter if month changed
- ✅ Enforces limits:
  - **Free**: 5 per day, 40 per month
  - **Pro**: 300 per month (no daily limit)
- ✅ Returns 429 status if limit exceeded
- ✅ Increments counters after successful generation
- ✅ Allows unauthenticated requests (counts separately)

**Limit enforcement logic:**

```
IF auth token present:
  Get user plan from DB
  Reset daily/monthly if needed
  IF plan === 'free' AND daily >= 5: RETURN 429
  IF plan === 'free' AND monthly >= 40: RETURN 429
  IF plan === 'pro' AND monthly >= 300: RETURN 429
Generate hooks
Increment counters
```

### 5. Pricing Page (`/app/pricing/page.tsx`)

**What changed:**

- ✅ Handles `?success=true` query parameter → Shows success toast
- ✅ Handles `?cancelled=true` query parameter → Shows cancelled message
- ✅ Passes auth token to checkout API
- ✅ Added `useSearchParams()` hook for URL parameter detection
- ✅ Messages auto-dismiss after 5 seconds
- ✅ URL cleaned after message dismissal

### 6. Main Page (`/app/page.tsx`)

**What changed:**

- ✅ Passes auth token when calling `/api/generate`
- ✅ Handles 429 status code for limit errors
- ✅ Shows appropriate error messages on limit reached
- ✅ Added proper error handling for API responses

---

## API Endpoints

### POST `/api/lemonsqueezy/checkout`

**Authentication:** Required (Bearer token in Authorization header)

**Request:**

```bash
curl -X POST http://localhost:3000/api/lemonsqueezy/checkout \
  -H "Authorization: Bearer <user_auth_token>" \
  -H "Content-Type: application/json"
```

**Response (success):**

```json
{
  "checkout_url": "https://checkout.lemonsqueezy.com/..."
}
```

**Errors:**

- 401: No valid auth token
- 404: User not found in database
- 500: Lemon Squeezy API error

---

### POST `/api/lemonsqueezy/webhook`

**Authentication:** Webhook signature verification (if secret configured)

**Lemon Squeezy will POST:**

```json
{
  "meta": {
    "event_name": "subscription_created"
  },
  "data": {
    "id": "sub_123",
    "attributes": {
      "status": "active",
      "customer_id": "cus_123",
      "checkout_data": {
        "custom": {
          "user_id": "uuid-here"
        }
      }
    }
  }
}
```

**Webhook setup:**

1. Go to Lemon Squeezy Dashboard → Settings → Webhooks
2. Create webhook pointing to: `https://yourdomain.com/api/lemonsqueezy/webhook`
3. Copy webhook signing secret
4. Add to `.env.local` as `LEMON_SQUEEZY_WEBHOOK_SECRET`

---

### POST `/api/generate`

**Authentication:** Optional (Bearer token for authenticated users)

**Request (authenticated):**

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Authorization: Bearer <user_auth_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "How to make money online",
    "niche": "Finance",
    "tone": "Bold",
    "platform": "TikTok"
  }'
```

**Request (unauthenticated):**

```bash
curl -X POST http://localhost:3000/api/generate \
  -H "Content-Type: application/json" \
  -d '{
    "topic": "...",
    "niche": "...",
    "tone": "...",
    "platform": "..."
  }'
```

**Response (success):**

```json
{
  "hooks": ["Your first hook here", "Second hook", "..."]
}
```

**Error (limit reached):**

```json
{
  "error": "Daily limit reached. Upgrade to Pro for unlimited generations."
}
```

Status: 429

---

## Testing Checklist

### 1. Database Setup

- [ ] Run migrations to add new columns
- [ ] Verify columns exist: `daily_generations`, `monthly_generations`, etc.

### 2. Environment Variables

- [ ] All Lemon Squeezy env vars configured
- [ ] `NEXT_PUBLIC_APP_URL` set correctly

### 3. Checkout Flow

- [ ] Visit pricing page at `/pricing`
- [ ] Click "Upgrade to Pro"
- [ ] Verify auth token is sent in request
- [ ] Verify redirected to Lemon Squeezy checkout

### 4. Webhook Handling

- [ ] Go to Lemon Squeezy webhook tester
- [ ] Send `subscription_created` event
- [ ] Verify user plan updated to 'pro' in Supabase
- [ ] Send `subscription_cancelled` event
- [ ] Verify user plan reverted to 'free'

### 5. Limit Enforcement

- [ ] Sign in as free user
- [ ] Generate 5 hooks (daily limit)
- [ ] Attempt 6th generation → Should show error
- [ ] Verify counter in DB incremented
- [ ] Check reset logic (advance date, test reset)

### 6. Pro Upgrade

- [ ] Complete payment via Lemon Squeezy test card
- [ ] Should redirect to `/pricing?success=true`
- [ ] Should show success toast
- [ ] Verify plan changed to 'pro' in DB
- [ ] Should be able to generate unlimited hooks

### 7. Pricing Page Messages

- [ ] Manual URL test: `/pricing?success=true` → Shows toast
- [ ] Manual URL test: `/pricing?cancelled=true` → Shows message
- [ ] Messages auto-dismiss after 5 seconds
- [ ] URL cleaned up after dismissal

---

## Security Considerations

### API Key Protection

✅ `LEMON_SQUEEZY_API_KEY` only used in server-side route  
✅ `SUPABASE_SERVICE_ROLE_KEY` only used for webhook authentication  
✅ Never exposed to frontend

### Authentication

✅ Checkout requires JWT token from Supabase  
✅ Token verified server-side before proceeding  
✅ User ID extracted from verified token

### Webhook Security

✅ HMAC-SHA256 signature verification  
✅ Signature secret never sent to client  
✅ Always return 200 OK (prevents Lemon Squeezy from retrying indefinitely)  
✅ Safe DB updates using user_id from verified custom metadata

### Data Integrity

✅ User can only modify their own plan via webhook  
✅ Webhook only processes known event types  
✅ All DB operations check for errors

---

## Troubleshooting

### Checkout redirects to error page

1. Verify `NEXT_PUBLIC_APP_URL` is correct
2. Check Lemon Squeezy API key is valid
3. Verify LEMON_STORE_ID and LEMON_VARIANT_ID exist
4. Check server logs for detailed error

### Webhook not updating plan

1. Verify webhook is configured in Lemon Squeezy
2. Check webhook signing secret matches `LEMON_SQUEEZY_WEBHOOK_SECRET`
3. Look at webhook delivery logs in Lemon Squeezy
4. Check server logs for "Processing webhook event" messages
5. Verify user_id is included in checkout_data.custom

### Generation limits not enforcing

1. Verify database columns exist (run migrations)
2. Check auth token is being sent with requests
3. Verify user plan is set correctly in DB
4. Check server logs for "Processing limits" messages

### Token not working in checkout

1. Ensure user has active Supabase session
2. Verify token is not expired
3. Check Authorization header format: `Bearer <token>`
4. Verify `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are correct

---

## Next Steps

1. **Run database migrations** to add new columns
2. **Test checkout flow** with Lemon Squeezy test mode
3. **Configure webhooks** in Lemon Squeezy dashboard
4. **Test limit enforcement** by generating multiple times
5. **Monitor server logs** during testing for any issues

---

## Files Modified

```
/src
  /app
    /api
      /lemonsqueezy
        /checkout
          route.ts          ← UPDATED (auth token, URLs)
        /webhook
          route.ts          ← UPDATED (improved extraction)
      /generate
        route.ts            ← UPDATED (limits, counters, auth)
    /pricing
      page.tsx              ← UPDATED (success/cancelled, messages)
    page.tsx                ← UPDATED (auth token, error handling)
  /lib
    lemonsqueezy.ts         ← UPDATED (URL parameters)
```

For detailed code reviews, check each file's implementation.
