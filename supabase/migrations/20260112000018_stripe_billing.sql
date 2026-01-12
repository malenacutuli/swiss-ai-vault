-- Stripe billing integration for SwissBrain
-- Handles subscriptions, customers, and tier management

-- Stripe customers table
CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
  email VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_user ON stripe_customers(user_id);
CREATE INDEX IF NOT EXISTS idx_stripe_customers_stripe ON stripe_customers(stripe_customer_id);

-- Subscriptions table
CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_subscription_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('active', 'canceled', 'incomplete', 'incomplete_expired', 'past_due', 'trialing', 'unpaid')),
  tier VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise')),
  price_id VARCHAR(255),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);

-- Invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_invoice_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_customer_id VARCHAR(255) NOT NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  amount_paid INTEGER NOT NULL,
  amount_due INTEGER NOT NULL,
  currency VARCHAR(3) DEFAULT 'usd',
  status VARCHAR(50) NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')),
  invoice_pdf VARCHAR(500),
  hosted_invoice_url VARCHAR(500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoices_user ON invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_stripe ON invoices(stripe_invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoices_subscription ON invoices(subscription_id);

-- RLS Policies
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Users can view their own stripe data
CREATE POLICY "Users view own stripe customers" ON stripe_customers
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users view own subscriptions" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users view own invoices" ON invoices
  FOR SELECT USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role full access stripe customers" ON stripe_customers
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access subscriptions" ON subscriptions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role full access invoices" ON invoices
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to update user tier based on subscription
CREATE OR REPLACE FUNCTION update_user_tier()
RETURNS TRIGGER AS $$
BEGIN
  -- Update user_settings with the subscription tier
  IF NEW.status = 'active' THEN
    UPDATE user_settings
    SET tier = NEW.tier, updated_at = NOW()
    WHERE user_id = NEW.user_id;
  ELSIF NEW.status IN ('canceled', 'unpaid', 'incomplete_expired') THEN
    -- Downgrade to free tier if subscription is not active
    UPDATE user_settings
    SET tier = 'free', updated_at = NOW()
    WHERE user_id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update user tier when subscription changes
CREATE TRIGGER subscription_tier_update
AFTER INSERT OR UPDATE OF status, tier ON subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_user_tier();

-- Add tier column to user_settings if not exists
ALTER TABLE user_settings
ADD COLUMN IF NOT EXISTS tier VARCHAR(20) DEFAULT 'free' CHECK (tier IN ('free', 'pro', 'enterprise'));

-- Function to get user subscription status
CREATE OR REPLACE FUNCTION get_user_subscription(p_user_id UUID)
RETURNS TABLE (
  subscription_id UUID,
  status VARCHAR,
  tier VARCHAR,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    s.status,
    s.tier,
    s.current_period_end,
    s.cancel_at_period_end
  FROM subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status IN ('active', 'trialing')
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
