-- supabase/migrations/20260112_credit_system.sql

-- Credit reservations table
CREATE TABLE IF NOT EXISTS credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  step_id UUID REFERENCES agent_task_steps(id) ON DELETE SET NULL,

  -- Amounts
  reserved_amount DECIMAL(10,4) NOT NULL CHECK (reserved_amount >= 0),
  consumed_amount DECIMAL(10,4) NOT NULL DEFAULT 0 CHECK (consumed_amount >= 0),
  max_amount DECIMAL(10,4) NOT NULL CHECK (max_amount >= reserved_amount),

  -- Status
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'finalized', 'released', 'expired')),

  -- Timing
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  finalized_at TIMESTAMPTZ,

  -- Metadata
  tool_name VARCHAR(100),
  finalization_reason VARCHAR(100),

  -- Indexes
  CONSTRAINT consumed_not_exceed_max CHECK (consumed_amount <= max_amount)
);

CREATE INDEX idx_credit_reservations_tenant ON credit_reservations(tenant_id);
CREATE INDEX idx_credit_reservations_run ON credit_reservations(run_id);
CREATE INDEX idx_credit_reservations_status ON credit_reservations(status) WHERE status = 'active';
CREATE INDEX idx_credit_reservations_expires ON credit_reservations(expires_at) WHERE status = 'active';

-- Enable RLS
ALTER TABLE credit_reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own reservations" ON credit_reservations
  FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Service role full access" ON credit_reservations
  FOR ALL USING (auth.role() = 'service_role');

-- Reserve credits function
CREATE OR REPLACE FUNCTION reserve_credits(
  p_tenant_id UUID,
  p_run_id UUID,
  p_amount DECIMAL,
  p_max_amount DECIMAL DEFAULT NULL,
  p_expires_in_seconds INT DEFAULT 3600
) RETURNS UUID AS $$
DECLARE
  v_balance DECIMAL;
  v_total_reserved DECIMAL;
  v_available DECIMAL;
  v_max DECIMAL;
  v_reservation_id UUID;
BEGIN
  -- Default max_amount to amount
  v_max := COALESCE(p_max_amount, p_amount);

  -- Get current balance with lock
  SELECT credit_balance INTO v_balance
  FROM profiles
  WHERE id = p_tenant_id
  FOR UPDATE;

  IF v_balance IS NULL THEN
    RAISE EXCEPTION 'Tenant not found: %', p_tenant_id;
  END IF;

  -- Get total active reservations
  SELECT COALESCE(SUM(reserved_amount - consumed_amount), 0) INTO v_total_reserved
  FROM credit_reservations
  WHERE tenant_id = p_tenant_id AND status = 'active';

  -- Calculate available balance
  v_available := v_balance - v_total_reserved;

  -- Check if we can reserve
  IF v_available < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits: available=%, requested=%', v_available, p_amount;
  END IF;

  -- Create reservation
  INSERT INTO credit_reservations (
    tenant_id, run_id, reserved_amount, max_amount,
    expires_at, status
  ) VALUES (
    p_tenant_id, p_run_id, p_amount, v_max,
    NOW() + (p_expires_in_seconds || ' seconds')::INTERVAL, 'active'
  ) RETURNING id INTO v_reservation_id;

  RETURN v_reservation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Consume credits function
CREATE OR REPLACE FUNCTION consume_credits(
  p_reservation_id UUID,
  p_amount DECIMAL
) RETURNS BOOLEAN AS $$
DECLARE
  v_reservation credit_reservations%ROWTYPE;
BEGIN
  -- Lock the reservation
  SELECT * INTO v_reservation
  FROM credit_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF v_reservation IS NULL THEN
    RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
  END IF;

  IF v_reservation.status != 'active' THEN
    RAISE EXCEPTION 'Reservation not active: %', v_reservation.status;
  END IF;

  IF v_reservation.consumed_amount + p_amount > v_reservation.max_amount THEN
    RAISE EXCEPTION 'Would exceed max amount: consumed=%, max=%, requested=%',
      v_reservation.consumed_amount, v_reservation.max_amount, p_amount;
  END IF;

  -- Update reservation
  UPDATE credit_reservations
  SET consumed_amount = consumed_amount + p_amount
  WHERE id = p_reservation_id;

  -- Deduct from actual balance
  UPDATE profiles
  SET credit_balance = credit_balance - p_amount
  WHERE id = v_reservation.tenant_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Finalize reservation function
CREATE OR REPLACE FUNCTION finalize_reservation(
  p_reservation_id UUID,
  p_reason VARCHAR DEFAULT 'completed'
) RETURNS BOOLEAN AS $$
DECLARE
  v_reservation credit_reservations%ROWTYPE;
  v_unused DECIMAL;
BEGIN
  SELECT * INTO v_reservation
  FROM credit_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF v_reservation IS NULL OR v_reservation.status != 'active' THEN
    RETURN FALSE;
  END IF;

  -- Update reservation status
  UPDATE credit_reservations
  SET
    status = 'finalized',
    finalized_at = NOW(),
    finalization_reason = p_reason
  WHERE id = p_reservation_id;

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Release reservation (refund unused)
CREATE OR REPLACE FUNCTION release_reservation(
  p_reservation_id UUID,
  p_reason VARCHAR DEFAULT 'cancelled'
) RETURNS DECIMAL AS $$
DECLARE
  v_reservation credit_reservations%ROWTYPE;
  v_refund DECIMAL;
BEGIN
  SELECT * INTO v_reservation
  FROM credit_reservations
  WHERE id = p_reservation_id
  FOR UPDATE;

  IF v_reservation IS NULL OR v_reservation.status != 'active' THEN
    RETURN 0;
  END IF;

  -- Calculate refund (consumed amount already deducted)
  v_refund := 0;  -- Reservation only blocked, didn't deduct

  -- Update reservation status
  UPDATE credit_reservations
  SET
    status = 'released',
    finalized_at = NOW(),
    finalization_reason = p_reason
  WHERE id = p_reservation_id;

  RETURN v_refund;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Expire stale reservations (run via pg_cron)
CREATE OR REPLACE FUNCTION expire_stale_reservations() RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  UPDATE credit_reservations
  SET
    status = 'expired',
    finalized_at = NOW(),
    finalization_reason = 'expired'
  WHERE status = 'active' AND expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Tool execution cache for idempotency
CREATE TABLE IF NOT EXISTS tool_execution_cache (
  idempotency_key VARCHAR(255) PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_tool_cache_expires ON tool_execution_cache(expires_at);

-- Enable RLS
ALTER TABLE tool_execution_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access" ON tool_execution_cache
  FOR ALL USING (auth.role() = 'service_role');
