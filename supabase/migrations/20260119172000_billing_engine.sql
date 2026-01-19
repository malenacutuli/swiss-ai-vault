-- Billing Engine for Manus Parity
-- Credit-based billing with reservation, charging, and refunds
-- Modified to handle existing tables

-- Table: billing_accounts - User/org credit balances
CREATE TABLE IF NOT EXISTS billing_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  org_id UUID, -- For organization billing

  -- Balance (in millicredits, 1 credit = 1000 millicredits)
  balance BIGINT DEFAULT 0,
  reserved_balance BIGINT DEFAULT 0, -- Credits reserved but not yet charged

  -- Limits
  spending_limit BIGINT, -- Optional spending limit
  rate_limit_per_hour INTEGER DEFAULT 1000, -- Max runs per hour
  rate_limit_per_day INTEGER DEFAULT 10000, -- Max runs per day

  -- Plan info
  plan_type TEXT DEFAULT 'free', -- 'free', 'starter', 'pro', 'enterprise'
  plan_credits_monthly BIGINT DEFAULT 10000000, -- 10k credits monthly for free
  plan_reset_at TIMESTAMPTZ,

  -- Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  suspended_at TIMESTAMPTZ,
  suspended_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id),
  UNIQUE(org_id)
);

-- Table: billing_ledger - Transaction history
CREATE TABLE IF NOT EXISTS billing_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES billing_accounts(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  run_id UUID, -- Reference to agent_runs

  -- Transaction
  transaction_type TEXT NOT NULL CHECK (transaction_type IN (
    'charge', 'refund', 'purchase', 'bonus', 'plan_credit', 'adjustment'
  )),
  credits_amount BIGINT NOT NULL, -- Positive for credits in, negative for credits out

  -- Balance tracking
  balance_before BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,

  -- Description
  description TEXT,

  -- Idempotency
  idempotency_key TEXT UNIQUE,

  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add columns to credit_reservations if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_reservations' AND column_name = 'account_id') THEN
    ALTER TABLE credit_reservations ADD COLUMN account_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_reservations' AND column_name = 'user_id') THEN
    ALTER TABLE credit_reservations ADD COLUMN user_id UUID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_reservations' AND column_name = 'credits_charged') THEN
    ALTER TABLE credit_reservations ADD COLUMN credits_charged BIGINT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_reservations' AND column_name = 'credits_refunded') THEN
    ALTER TABLE credit_reservations ADD COLUMN credits_refunded BIGINT DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_reservations' AND column_name = 'charged_at') THEN
    ALTER TABLE credit_reservations ADD COLUMN charged_at TIMESTAMPTZ;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_reservations' AND column_name = 'refunded_at') THEN
    ALTER TABLE credit_reservations ADD COLUMN refunded_at TIMESTAMPTZ;
  END IF;
END $$;

-- Add columns to credit_pricing if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_pricing' AND column_name = 'task_type') THEN
    ALTER TABLE credit_pricing ADD COLUMN task_type TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_pricing' AND column_name = 'base_cost') THEN
    ALTER TABLE credit_pricing ADD COLUMN base_cost BIGINT DEFAULT 1000;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_pricing' AND column_name = 'cost_per_token') THEN
    ALTER TABLE credit_pricing ADD COLUMN cost_per_token BIGINT DEFAULT 1;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_pricing' AND column_name = 'cost_per_second') THEN
    ALTER TABLE credit_pricing ADD COLUMN cost_per_second BIGINT DEFAULT 10;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_pricing' AND column_name = 'cost_per_step') THEN
    ALTER TABLE credit_pricing ADD COLUMN cost_per_step BIGINT DEFAULT 100;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_pricing' AND column_name = 'description') THEN
    ALTER TABLE credit_pricing ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'credit_pricing' AND column_name = 'is_active') THEN
    ALTER TABLE credit_pricing ADD COLUMN is_active BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Table: billing_usage - Aggregated usage tracking
CREATE TABLE IF NOT EXISTS billing_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id UUID REFERENCES billing_accounts(id) ON DELETE CASCADE,

  -- Period
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,
  period_type TEXT DEFAULT 'daily', -- 'hourly', 'daily', 'monthly'

  -- Counts
  run_count INTEGER DEFAULT 0,
  step_count INTEGER DEFAULT 0,
  token_count BIGINT DEFAULT 0,

  -- Credits
  credits_used BIGINT DEFAULT 0,
  credits_purchased BIGINT DEFAULT 0,
  credits_refunded BIGINT DEFAULT 0,

  -- By task type
  usage_by_type JSONB DEFAULT '{}',

  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(account_id, period_start, period_type)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_billing_accounts_user ON billing_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_accounts_org ON billing_accounts(org_id);
CREATE INDEX IF NOT EXISTS idx_billing_accounts_stripe ON billing_accounts(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_account ON billing_ledger(account_id);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_run ON billing_ledger(run_id);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_type ON billing_ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_billing_ledger_created ON billing_ledger(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_billing_usage_account ON billing_usage(account_id);
CREATE INDEX IF NOT EXISTS idx_billing_usage_period ON billing_usage(period_start, period_type);

-- Enable RLS
ALTER TABLE billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies (using IF NOT EXISTS pattern via DO block)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users see own billing account') THEN
    CREATE POLICY "Users see own billing account"
    ON billing_accounts FOR SELECT
    USING (user_id = auth.uid());
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access billing accounts') THEN
    CREATE POLICY "Service role full access billing accounts"
    ON billing_accounts FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users see own ledger') THEN
    CREATE POLICY "Users see own ledger"
    ON billing_ledger FOR SELECT
    USING (account_id IN (SELECT id FROM billing_accounts WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access ledger') THEN
    CREATE POLICY "Service role full access ledger"
    ON billing_ledger FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users see own usage') THEN
    CREATE POLICY "Users see own usage"
    ON billing_usage FOR SELECT
    USING (account_id IN (SELECT id FROM billing_accounts WHERE user_id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Service role full access usage') THEN
    CREATE POLICY "Service role full access usage"
    ON billing_usage FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Drop existing functions before recreating
DROP FUNCTION IF EXISTS get_or_create_billing_account(UUID);
DROP FUNCTION IF EXISTS reserve_credits(UUID, UUID, TEXT, INTEGER);
DROP FUNCTION IF EXISTS charge_credits(UUID, INTEGER, INTEGER, INTEGER);
DROP FUNCTION IF EXISTS refund_credits(UUID, TEXT);

-- Function: Get or create billing account for user
CREATE OR REPLACE FUNCTION get_or_create_billing_account(p_user_id UUID)
RETURNS billing_accounts AS $$
DECLARE
  v_account billing_accounts;
BEGIN
  SELECT * INTO v_account FROM billing_accounts WHERE user_id = p_user_id;

  IF v_account IS NULL THEN
    INSERT INTO billing_accounts (user_id, balance, plan_type, plan_reset_at)
    VALUES (p_user_id, 10000000, 'free', DATE_TRUNC('month', NOW()) + INTERVAL '1 month')
    RETURNING * INTO v_account;
  END IF;

  RETURN v_account;
END;
$$ LANGUAGE plpgsql;

-- Function: Reserve credits for a run
CREATE OR REPLACE FUNCTION reserve_credits(
  p_user_id UUID,
  p_run_id UUID,
  p_task_type TEXT,
  p_estimated_tokens INTEGER DEFAULT 1000
) RETURNS JSONB AS $$
DECLARE
  v_account billing_accounts;
  v_base_cost BIGINT := 1000;
  v_cost_per_token BIGINT := 1;
  v_credits_needed BIGINT;
  v_reservation credit_reservations;
BEGIN
  -- Get account
  v_account := get_or_create_billing_account(p_user_id);

  -- Check if active
  IF NOT v_account.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Account suspended');
  END IF;

  -- Try to get pricing for task type
  SELECT base_cost, cost_per_token INTO v_base_cost, v_cost_per_token
  FROM credit_pricing WHERE task_type = p_task_type AND is_active = TRUE
  LIMIT 1;

  -- Calculate estimated credits
  v_credits_needed := COALESCE(v_base_cost, 1000) + (p_estimated_tokens * COALESCE(v_cost_per_token, 1));

  -- Check balance
  IF (v_account.balance - v_account.reserved_balance) < v_credits_needed THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Insufficient credits',
      'balance', v_account.balance,
      'reserved', v_account.reserved_balance,
      'needed', v_credits_needed
    );
  END IF;

  -- Create reservation
  INSERT INTO credit_reservations (account_id, run_id, user_id, credits_reserved, expires_at)
  VALUES (v_account.id, p_run_id, p_user_id, v_credits_needed, NOW() + INTERVAL '1 hour')
  ON CONFLICT (run_id) DO UPDATE SET
    credits_reserved = EXCLUDED.credits_reserved,
    status = 'reserved',
    expires_at = EXCLUDED.expires_at
  RETURNING * INTO v_reservation;

  -- Update reserved balance
  UPDATE billing_accounts
  SET reserved_balance = reserved_balance + v_credits_needed
  WHERE id = v_account.id;

  RETURN jsonb_build_object(
    'success', true,
    'reservation_id', v_reservation.id,
    'credits_reserved', v_credits_needed,
    'balance_remaining', v_account.balance - v_account.reserved_balance - v_credits_needed
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Charge credits for a completed run
CREATE OR REPLACE FUNCTION charge_credits(
  p_run_id UUID,
  p_actual_tokens INTEGER DEFAULT 0,
  p_execution_seconds INTEGER DEFAULT 0,
  p_step_count INTEGER DEFAULT 0
) RETURNS JSONB AS $$
DECLARE
  v_reservation credit_reservations;
  v_account billing_accounts;
  v_base_cost BIGINT := 1000;
  v_cost_per_token BIGINT := 1;
  v_cost_per_second BIGINT := 10;
  v_cost_per_step BIGINT := 100;
  v_actual_cost BIGINT;
  v_refund_amount BIGINT;
  v_task_type TEXT;
BEGIN
  -- Get reservation
  SELECT * INTO v_reservation FROM credit_reservations WHERE run_id = p_run_id;
  IF v_reservation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No reservation found');
  END IF;

  IF v_reservation.status NOT IN ('reserved', 'partial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation already processed');
  END IF;

  -- Get account
  SELECT * INTO v_account FROM billing_accounts WHERE id = v_reservation.account_id;

  -- Get task type from run
  SELECT task_type INTO v_task_type FROM agent_runs WHERE id = p_run_id;

  -- Try to get pricing
  SELECT base_cost, cost_per_token, cost_per_second, cost_per_step
  INTO v_base_cost, v_cost_per_token, v_cost_per_second, v_cost_per_step
  FROM credit_pricing WHERE task_type = v_task_type AND is_active = TRUE
  LIMIT 1;

  -- Calculate actual cost
  v_actual_cost := COALESCE(v_base_cost, 1000)
    + (p_actual_tokens * COALESCE(v_cost_per_token, 1))
    + (p_execution_seconds * COALESCE(v_cost_per_second, 10))
    + (p_step_count * COALESCE(v_cost_per_step, 100));

  -- Cap at reserved amount
  IF v_actual_cost > v_reservation.credits_reserved THEN
    v_actual_cost := v_reservation.credits_reserved;
  END IF;

  -- Calculate refund
  v_refund_amount := v_reservation.credits_reserved - v_actual_cost;

  -- Update account balance
  UPDATE billing_accounts
  SET
    balance = balance - v_actual_cost,
    reserved_balance = reserved_balance - v_reservation.credits_reserved,
    updated_at = NOW()
  WHERE id = v_account.id;

  -- Update reservation
  UPDATE credit_reservations
  SET
    credits_charged = v_actual_cost,
    credits_refunded = v_refund_amount,
    status = 'charged',
    charged_at = NOW()
  WHERE id = v_reservation.id;

  -- Record in ledger
  INSERT INTO billing_ledger (account_id, user_id, run_id, transaction_type, credits_amount, balance_before, balance_after, description, metadata)
  VALUES (
    v_account.id,
    v_reservation.user_id,
    p_run_id,
    'charge',
    -v_actual_cost,
    v_account.balance,
    v_account.balance - v_actual_cost,
    format('Charge for %s run', COALESCE(v_task_type, 'unknown')),
    jsonb_build_object(
      'tokens', p_actual_tokens,
      'seconds', p_execution_seconds,
      'steps', p_step_count,
      'reserved', v_reservation.credits_reserved,
      'refunded', v_refund_amount
    )
  );

  -- Update run with credits charged
  UPDATE agent_runs SET credits_charged = v_actual_cost WHERE id = p_run_id;

  RETURN jsonb_build_object(
    'success', true,
    'credits_charged', v_actual_cost,
    'credits_refunded', v_refund_amount,
    'new_balance', v_account.balance - v_actual_cost
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Refund credits for a failed/cancelled run
CREATE OR REPLACE FUNCTION refund_credits(p_run_id UUID, p_reason TEXT DEFAULT 'run_failed')
RETURNS JSONB AS $$
DECLARE
  v_reservation credit_reservations;
  v_account billing_accounts;
BEGIN
  -- Get reservation
  SELECT * INTO v_reservation FROM credit_reservations WHERE run_id = p_run_id;
  IF v_reservation IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No reservation found');
  END IF;

  IF v_reservation.status NOT IN ('reserved', 'partial') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Reservation already processed');
  END IF;

  -- Get account
  SELECT * INTO v_account FROM billing_accounts WHERE id = v_reservation.account_id;

  -- Release reserved credits
  UPDATE billing_accounts
  SET
    reserved_balance = reserved_balance - v_reservation.credits_reserved,
    updated_at = NOW()
  WHERE id = v_account.id;

  -- Update reservation
  UPDATE credit_reservations
  SET
    credits_refunded = v_reservation.credits_reserved - COALESCE(v_reservation.credits_charged, 0),
    status = 'refunded',
    refunded_at = NOW()
  WHERE id = v_reservation.id;

  -- Record in ledger if any credits were charged
  IF COALESCE(v_reservation.credits_charged, 0) > 0 THEN
    INSERT INTO billing_ledger (account_id, user_id, run_id, transaction_type, credits_amount, balance_before, balance_after, description)
    VALUES (
      v_account.id,
      v_reservation.user_id,
      p_run_id,
      'refund',
      v_reservation.credits_charged,
      v_account.balance,
      v_account.balance + v_reservation.credits_charged,
      format('Refund: %s', p_reason)
    );

    UPDATE billing_accounts SET balance = balance + v_reservation.credits_charged WHERE id = v_account.id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'credits_refunded', v_reservation.credits_reserved - COALESCE(v_reservation.credits_charged, 0),
    'reason', p_reason
  );
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE billing_accounts IS 'User/org billing accounts with credit balances (Manus parity)';
COMMENT ON TABLE billing_ledger IS 'Transaction history for all credit operations';
COMMENT ON TABLE billing_usage IS 'Aggregated usage tracking by period';
COMMENT ON FUNCTION get_or_create_billing_account(UUID) IS 'Get or create billing account for a user';
COMMENT ON FUNCTION reserve_credits(UUID, UUID, TEXT, INTEGER) IS 'Reserve credits before run execution';
COMMENT ON FUNCTION charge_credits(UUID, INTEGER, INTEGER, INTEGER) IS 'Charge actual credits after run completion';
COMMENT ON FUNCTION refund_credits(UUID, TEXT) IS 'Refund reserved credits for failed/cancelled runs';
