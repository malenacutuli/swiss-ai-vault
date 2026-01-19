-- =============================================
-- BILLING & CREDIT SCHEMA
-- Token-based billing matching Manus.im
-- =============================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS credit_transactions CASCADE;
DROP TABLE IF EXISTS credit_balances CASCADE;
DROP TABLE IF EXISTS credit_pricing CASCADE;
DROP TABLE IF EXISTS user_subscriptions CASCADE;
DROP TABLE IF EXISTS subscription_tiers CASCADE;

-- =============================================
-- SUBSCRIPTION TIERS
-- =============================================

CREATE TABLE subscription_tiers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Pricing
  price_monthly_cents INTEGER NOT NULL,
  price_yearly_cents INTEGER,

  -- Credits
  monthly_credits INTEGER NOT NULL,
  credit_rollover BOOLEAN DEFAULT FALSE,
  max_rollover_credits INTEGER,

  -- Limits
  max_concurrent_runs INTEGER DEFAULT 1,
  max_run_duration_seconds INTEGER DEFAULT 300,
  max_file_size_mb INTEGER DEFAULT 10,
  max_storage_gb INTEGER DEFAULT 1,

  -- Features
  features JSONB DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tiers
INSERT INTO subscription_tiers (id, name, description, price_monthly_cents, price_yearly_cents, monthly_credits, max_concurrent_runs, max_run_duration_seconds, max_file_size_mb, max_storage_gb, features)
VALUES
  ('free', 'Free', 'Get started with SwissBrain', 0, 0, 100, 1, 60, 5, 1,
   '{"wide_research": false, "scheduled_tasks": false, "connectors": 2, "priority_support": false}'),

  ('pro', 'Pro', 'For professionals and power users', 1900, 19000, 1000, 3, 300, 50, 10,
   '{"wide_research": true, "scheduled_tasks": true, "connectors": 10, "priority_support": false}'),

  ('team', 'Team', 'For teams and organizations', 4900, 49000, 5000, 10, 600, 100, 50,
   '{"wide_research": true, "scheduled_tasks": true, "connectors": -1, "priority_support": true, "sso": true}'),

  ('enterprise', 'Enterprise', 'Custom solutions for large organizations', 0, 0, -1, -1, -1, -1, -1,
   '{"wide_research": true, "scheduled_tasks": true, "connectors": -1, "priority_support": true, "sso": true, "dedicated_support": true, "custom_models": true}')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  monthly_credits = EXCLUDED.monthly_credits,
  features = EXCLUDED.features,
  updated_at = NOW();

-- =============================================
-- USER SUBSCRIPTIONS
-- =============================================

CREATE TABLE user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tier_id TEXT NOT NULL REFERENCES subscription_tiers(id),

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'past_due', 'trialing', 'paused')),

  -- Billing period
  current_period_start TIMESTAMPTZ NOT NULL,
  current_period_end TIMESTAMPTZ NOT NULL,

  -- Payment
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,

  -- Trial
  trial_start TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,

  -- Cancellation
  cancel_at_period_end BOOLEAN DEFAULT FALSE,
  cancelled_at TIMESTAMPTZ,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_status ON user_subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_stripe ON user_subscriptions(stripe_subscription_id);

-- =============================================
-- CREDIT BALANCES
-- =============================================

CREATE TABLE credit_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Current balance
  balance INTEGER NOT NULL DEFAULT 0,

  -- Period tracking
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_credits_granted INTEGER NOT NULL DEFAULT 0,
  period_credits_used INTEGER NOT NULL DEFAULT 0,

  -- Rollover
  rollover_credits INTEGER DEFAULT 0,

  -- Bonus credits (never expire)
  bonus_credits INTEGER DEFAULT 0,

  -- Reserved (for running tasks)
  reserved_credits INTEGER DEFAULT 0,

  -- Metadata
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_balances_user_id ON credit_balances(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_balances_period_end ON credit_balances(period_end);

-- =============================================
-- CREDIT TRANSACTIONS
-- =============================================

CREATE TABLE credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Transaction type
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'grant',           -- Monthly/yearly credit grant
    'bonus',           -- Bonus credits
    'usage',           -- Credit usage
    'refund',          -- Refund for failed task
    'rollover',        -- Rollover from previous period
    'expire',          -- Expired credits
    'purchase',        -- Additional credit purchase
    'adjustment'       -- Manual adjustment
  )),

  -- Amount (positive for grants, negative for usage)
  amount INTEGER NOT NULL,

  -- Balance after transaction
  balance_after INTEGER NOT NULL,

  -- Reference
  run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  step_id UUID REFERENCES agent_steps(id) ON DELETE SET NULL,

  -- Description
  description TEXT,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_run_id ON credit_transactions(run_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at DESC);

-- =============================================
-- CREDIT PRICING
-- Cost per tool/operation
-- =============================================

CREATE TABLE credit_pricing (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,

  -- Base cost
  credits_per_call INTEGER NOT NULL DEFAULT 1,

  -- Variable costs
  credits_per_1k_input_tokens DECIMAL(6,4),
  credits_per_1k_output_tokens DECIMAL(6,4),
  credits_per_second DECIMAL(6,4),
  credits_per_mb DECIMAL(6,4),

  -- Limits
  max_credits_per_call INTEGER,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default pricing
INSERT INTO credit_pricing (id, name, description, credits_per_call, credits_per_1k_input_tokens, credits_per_1k_output_tokens, credits_per_second, max_credits_per_call)
VALUES
  ('llm_gpt4', 'GPT-4 Turbo', 'OpenAI GPT-4 Turbo', 1, 0.3, 0.6, NULL, 50),
  ('llm_gpt35', 'GPT-3.5 Turbo', 'OpenAI GPT-3.5 Turbo', 1, 0.01, 0.02, NULL, 10),
  ('llm_claude3', 'Claude 3 Opus', 'Anthropic Claude 3 Opus', 1, 0.45, 0.9, NULL, 75),
  ('llm_claude3_sonnet', 'Claude 3 Sonnet', 'Anthropic Claude 3 Sonnet', 1, 0.09, 0.27, NULL, 25),
  ('llm_gemini', 'Gemini Pro', 'Google Gemini Pro', 1, 0.0125, 0.0375, NULL, 10),
  ('code_execution', 'Code Execution', 'Swiss K8s sandbox execution', 1, NULL, NULL, 0.1, 20),
  ('browser_action', 'Browser Action', 'Browser automation', 2, NULL, NULL, 0.05, 10),
  ('file_operation', 'File Operation', 'File read/write', 0, NULL, NULL, NULL, 1),
  ('search', 'Web Search', 'Web search query', 1, NULL, NULL, NULL, 5),
  ('wide_research', 'Wide Research', 'Parallel research (per item)', 5, NULL, NULL, NULL, NULL),
  ('document_generation', 'Document Generation', 'PPTX/DOCX/XLSX generation', 5, NULL, NULL, NULL, 20),
  ('image_generation', 'Image Generation', 'AI image generation', 10, NULL, NULL, NULL, 30),
  ('connector_call', 'Connector API Call', 'External connector API call', 1, NULL, NULL, NULL, 5)
ON CONFLICT (id) DO UPDATE SET
  credits_per_call = EXCLUDED.credits_per_call,
  credits_per_1k_input_tokens = EXCLUDED.credits_per_1k_input_tokens,
  credits_per_1k_output_tokens = EXCLUDED.credits_per_1k_output_tokens,
  updated_at = NOW();

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_balances ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_pricing ENABLE ROW LEVEL SECURITY;

-- subscription_tiers - public read
CREATE POLICY "Anyone can view active tiers"
  ON subscription_tiers FOR SELECT
  USING (is_active = TRUE);

-- user_subscriptions - user only
CREATE POLICY "Users can view own subscription"
  ON user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to subscriptions"
  ON user_subscriptions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- credit_balances - user only
CREATE POLICY "Users can view own balance"
  ON credit_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to balances"
  ON credit_balances FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- credit_transactions - user only
CREATE POLICY "Users can view own transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to transactions"
  ON credit_transactions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- credit_pricing - public read
CREATE POLICY "Anyone can view pricing"
  ON credit_pricing FOR SELECT
  USING (is_active = TRUE);

-- =============================================
-- CREDIT FUNCTIONS
-- =============================================

-- Function to check if user has enough credits
CREATE OR REPLACE FUNCTION check_credits(p_user_id UUID, p_required INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  available INTEGER;
BEGIN
  SELECT balance + bonus_credits - reserved_credits
  INTO available
  FROM credit_balances
  WHERE user_id = p_user_id;

  RETURN COALESCE(available, 0) >= p_required;
END;
$$ LANGUAGE plpgsql;

-- Function to reserve credits for a task
CREATE OR REPLACE FUNCTION reserve_credits(p_user_id UUID, p_amount INTEGER, p_run_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  available INTEGER;
BEGIN
  -- Check availability
  SELECT balance + bonus_credits - reserved_credits
  INTO available
  FROM credit_balances
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF COALESCE(available, 0) < p_amount THEN
    RETURN FALSE;
  END IF;

  -- Reserve credits
  UPDATE credit_balances
  SET reserved_credits = reserved_credits + p_amount,
      updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log reservation
  INSERT INTO credit_transactions (user_id, transaction_type, amount, balance_after, run_id, description)
  VALUES (p_user_id, 'usage', -p_amount, available - p_amount, p_run_id, 'Credit reservation');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function to consume reserved credits
CREATE OR REPLACE FUNCTION consume_credits(p_user_id UUID, p_amount INTEGER, p_run_id UUID, p_step_id UUID DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  UPDATE credit_balances
  SET
    balance = balance - p_amount,
    period_credits_used = period_credits_used + p_amount,
    reserved_credits = GREATEST(0, reserved_credits - p_amount),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log consumption
  INSERT INTO credit_transactions (user_id, transaction_type, amount, balance_after, run_id, step_id, description)
  SELECT p_user_id, 'usage', -p_amount, balance, p_run_id, p_step_id, 'Credit consumption'
  FROM credit_balances WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to release reserved credits (on task failure/cancellation)
CREATE OR REPLACE FUNCTION release_credits(p_user_id UUID, p_amount INTEGER, p_run_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE credit_balances
  SET
    reserved_credits = GREATEST(0, reserved_credits - p_amount),
    updated_at = NOW()
  WHERE user_id = p_user_id;

  -- Log release
  INSERT INTO credit_transactions (user_id, transaction_type, amount, balance_after, run_id, description)
  SELECT p_user_id, 'refund', p_amount, balance, p_run_id, 'Credit release (task cancelled/failed)'
  FROM credit_balances WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to grant monthly credits
CREATE OR REPLACE FUNCTION grant_monthly_credits(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  tier_credits INTEGER;
  new_balance INTEGER;
BEGIN
  -- Get tier credits
  SELECT st.monthly_credits
  INTO tier_credits
  FROM user_subscriptions us
  JOIN subscription_tiers st ON us.tier_id = st.id
  WHERE us.user_id = p_user_id AND us.status = 'active';

  IF tier_credits IS NULL OR tier_credits < 0 THEN
    RETURN 0; -- Enterprise or no subscription
  END IF;

  -- Update balance
  UPDATE credit_balances
  SET
    balance = tier_credits,
    period_start = NOW(),
    period_end = NOW() + INTERVAL '1 month',
    period_credits_granted = tier_credits,
    period_credits_used = 0,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING balance INTO new_balance;

  -- Log grant
  INSERT INTO credit_transactions (user_id, transaction_type, amount, balance_after, description)
  VALUES (p_user_id, 'grant', tier_credits, new_balance, 'Monthly credit grant');

  RETURN tier_credits;
END;
$$ LANGUAGE plpgsql;
