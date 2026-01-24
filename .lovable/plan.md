

# Payment System Investigation: Root Cause Analysis and Fix Plan

## Executive Summary

After extensive investigation of the payment system, Google authentication, and subscription activation flow, I've identified **three critical issues** causing users to be charged but not receive their subscription benefits.

---

## Issue 1: Stripe Webhook Not Updating the Correct Table (CRITICAL)

### Root Cause
The Stripe webhook (`stripe-webhook/index.ts`) updates `ghost_subscriptions` and `billing_customers` tables, but the subscription verification system (`useSubscription` hook and `get_user_tier` RPC function) reads from the `unified_subscriptions` table.

### Evidence
- Database query shows ALL users in `unified_subscriptions` have `tier: ghost_free`, `stripe_customer_id: null`, `stripe_subscription_id: null`
- Active Stripe subscriptions exist (e.g., `sub_1St3UCCAKg7jOuBKriiJmrAr` with $18/month Ghost Pro)
- No subscription activation notifications in the `notifications` table
- The `get_user_tier` RPC function queries `unified_subscriptions` exclusively

### The Table Mismatch

```text
+------------------------+     +----------------------+     +------------------------+
| Stripe Webhook WRITES  |     | Frontend READS       |     | Result                 |
+------------------------+     +----------------------+     +------------------------+
| ghost_subscriptions    | --> | unified_subscriptions| --> | Tier always shows FREE |
| billing_customers      |     | (via get_user_tier)  |     |                        |
+------------------------+     +----------------------+     +------------------------+
```

### Fix Required
Modify `stripe-webhook/index.ts` to ALSO update the `unified_subscriptions` table when processing `checkout.session.completed` events.

---

## Issue 2: Metadata Key Mismatch (CRITICAL)

### Root Cause
The `create-pro-checkout` function sets metadata as:
```typescript
metadata: {
  user_id: user.id,
  tier: tier,
  type: 'pro_subscription',  // <-- This key
}
```

But the webhook checks for:
```typescript
const productType = session.metadata?.product_type;  // <-- Different key!
if (productType === "ghost_subscription" && tier) {
  // This block never executes because product_type is undefined
}
```

### Evidence
- Stripe subscription `sub_1St3UCCAKg7jOuBKriiJmrAr` shows empty metadata: `"metadata":{}`
- The metadata is set on the checkout session but the webhook reads `product_type` which doesn't exist

### Fix Required
1. Update `create-pro-checkout` to use `product_type: "ghost_subscription"` instead of `type: "pro_subscription"`
2. Ensure Stripe subscription inherits metadata from checkout session (or fetch it correctly)

---

## Issue 3: Webhook May Not Be Receiving Events

### Root Cause
No recent stripe-webhook calls appear in the Edge Function logs, suggesting the Stripe webhook endpoint may not be properly configured in the Stripe Dashboard.

### Evidence
- Edge function analytics show NO calls to `stripe-webhook` function
- `STRIPE_WEBHOOK_SECRET` is configured in secrets
- Payment was processed successfully (payment intent shows `succeeded`)

### Fix Required
1. Verify Stripe Dashboard webhook endpoint URL: `https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/stripe-webhook`
2. Ensure these events are enabled:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`

---

## Issue 4: Google Authentication Redirect URL

### Observation
The Google OAuth redirect URL is set to `/auth` with intent parameters:
```typescript
const redirectUrl = `${window.location.origin}/auth${intent ? `?intent=${intent}` : ''}`;
```

This should work, but the auth callback page at `/auth/callback` handles session recovery separately. If users are having Google login issues, it may be due to:
1. Google Cloud Console not having the correct authorized redirect URIs
2. Session not being properly persisted after OAuth redirect

### Verification Needed
Check Google Cloud Console for authorized redirect URIs:
- `https://swissbrain.ai/auth/callback`
- `https://swissvault.ai/auth/callback`
- `https://*.lovable.app/auth/callback` (for preview)
- The Supabase callback: `https://rljnrgscmosgkcjdvlrq.supabase.co/auth/v1/callback`

---

## Implementation Plan

### Phase 1: Fix Stripe Webhook Table Updates (Immediate)

1. **Modify `stripe-webhook/index.ts`** - Add unified_subscriptions update:

```typescript
// After updating ghost_subscriptions, ALSO update unified_subscriptions
if (productType === "ghost_subscription" && tier) {
  // Existing ghost_subscriptions update...
  
  // ADD: Update unified_subscriptions (the table that useSubscription reads)
  const { error: unifiedError } = await supabase
    .from("unified_subscriptions")
    .upsert({
      user_id: userId,
      tier: tier,
      status: "active",
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    }, { onConflict: "user_id" });
    
  if (unifiedError) {
    logStep("ERROR: Failed to update unified_subscriptions", { error: unifiedError.message });
  } else {
    logStep("Unified subscription updated successfully", { tier });
  }
}
```

2. **Modify `create-pro-checkout/index.ts`** - Fix metadata keys:

```typescript
metadata: {
  user_id: user.id,
  tier: tier,
  product_type: 'ghost_subscription',  // Changed from 'type: pro_subscription'
}
```

### Phase 2: Handle Standard Subscription Mode

The webhook also has a `session.mode === "subscription"` block that falls through when `productType` is not set. This block updates `billing_customers` but not `unified_subscriptions`. It needs the same fix.

### Phase 3: Verify Stripe Webhook Configuration

User action required: Verify in Stripe Dashboard that the webhook endpoint is correctly configured.

### Phase 4: Fix Existing Paid Users

Create a one-time migration script to sync existing Stripe subscriptions to `unified_subscriptions`:

```sql
-- Match Stripe customers to users and update unified_subscriptions
-- This would need to be run manually after identifying affected users
```

---

## Technical Details

### Files to Modify

| File | Changes |
|------|---------|
| `supabase/functions/stripe-webhook/index.ts` | Add `unified_subscriptions` upsert in checkout.session.completed, subscription.updated, and subscription.deleted handlers |
| `supabase/functions/create-pro-checkout/index.ts` | Change metadata key from `type` to `product_type` |

### Database Tables Affected

| Table | Current Role | Should Also Handle |
|-------|--------------|-------------------|
| `unified_subscriptions` | READ by frontend | WRITE by webhook |
| `ghost_subscriptions` | WRITE by webhook | Keep as-is for token tracking |
| `billing_customers` | WRITE by webhook | Keep as backup |

### Testing Plan

1. Create test checkout session with correct metadata
2. Verify webhook receives event (check Edge Function logs)
3. Verify `unified_subscriptions` is updated
4. Verify `useSubscription` hook returns correct tier
5. Verify user sees correct tier in UI

---

## Summary of Root Causes

| Problem | Root Cause | Impact |
|---------|-----------|--------|
| Payment taken but no upgrade | Webhook writes to wrong table | Users stuck on free tier |
| Metadata mismatch | `type` vs `product_type` key difference | Ghost subscription handler never executes |
| No webhook calls in logs | Possibly missing Stripe Dashboard configuration | Payments never trigger updates |
| Google auth issues | Needs redirect URI verification | Users cannot sign in with Google |

