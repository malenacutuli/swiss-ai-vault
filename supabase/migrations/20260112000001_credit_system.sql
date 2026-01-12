-- supabase/migrations/20260112000001_credit_system.sql
-- SwissBrain Credit System and Worker Infrastructure

-- ============================================================================
-- Add version and worker_id columns to agent_tasks
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='agent_tasks' AND column_name='version') THEN
    ALTER TABLE agent_tasks ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='agent_tasks' AND column_name='worker_id') THEN
    ALTER TABLE agent_tasks ADD COLUMN worker_id VARCHAR(100);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name='agent_tasks' AND column_name='reservation_id') THEN
    ALTER TABLE agent_tasks ADD COLUMN reservation_id UUID;
  END IF;
END $$;

-- ============================================================================
-- Credit Reservations Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS credit_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  step_id UUID,

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

  -- Constraints
  CONSTRAINT consumed_not_exceed_max CHECK (consumed_amount <= max_amount)
);

CREATE INDEX IF NOT EXISTS idx_credit_reservations_tenant ON credit_reservations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_run ON credit_reservations(run_id);
CREATE INDEX IF NOT EXISTS idx_credit_reservations_status ON credit_reservations(status) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_credit_reservations_expires ON credit_reservations(expires_at) WHERE status = 'active';

-- Enable RLS
ALTER TABLE credit_reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users see own reservations" ON credit_reservations;
CREATE POLICY "Users see own reservations" ON credit_reservations
  FOR SELECT USING (tenant_id = auth.uid());

DROP POLICY IF EXISTS "Service role full access" ON credit_reservations;
CREATE POLICY "Service role full access" ON credit_reservations
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Tool Execution Cache Table (for idempotency)
-- ============================================================================

CREATE TABLE IF NOT EXISTS tool_execution_cache (
  idempotency_key VARCHAR(255) PRIMARY KEY,
  result JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tool_cache_expires ON tool_execution_cache(expires_at);

-- Enable RLS
ALTER TABLE tool_execution_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access cache" ON tool_execution_cache;
CREATE POLICY "Service role full access cache" ON tool_execution_cache
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================================
-- Credit Management Functions
-- ============================================================================

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

-- Release reservation (cancel and refund unused)
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

-- ============================================================================
-- Worker Task Claiming Function
-- ============================================================================

CREATE OR REPLACE FUNCTION claim_next_agent_task(
  p_worker_id VARCHAR
) RETURNS TABLE (
  id UUID,
  user_id UUID,
  prompt TEXT,
  config JSONB,
  status VARCHAR,
  plan JSONB,
  current_phase_id INT,
  current_step_id UUID,
  step_count INT,
  credits_reserved DECIMAL,
  credits_consumed DECIMAL,
  created_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  timeout_at TIMESTAMPTZ,
  error JSONB,
  retry_count INT,
  max_retries INT,
  metadata JSONB,
  version INT,
  worker_id VARCHAR,
  reservation_id UUID
) AS $$
DECLARE
  v_task_id UUID;
BEGIN
  -- Find next queued or executing task (FIFO)
  SELECT t.id INTO v_task_id
  FROM agent_tasks t
  WHERE t.status IN ('queued', 'executing')
    AND (t.worker_id IS NULL OR t.worker_id = p_worker_id)
  ORDER BY t.created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  -- If no task found, return empty
  IF v_task_id IS NULL THEN
    RETURN;
  END IF;

  -- Claim the task
  UPDATE agent_tasks
  SET worker_id = p_worker_id,
      updated_at = NOW()
  WHERE agent_tasks.id = v_task_id;

  -- Return the claimed task
  RETURN QUERY
  SELECT
    t.id,
    t.user_id,
    t.prompt,
    t.config,
    t.status,
    t.plan,
    t.current_phase_id,
    t.current_step_id,
    t.step_count,
    t.credits_reserved,
    t.credits_consumed,
    t.created_at,
    t.started_at,
    t.completed_at,
    t.timeout_at,
    t.error,
    t.retry_count,
    t.max_retries,
    t.metadata,
    t.version,
    t.worker_id,
    t.reservation_id
  FROM agent_tasks t
  WHERE t.id = v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Cleanup expired cache entries
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_cache() RETURNS INT AS $$
DECLARE
  v_count INT;
BEGIN
  DELETE FROM tool_execution_cache
  WHERE expires_at < NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Grant execute permissions
-- ============================================================================

GRANT EXECUTE ON FUNCTION reserve_credits TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION consume_credits TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION finalize_reservation TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION release_reservation TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION expire_stale_reservations TO service_role;
GRANT EXECUTE ON FUNCTION claim_next_agent_task TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_cache TO service_role;
