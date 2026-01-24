

# Payment Webhook Issue - Root Cause Analysis & Fix Plan

## Executive Summary

After thorough investigation, I've identified that while the Stripe webhook is correctly configured and events are being sent, the edge function is either **not receiving calls** or **logging is broken**. The database confirms the webhook never executed - all relevant tables (`unified_subscriptions`, `ghost_subscriptions`, `billing_customers`) remain unchanged after payment.

---

## Investigation Findings

### What's Working
- Stripe Dashboard shows webhook endpoint is Active with 0% error rate
- Events are being generated (checkout.session.completed, invoice.paid, etc.)
- itorres@axessible.ai successfully paid $18/mo Ghost Pro subscription
- Edge function code is correctly structured
- `STRIPE_WEBHOOK_SECRET` is configured in secrets
- Edge function responds (tested with curl - returns 400 "Missing signature" as expected)

### What's NOT Working
- No edge function logs appear for `stripe-webhook` (zero entries in analytics)
- User itorres@axessible.ai still shows `tier: ghost_free` in `unified_subscriptions`
- `ghost_subscriptions` shows `tier: free` 
- `billing_customers` table is completely empty
- No notifications created from webhook

---

## Root Cause Analysis

### Primary Issue: Webhook Signing Secret Mismatch

The most likely cause is a **mismatch between the webhook signing secret**. There are several scenarios:

1. **Test vs Live Secret Mismatch**: The `STRIPE_WEBHOOK_SECRET` stored in the backend may be for Stripe's Test mode while the webhook endpoint is configured in Live mode (or vice versa)

2. **Multiple Webhook Secrets**: If multiple webhook endpoints exist in Stripe, each has its own signing secret. The stored secret may be for a different endpoint

3. **Recently Rotated Secret**: If the webhook secret was rotated in Stripe Dashboard, the old secret would still be stored in the backend

### Evidence Supporting This Theory

- Stripe shows the webhook is "Active" and events are being sent
- The edge function exists and responds to direct calls
- No logs appear - this typically happens when:
  - The function crashes before logging starts
  - Signature verification fails silently
  - The Supabase logging pipeline has issues (known issue per community reports)

### Secondary Issue: Supabase Logging Pipeline

There's a documented issue where Supabase Edge Function logs may not appear in the dashboard even when functions execute. This means the webhook might actually be failing but we can't see the error.

---

## Verification Steps Required

Before implementing fixes, we need to verify the actual issue:

### Step 1: Verify Webhook Secret (User Action Required)

Please compare the webhook signing secret:

1. Go to Stripe Dashboard → Developers → Webhooks → Click on "SwissVault Webhook"
2. Click "Reveal" next to the signing secret
3. The secret should start with `whsec_...`
4. Verify this matches what's stored in `STRIPE_WEBHOOK_SECRET`

**Important**: There's a different secret for Live mode vs Test mode. Make sure you're looking at the correct one.

### Step 2: Check Webhook Event Delivery

1. In Stripe Dashboard → Developers → Webhooks → Click on the webhook
2. Click "Test webhook" → Select "checkout.session.completed"
3. Send a test event
4. Check if the event shows as "Succeeded" or "Failed" in the webhook log

### Step 3: Verify All Required Events are Enabled

Ensure these events are enabled for the webhook:
- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`

Currently the screenshot shows "1 event" which may indicate only one event type is enabled.

---

## Fix Plan (After Verification)

### Phase 1: Update Webhook Signing Secret

If the secret is mismatched:

1. Copy the correct webhook signing secret from Stripe Dashboard
2. Update `STRIPE_WEBHOOK_SECRET` in the backend secrets

### Phase 2: Add Enhanced Error Logging

Even without visible logs, we can make the webhook more resilient:

**File: `supabase/functions/stripe-webhook/index.ts`**

Add a fallback logging mechanism that writes errors to a database table:

```typescript
// Add at top of file
const logToDb = async (message: string, data: any) => {
  try {
    await supabase.from('webhook_logs').insert({
      function_name: 'stripe-webhook',
      message,
      data,
      created_at: new Date().toISOString()
    });
  } catch (e) {
    // Silently fail - this is just for debugging
  }
};
```

### Phase 3: Manual Database Sync for Existing Paid Users

Once webhook is working, run a one-time sync for itorres@axessible.ai:

**Database Migration:**

```sql
-- Update unified_subscriptions for itorres@axessible.ai
UPDATE unified_subscriptions 
SET 
  tier = 'ghost_pro',
  status = 'active',
  stripe_customer_id = 'cus_TqkzSmMwAwwEOs',
  stripe_subscription_id = 'sub_1St3UCCAKg7jOuBKriiJmrAr',
  current_period_start = NOW(),
  current_period_end = NOW() + INTERVAL '30 days',
  updated_at = NOW()
WHERE user_id = '458e553a-7c8f-4f57-8806-633a5c801905';

-- Update ghost_subscriptions
UPDATE ghost_subscriptions 
SET 
  tier = 'ghost_pro',
  plan = 'ghost_pro',
  expires_at = NOW() + INTERVAL '30 days'
WHERE user_id = '458e553a-7c8f-4f57-8806-633a5c801905';

-- Insert billing_customers record
INSERT INTO billing_customers (
  user_id, email, stripe_customer_id, stripe_subscription_id,
  subscription_status, tier, current_period_end
) VALUES (
  '458e553a-7c8f-4f57-8806-633a5c801905',
  'itorres@axessible.ai',
  'cus_TqkzSmMwAwwEOs',
  'sub_1St3UCCAKg7jOuBKriiJmrAr',
  'active',
  'ghost_pro',
  NOW() + INTERVAL '30 days'
) ON CONFLICT (user_id) DO UPDATE SET
  stripe_customer_id = EXCLUDED.stripe_customer_id,
  stripe_subscription_id = EXCLUDED.stripe_subscription_id,
  subscription_status = EXCLUDED.subscription_status,
  tier = EXCLUDED.tier,
  current_period_end = EXCLUDED.current_period_end;
```

### Phase 4: Create Webhook Debug Table

To help debug future webhook issues:

```sql
CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  message TEXT,
  data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Allow service role to write
ALTER TABLE webhook_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role can insert" ON webhook_logs 
  FOR INSERT WITH CHECK (true);
```

---

## Recommended Immediate Actions

1. **Priority 1**: Verify the `STRIPE_WEBHOOK_SECRET` matches what's in Stripe Dashboard (this is most likely the issue)

2. **Priority 2**: Check if all required webhook events are enabled (screenshot shows only "1 event")

3. **Priority 3**: Manually sync itorres@axessible.ai's subscription data to resolve their immediate issue

4. **Priority 4**: Implement webhook debug logging to catch future issues

---

## Technical Summary

| Component | Status | Issue |
|-----------|--------|-------|
| Stripe Webhook Endpoint | Configured | May have wrong signing secret |
| Event Types | Partially Configured | Only 1 event enabled? |
| Edge Function | Deployed | No logs visible |
| unified_subscriptions | Not Updated | tier=ghost_free |
| ghost_subscriptions | Not Updated | tier=free |
| billing_customers | Empty | No records |

