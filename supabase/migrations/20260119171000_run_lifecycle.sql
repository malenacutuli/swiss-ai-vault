-- Run Lifecycle State Machine for Manus Parity
-- Full state machine with pause, resume, retry, checkpointing
-- Modified to ALTER existing agent_runs table

-- Create enum for run states (if not exists)
DO $$ BEGIN
  CREATE TYPE run_state AS ENUM (
    'created',
    'pending',
    'running',
    'paused',
    'resuming',
    'retrying',
    'completed',
    'failed',
    'cancelled',
    'timeout'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add new columns to existing agent_runs table
DO $$
BEGIN
  -- State machine columns
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'state') THEN
    ALTER TABLE agent_runs ADD COLUMN state TEXT DEFAULT 'created';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'previous_state') THEN
    ALTER TABLE agent_runs ADD COLUMN previous_state TEXT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'state_changed_at') THEN
    ALTER TABLE agent_runs ADD COLUMN state_changed_at TIMESTAMPTZ DEFAULT NOW();
  END IF;

  -- Execution tracking
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'paused_at') THEN
    ALTER TABLE agent_runs ADD COLUMN paused_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'resumed_at') THEN
    ALTER TABLE agent_runs ADD COLUMN resumed_at TIMESTAMPTZ;
  END IF;

  -- Retry management
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'retry_count') THEN
    ALTER TABLE agent_runs ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'max_retries') THEN
    ALTER TABLE agent_runs ADD COLUMN max_retries INTEGER DEFAULT 3;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'retry_delay_ms') THEN
    ALTER TABLE agent_runs ADD COLUMN retry_delay_ms INTEGER DEFAULT 1000;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'last_retry_at') THEN
    ALTER TABLE agent_runs ADD COLUMN last_retry_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'retry_reason') THEN
    ALTER TABLE agent_runs ADD COLUMN retry_reason TEXT;
  END IF;

  -- Timeout management
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'timeout_ms') THEN
    ALTER TABLE agent_runs ADD COLUMN timeout_ms INTEGER DEFAULT 300000;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'timeout_at') THEN
    ALTER TABLE agent_runs ADD COLUMN timeout_at TIMESTAMPTZ;
  END IF;

  -- Checkpointing
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'checkpoint_data') THEN
    ALTER TABLE agent_runs ADD COLUMN checkpoint_data JSONB;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'checkpoint_at') THEN
    ALTER TABLE agent_runs ADD COLUMN checkpoint_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'checkpoint_step') THEN
    ALTER TABLE agent_runs ADD COLUMN checkpoint_step INTEGER DEFAULT 0;
  END IF;

  -- Resource usage
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'credits_charged') THEN
    ALTER TABLE agent_runs ADD COLUMN credits_charged BIGINT DEFAULT 0;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'execution_time_ms') THEN
    ALTER TABLE agent_runs ADD COLUMN execution_time_ms INTEGER DEFAULT 0;
  END IF;

  -- Task config
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'task_config') THEN
    ALTER TABLE agent_runs ADD COLUMN task_config JSONB DEFAULT '{}';
  END IF;
END $$;

-- Table: agent_run_steps - Individual steps within a run
CREATE TABLE IF NOT EXISTS agent_run_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,

  -- Step information
  step_number INTEGER NOT NULL,
  step_type TEXT NOT NULL, -- 'tool_call', 'llm_inference', 'checkpoint', 'human_input'
  step_name TEXT,

  -- State
  state TEXT DEFAULT 'pending' CHECK (state IN (
    'pending', 'running', 'completed', 'failed', 'skipped'
  )),

  -- Input/Output
  input JSONB,
  output JSONB,
  error TEXT,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Checkpoint data for this step
  checkpoint_data JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table: agent_run_events - Event log for runs
CREATE TABLE IF NOT EXISTS agent_run_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,

  -- Event information
  event_type TEXT NOT NULL, -- 'state_change', 'checkpoint', 'error', 'retry', 'timeout'
  event_data JSONB DEFAULT '{}',

  -- State transition
  from_state TEXT,
  to_state TEXT,

  -- Actor
  triggered_by TEXT, -- 'system', 'user', 'timeout', 'error'
  user_id UUID,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (only create if column exists)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_runs' AND column_name = 'state') THEN
    CREATE INDEX IF NOT EXISTS idx_agent_runs_state ON agent_runs(state);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agent_run_steps_run ON agent_run_steps(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_run_steps_state ON agent_run_steps(state);
CREATE INDEX IF NOT EXISTS idx_agent_run_events_run ON agent_run_events(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_run_events_type ON agent_run_events(event_type);

-- Enable RLS on new tables
ALTER TABLE agent_run_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_run_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_run_steps
CREATE POLICY "Users see own run steps"
ON agent_run_steps FOR SELECT
USING (
  run_id IN (SELECT id FROM agent_runs WHERE user_id = auth.uid())
);

CREATE POLICY "Service role full access steps"
ON agent_run_steps FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for agent_run_events
CREATE POLICY "Users see own run events"
ON agent_run_events FOR SELECT
USING (
  run_id IN (SELECT id FROM agent_runs WHERE user_id = auth.uid())
);

CREATE POLICY "Service role full access events"
ON agent_run_events FOR ALL
USING (auth.jwt() ->> 'role' = 'service_role');

-- Drop existing functions if they exist (with different signatures)
DROP FUNCTION IF EXISTS validate_run_state_transition(TEXT, TEXT);
DROP FUNCTION IF EXISTS transition_run_state(UUID, TEXT, TEXT, JSONB);
DROP FUNCTION IF EXISTS create_run_checkpoint(UUID, JSONB, INTEGER);

-- Function: Validate state transition
CREATE OR REPLACE FUNCTION validate_run_state_transition(
  current_state TEXT,
  new_state TEXT
) RETURNS BOOLEAN AS $$
DECLARE
  valid_transitions JSONB := '{
    "created": ["pending", "cancelled"],
    "pending": ["running", "cancelled"],
    "running": ["completed", "failed", "paused", "cancelled", "timeout"],
    "paused": ["resuming", "cancelled"],
    "resuming": ["running", "failed", "cancelled"],
    "retrying": ["running", "failed", "cancelled"],
    "completed": [],
    "failed": ["retrying"],
    "cancelled": [],
    "timeout": ["retrying"]
  }'::JSONB;
  allowed_states JSONB;
BEGIN
  allowed_states := valid_transitions -> current_state;
  RETURN allowed_states ? new_state;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function: Transition run state
CREATE OR REPLACE FUNCTION transition_run_state(
  p_run_id UUID,
  p_new_state TEXT,
  p_triggered_by TEXT DEFAULT 'system',
  p_event_data JSONB DEFAULT '{}'
) RETURNS JSONB AS $$
DECLARE
  v_current_state TEXT;
  v_user_id UUID;
  v_result JSONB;
BEGIN
  -- Get current state
  SELECT state, user_id INTO v_current_state, v_user_id
  FROM agent_runs WHERE id = p_run_id;

  IF v_current_state IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Run not found');
  END IF;

  -- Validate transition
  IF NOT validate_run_state_transition(v_current_state, p_new_state) THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', format('Invalid transition from %s to %s', v_current_state, p_new_state)
    );
  END IF;

  -- Update run state
  UPDATE agent_runs
  SET
    previous_state = state,
    state = p_new_state,
    state_changed_at = NOW(),
    updated_at = NOW(),
    started_at = CASE WHEN p_new_state = 'running' AND started_at IS NULL THEN NOW() ELSE started_at END,
    completed_at = CASE WHEN p_new_state IN ('completed', 'failed', 'cancelled', 'timeout') THEN NOW() ELSE completed_at END,
    paused_at = CASE WHEN p_new_state = 'paused' THEN NOW() ELSE paused_at END,
    resumed_at = CASE WHEN p_new_state = 'resuming' THEN NOW() ELSE resumed_at END,
    last_retry_at = CASE WHEN p_new_state = 'retrying' THEN NOW() ELSE last_retry_at END,
    retry_count = CASE WHEN p_new_state = 'retrying' THEN COALESCE(retry_count, 0) + 1 ELSE retry_count END
  WHERE id = p_run_id;

  -- Log event
  INSERT INTO agent_run_events (run_id, event_type, from_state, to_state, triggered_by, user_id, event_data)
  VALUES (p_run_id, 'state_change', v_current_state, p_new_state, p_triggered_by, v_user_id, p_event_data);

  RETURN jsonb_build_object(
    'success', true,
    'run_id', p_run_id,
    'previous_state', v_current_state,
    'new_state', p_new_state
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Create checkpoint
CREATE OR REPLACE FUNCTION create_run_checkpoint(
  p_run_id UUID,
  p_checkpoint_data JSONB,
  p_step INTEGER DEFAULT 0
) RETURNS JSONB AS $$
BEGIN
  UPDATE agent_runs
  SET
    checkpoint_data = p_checkpoint_data,
    checkpoint_at = NOW(),
    checkpoint_step = p_step,
    updated_at = NOW()
  WHERE id = p_run_id;

  -- Log checkpoint event
  INSERT INTO agent_run_events (run_id, event_type, triggered_by, event_data)
  VALUES (p_run_id, 'checkpoint', 'system', jsonb_build_object(
    'step', p_step,
    'checkpoint_at', NOW()
  ));

  RETURN jsonb_build_object('success', true, 'checkpoint_step', p_step);
END;
$$ LANGUAGE plpgsql;

-- Comments
COMMENT ON TABLE agent_run_steps IS 'Individual steps within an agent run';
COMMENT ON TABLE agent_run_events IS 'Event log for run state changes and checkpoints';
COMMENT ON FUNCTION transition_run_state(UUID, TEXT, TEXT, JSONB) IS 'Safely transition run state with validation and event logging';
COMMENT ON FUNCTION create_run_checkpoint(UUID, JSONB, INTEGER) IS 'Create a checkpoint for run resumption';
