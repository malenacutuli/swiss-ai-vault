-- Checkpoint History for Run Resumption
-- Stores full checkpoint history for version control and restoration

-- Table: checkpoint_history
CREATE TABLE IF NOT EXISTS checkpoint_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,

  -- Checkpoint metadata
  version INTEGER NOT NULL DEFAULT 1,
  step_number INTEGER NOT NULL DEFAULT 0,
  checkpoint_type TEXT NOT NULL DEFAULT 'manual', -- 'manual', 'auto', 'pre_tool', 'post_step'

  -- Checkpoint data
  state_snapshot JSONB NOT NULL DEFAULT '{}',
  context_snapshot JSONB DEFAULT '{}',
  messages_snapshot JSONB DEFAULT '[]',

  -- Execution context at checkpoint
  tokens_used INTEGER DEFAULT 0,
  credits_charged BIGINT DEFAULT 0,
  execution_time_ms INTEGER DEFAULT 0,

  -- Metadata
  description TEXT,
  is_valid BOOLEAN DEFAULT TRUE,
  validated_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_checkpoint_history_run ON checkpoint_history(run_id);
CREATE INDEX IF NOT EXISTS idx_checkpoint_history_version ON checkpoint_history(run_id, version);
CREATE INDEX IF NOT EXISTS idx_checkpoint_history_type ON checkpoint_history(checkpoint_type);

-- Enable RLS
ALTER TABLE checkpoint_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'checkpoint_history' AND policyname = 'Users see own checkpoints') THEN
    CREATE POLICY "Users see own checkpoints"
    ON checkpoint_history FOR SELECT
    USING (
      run_id IN (SELECT id FROM agent_runs WHERE user_id = auth.uid())
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'checkpoint_history' AND policyname = 'Service role full access checkpoints') THEN
    CREATE POLICY "Service role full access checkpoints"
    ON checkpoint_history FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');
  END IF;
END $$;

-- Function: Create versioned checkpoint
CREATE OR REPLACE FUNCTION create_versioned_checkpoint(
  p_run_id UUID,
  p_step_number INTEGER,
  p_checkpoint_type TEXT,
  p_state_snapshot JSONB,
  p_context_snapshot JSONB DEFAULT '{}',
  p_messages_snapshot JSONB DEFAULT '[]',
  p_description TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_version INTEGER;
  v_checkpoint_id UUID;
  v_run RECORD;
BEGIN
  -- Get current run state
  SELECT * INTO v_run FROM agent_runs WHERE id = p_run_id;

  IF v_run IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Run not found');
  END IF;

  -- Get next version number
  SELECT COALESCE(MAX(version), 0) + 1 INTO v_version
  FROM checkpoint_history
  WHERE run_id = p_run_id;

  -- Create checkpoint record
  INSERT INTO checkpoint_history (
    run_id,
    version,
    step_number,
    checkpoint_type,
    state_snapshot,
    context_snapshot,
    messages_snapshot,
    tokens_used,
    credits_charged,
    execution_time_ms,
    description
  ) VALUES (
    p_run_id,
    v_version,
    p_step_number,
    p_checkpoint_type,
    p_state_snapshot,
    p_context_snapshot,
    p_messages_snapshot,
    COALESCE(v_run.tokens_used, 0),
    COALESCE(v_run.credits_charged, 0),
    COALESCE(v_run.execution_time_ms, 0),
    p_description
  ) RETURNING id INTO v_checkpoint_id;

  -- Update run's current checkpoint
  UPDATE agent_runs
  SET
    checkpoint_data = p_state_snapshot,
    checkpoint_step = p_step_number,
    checkpoint_at = NOW(),
    updated_at = NOW()
  WHERE id = p_run_id;

  -- Log checkpoint event
  INSERT INTO agent_run_events (run_id, event_type, triggered_by, event_data)
  VALUES (p_run_id, 'checkpoint', 'system', jsonb_build_object(
    'checkpoint_id', v_checkpoint_id,
    'version', v_version,
    'step', p_step_number,
    'type', p_checkpoint_type
  ));

  RETURN jsonb_build_object(
    'success', true,
    'checkpoint_id', v_checkpoint_id,
    'version', v_version,
    'step_number', p_step_number
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Restore from checkpoint
CREATE OR REPLACE FUNCTION restore_from_checkpoint(
  p_run_id UUID,
  p_checkpoint_version INTEGER DEFAULT NULL -- NULL = latest valid checkpoint
) RETURNS JSONB AS $$
DECLARE
  v_checkpoint RECORD;
  v_run RECORD;
BEGIN
  -- Get run
  SELECT * INTO v_run FROM agent_runs WHERE id = p_run_id;

  IF v_run IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Run not found');
  END IF;

  -- Run must be in a resumable state
  IF v_run.state NOT IN ('paused', 'failed', 'timeout') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Run must be paused, failed, or timeout to restore');
  END IF;

  -- Get checkpoint
  IF p_checkpoint_version IS NOT NULL THEN
    SELECT * INTO v_checkpoint
    FROM checkpoint_history
    WHERE run_id = p_run_id AND version = p_checkpoint_version AND is_valid = TRUE;
  ELSE
    -- Get latest valid checkpoint
    SELECT * INTO v_checkpoint
    FROM checkpoint_history
    WHERE run_id = p_run_id AND is_valid = TRUE
    ORDER BY version DESC
    LIMIT 1;
  END IF;

  IF v_checkpoint IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No valid checkpoint found');
  END IF;

  -- Restore checkpoint data to run
  UPDATE agent_runs
  SET
    checkpoint_data = v_checkpoint.state_snapshot,
    checkpoint_step = v_checkpoint.step_number,
    checkpoint_at = v_checkpoint.created_at,
    -- Don't reset these - preserve history
    updated_at = NOW()
  WHERE id = p_run_id;

  -- Log restoration event
  INSERT INTO agent_run_events (run_id, event_type, triggered_by, event_data)
  VALUES (p_run_id, 'checkpoint_restored', 'user', jsonb_build_object(
    'restored_version', v_checkpoint.version,
    'restored_step', v_checkpoint.step_number,
    'original_state', v_run.state
  ));

  RETURN jsonb_build_object(
    'success', true,
    'restored_version', v_checkpoint.version,
    'restored_step', v_checkpoint.step_number,
    'state_snapshot', v_checkpoint.state_snapshot,
    'context_snapshot', v_checkpoint.context_snapshot,
    'messages_snapshot', v_checkpoint.messages_snapshot
  );
END;
$$ LANGUAGE plpgsql;

-- Function: Get checkpoint history
CREATE OR REPLACE FUNCTION get_checkpoint_history(
  p_run_id UUID,
  p_limit INTEGER DEFAULT 20
) RETURNS JSONB AS $$
DECLARE
  v_checkpoints JSONB;
BEGIN
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', id,
      'version', version,
      'step_number', step_number,
      'checkpoint_type', checkpoint_type,
      'tokens_used', tokens_used,
      'execution_time_ms', execution_time_ms,
      'description', description,
      'is_valid', is_valid,
      'created_at', created_at
    ) ORDER BY version DESC
  ) INTO v_checkpoints
  FROM (
    SELECT *
    FROM checkpoint_history
    WHERE run_id = p_run_id
    ORDER BY version DESC
    LIMIT p_limit
  ) sub;

  RETURN COALESCE(v_checkpoints, '[]'::JSONB);
END;
$$ LANGUAGE plpgsql;

-- Function: Invalidate checkpoint
CREATE OR REPLACE FUNCTION invalidate_checkpoint(
  p_checkpoint_id UUID,
  p_reason TEXT DEFAULT 'manual_invalidation'
) RETURNS JSONB AS $$
BEGIN
  UPDATE checkpoint_history
  SET
    is_valid = FALSE,
    validated_at = NOW()
  WHERE id = p_checkpoint_id;

  RETURN jsonb_build_object('success', true, 'invalidated', p_checkpoint_id);
END;
$$ LANGUAGE plpgsql;

-- Add auto_checkpoint config to agent_runs if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_runs' AND column_name = 'auto_checkpoint_interval') THEN
    ALTER TABLE agent_runs ADD COLUMN auto_checkpoint_interval INTEGER DEFAULT 5; -- every 5 steps
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agent_runs' AND column_name = 'auto_checkpoint_enabled') THEN
    ALTER TABLE agent_runs ADD COLUMN auto_checkpoint_enabled BOOLEAN DEFAULT TRUE;
  END IF;
END $$;

-- Comments
COMMENT ON TABLE checkpoint_history IS 'Version-controlled checkpoint history for run resumption';
COMMENT ON FUNCTION create_versioned_checkpoint(UUID, INTEGER, TEXT, JSONB, JSONB, JSONB, TEXT) IS 'Create a new versioned checkpoint';
COMMENT ON FUNCTION restore_from_checkpoint(UUID, INTEGER) IS 'Restore run state from a checkpoint';
COMMENT ON FUNCTION get_checkpoint_history(UUID, INTEGER) IS 'Get checkpoint history for a run';
