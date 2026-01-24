-- Drop the restrictive tier constraint and add ghost tiers
ALTER TABLE billing_customers DROP CONSTRAINT IF EXISTS billing_customers_tier_check;

ALTER TABLE billing_customers ADD CONSTRAINT billing_customers_tier_check 
CHECK (tier = ANY (ARRAY['free', 'pro', 'enterprise', 'ghost_free', 'ghost_pro', 'swissvault_pro']));

-- Now insert/update billing_customers
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