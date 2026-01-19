-- ============================================================================
-- Migration: Orchestrator State Machine
-- Created: 2026-01-16
-- Description: Adds fencing tokens and extended state tracking for orchestrator
-- ============================================================================

-- Add orchestrator fields to agent_runs
ALTER TABLE agent_runs
ADD COLUMN IF NOT EXISTS state_version INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS fencing_token UUID,
ADD COLUMN IF NOT EXISTS fencing_expires_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS orchestrator_mode VARCHAR(20) DEFAULT 'legacy',
ADD COLUMN IF NOT EXISTS decomposition_strategy VARCHAR(50),
ADD COLUMN IF NOT EXISTS total_subtasks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS completed_subtasks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS failed_subtasks INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS deadline_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_progress_at TIMESTAMPTZ;

-- Create index for fencing token lookups
CREATE INDEX IF NOT EXISTS idx_agent_runs_fencing_token ON agent_runs(fencing_token) WHERE fencing_token IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_agent_runs_orchestrator_mode ON agent_runs(orchestrator_mode) WHERE orchestrator_mode = 'orchestrator';
CREATE INDEX IF NOT EXISTS idx_agent_runs_deadline ON agent_runs(deadline_at) WHERE deadline_at IS NOT NULL AND status NOT IN ('completed', 'failed', 'cancelled');

-- ============================================================================
-- Subtasks Table for Parallel Execution
-- ============================================================================

CREATE TABLE IF NOT EXISTS subtasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    subtask_index INTEGER NOT NULL,
    idempotency_key VARCHAR(255) NOT NULL UNIQUE,

    -- Task definition
    task_type VARCHAR(50) NOT NULL,
    entity_id VARCHAR(255),
    input_data JSONB NOT NULL DEFAULT '{}',

    -- State management (mirrors SubtaskState enum)
    state VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (state IN ('pending', 'queued', 'assigned', 'running', 'checkpointed', 'completed', 'failed', 'skipped', 'cancelled')),
    state_version INTEGER DEFAULT 1,

    -- Execution tracking
    attempt_count INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    assigned_worker_id VARCHAR(255),
    heartbeat_at TIMESTAMPTZ,

    -- Checkpointing
    checkpoint_id UUID,
    checkpoint_step INTEGER DEFAULT 0,
    checkpoint_data JSONB,

    -- Results
    result_data JSONB,
    artifacts TEXT[] DEFAULT ARRAY[]::TEXT[],

    -- Error tracking
    last_error TEXT,
    last_error_code VARCHAR(50),

    -- Timing
    created_at TIMESTAMPTZ DEFAULT NOW(),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,

    -- Dependencies (array of subtask IDs)
    depends_on UUID[] DEFAULT ARRAY[]::UUID[],

    -- Constraints
    UNIQUE(run_id, subtask_index)
);

-- Indexes for subtasks
CREATE INDEX IF NOT EXISTS idx_subtasks_run_id ON subtasks(run_id);
CREATE INDEX IF NOT EXISTS idx_subtasks_state ON subtasks(state);
CREATE INDEX IF NOT EXISTS idx_subtasks_run_state ON subtasks(run_id, state);
CREATE INDEX IF NOT EXISTS idx_subtasks_assigned_worker ON subtasks(assigned_worker_id) WHERE assigned_worker_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_subtasks_heartbeat ON subtasks(heartbeat_at) WHERE state = 'running';

-- ============================================================================
-- State Transitions Audit Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS run_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,
    from_state VARCHAR(20) NOT NULL,
    to_state VARCHAR(20) NOT NULL,
    state_version INTEGER NOT NULL,
    transitioned_by VARCHAR(255), -- worker_id or 'orchestrator'
    transition_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_state_transitions_run_id ON run_state_transitions(run_id);
CREATE INDEX IF NOT EXISTS idx_state_transitions_created_at ON run_state_transitions(created_at DESC);

CREATE TABLE IF NOT EXISTS subtask_state_transitions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subtask_id UUID NOT NULL REFERENCES subtasks(id) ON DELETE CASCADE,
    from_state VARCHAR(20) NOT NULL,
    to_state VARCHAR(20) NOT NULL,
    state_version INTEGER NOT NULL,
    transitioned_by VARCHAR(255),
    transition_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subtask_transitions_subtask_id ON subtask_state_transitions(subtask_id);

-- ============================================================================
-- Functions for Orchestrator
-- ============================================================================

-- Acquire fencing token (optimistic locking)
CREATE OR REPLACE FUNCTION acquire_run_fencing_token(
    p_run_id UUID,
    p_fencing_token UUID,
    p_expires_at TIMESTAMPTZ
) RETURNS TABLE(
    acquired BOOLEAN,
    run_data JSONB
) AS $$
DECLARE
    v_run RECORD;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- Try to acquire lock atomically
    UPDATE agent_runs
    SET
        fencing_token = p_fencing_token,
        fencing_expires_at = p_expires_at,
        state_version = state_version + 1
    WHERE
        id = p_run_id
        AND (fencing_token IS NULL OR fencing_expires_at < v_now)
        AND status NOT IN ('completed', 'failed', 'cancelled')
    RETURNING * INTO v_run;

    IF v_run IS NULL THEN
        -- Lock not acquired - return current state for diagnostics
        SELECT row_to_json(r)::JSONB INTO run_data
        FROM (SELECT * FROM agent_runs WHERE id = p_run_id) r;
        RETURN QUERY SELECT FALSE, run_data;
    ELSE
        RETURN QUERY SELECT TRUE, row_to_json(v_run)::JSONB;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Release fencing token
CREATE OR REPLACE FUNCTION release_run_fencing_token(
    p_run_id UUID,
    p_fencing_token UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_rows INTEGER;
BEGIN
    UPDATE agent_runs
    SET
        fencing_token = NULL,
        fencing_expires_at = NULL
    WHERE
        id = p_run_id
        AND fencing_token = p_fencing_token;

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    RETURN v_rows > 0;
END;
$$ LANGUAGE plpgsql;

-- Transition run state with optimistic locking
CREATE OR REPLACE FUNCTION transition_run_state(
    p_run_id UUID,
    p_from_state VARCHAR(20),
    p_to_state VARCHAR(20),
    p_state_version INTEGER,
    p_transitioned_by VARCHAR(255) DEFAULT 'orchestrator',
    p_reason TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_rows INTEGER;
    v_new_version INTEGER;
BEGIN
    v_new_version := p_state_version + 1;

    -- Update with optimistic lock check
    UPDATE agent_runs
    SET
        status = p_to_state,
        state_version = v_new_version,
        last_progress_at = NOW(),
        completed_at = CASE WHEN p_to_state IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE completed_at END
    WHERE
        id = p_run_id
        AND status = p_from_state
        AND state_version = p_state_version;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows > 0 THEN
        -- Record transition
        INSERT INTO run_state_transitions (run_id, from_state, to_state, state_version, transitioned_by, transition_reason)
        VALUES (p_run_id, p_from_state, p_to_state, v_new_version, p_transitioned_by, p_reason);

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Update subtask state with optimistic locking
CREATE OR REPLACE FUNCTION transition_subtask_state(
    p_subtask_id UUID,
    p_from_state VARCHAR(20),
    p_to_state VARCHAR(20),
    p_state_version INTEGER,
    p_transitioned_by VARCHAR(255) DEFAULT 'worker',
    p_reason TEXT DEFAULT NULL,
    p_result_data JSONB DEFAULT NULL,
    p_error TEXT DEFAULT NULL
) RETURNS BOOLEAN AS $$
DECLARE
    v_rows INTEGER;
    v_new_version INTEGER;
    v_run_id UUID;
BEGIN
    v_new_version := p_state_version + 1;

    -- Update with optimistic lock check
    UPDATE subtasks
    SET
        state = p_to_state,
        state_version = v_new_version,
        result_data = COALESCE(p_result_data, result_data),
        last_error = COALESCE(p_error, last_error),
        started_at = CASE WHEN p_to_state = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
        completed_at = CASE WHEN p_to_state IN ('completed', 'failed', 'skipped', 'cancelled') THEN NOW() ELSE completed_at END
    WHERE
        id = p_subtask_id
        AND state = p_from_state
        AND state_version = p_state_version
    RETURNING run_id INTO v_run_id;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows > 0 THEN
        -- Record transition
        INSERT INTO subtask_state_transitions (subtask_id, from_state, to_state, state_version, transitioned_by, transition_reason)
        VALUES (p_subtask_id, p_from_state, p_to_state, v_new_version, p_transitioned_by, p_reason);

        -- Update run progress counters
        IF p_to_state = 'completed' THEN
            UPDATE agent_runs SET completed_subtasks = completed_subtasks + 1, last_progress_at = NOW() WHERE id = v_run_id;
        ELSIF p_to_state = 'failed' THEN
            UPDATE agent_runs SET failed_subtasks = failed_subtasks + 1, last_progress_at = NOW() WHERE id = v_run_id;
        END IF;

        RETURN TRUE;
    END IF;

    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Get subtask counts by state for a run
CREATE OR REPLACE FUNCTION get_subtask_counts_by_state(p_run_id UUID)
RETURNS TABLE(state VARCHAR(20), count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT s.state, COUNT(*)::BIGINT
    FROM subtasks s
    WHERE s.run_id = p_run_id
    GROUP BY s.state;
END;
$$ LANGUAGE plpgsql;

-- Check if subtask dependencies are met
CREATE OR REPLACE FUNCTION check_subtask_ready(p_subtask_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_subtask RECORD;
    v_completed_count INTEGER;
    v_dependency_count INTEGER;
BEGIN
    SELECT * INTO v_subtask FROM subtasks WHERE id = p_subtask_id;

    IF v_subtask IS NULL THEN
        RETURN FALSE;
    END IF;

    -- If no dependencies, ready
    IF array_length(v_subtask.depends_on, 1) IS NULL THEN
        RETURN TRUE;
    END IF;

    v_dependency_count := array_length(v_subtask.depends_on, 1);

    -- Count completed dependencies
    SELECT COUNT(*) INTO v_completed_count
    FROM subtasks
    WHERE id = ANY(v_subtask.depends_on) AND state = 'completed';

    RETURN v_completed_count = v_dependency_count;
END;
$$ LANGUAGE plpgsql;

-- Get stalled runs (no progress for threshold)
CREATE OR REPLACE FUNCTION get_stalled_runs(p_threshold_minutes INTEGER DEFAULT 10)
RETURNS SETOF agent_runs AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM agent_runs
    WHERE
        orchestrator_mode = 'orchestrator'
        AND status NOT IN ('completed', 'failed', 'cancelled')
        AND (last_progress_at < NOW() - (p_threshold_minutes || ' minutes')::INTERVAL
             OR (last_progress_at IS NULL AND created_at < NOW() - (p_threshold_minutes || ' minutes')::INTERVAL));
END;
$$ LANGUAGE plpgsql;

-- Enable RLS
ALTER TABLE subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE run_state_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subtask_state_transitions ENABLE ROW LEVEL SECURITY;

-- RLS policies for subtasks (same as agent_runs)
CREATE POLICY subtasks_select_own ON subtasks FOR SELECT
    USING (run_id IN (SELECT id FROM agent_runs WHERE user_id = auth.uid()));

CREATE POLICY subtasks_service_role ON subtasks FOR ALL
    USING (auth.role() = 'service_role');

-- RLS policies for transitions (read-only for users, full for service)
CREATE POLICY run_transitions_select_own ON run_state_transitions FOR SELECT
    USING (run_id IN (SELECT id FROM agent_runs WHERE user_id = auth.uid()));

CREATE POLICY run_transitions_service_role ON run_state_transitions FOR ALL
    USING (auth.role() = 'service_role');

CREATE POLICY subtask_transitions_select_own ON subtask_state_transitions FOR SELECT
    USING (subtask_id IN (SELECT id FROM subtasks WHERE run_id IN (SELECT id FROM agent_runs WHERE user_id = auth.uid())));

CREATE POLICY subtask_transitions_service_role ON subtask_state_transitions FOR ALL
    USING (auth.role() = 'service_role');

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE subtasks IS 'Subtasks for parallel execution within orchestrator runs';
COMMENT ON TABLE run_state_transitions IS 'Audit trail of run state transitions';
COMMENT ON TABLE subtask_state_transitions IS 'Audit trail of subtask state transitions';
COMMENT ON COLUMN agent_runs.state_version IS 'Optimistic locking version for concurrent safety';
COMMENT ON COLUMN agent_runs.fencing_token IS 'Fencing token for exclusive processing';
COMMENT ON COLUMN agent_runs.orchestrator_mode IS 'legacy = old supervisor, orchestrator = new orchestrator';
