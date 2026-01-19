-- =============================================
-- AGENT TASK LOGS TABLE
-- Comprehensive logging for agent execution
-- =============================================

CREATE TABLE IF NOT EXISTS agent_task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES agent_runs(id) ON DELETE CASCADE,

  -- Log details
  log_type TEXT NOT NULL CHECK (log_type IN (
    'info',
    'success',
    'error',
    'warning',
    'state_transition',
    'tool_success',
    'tool_error',
    'phase_advance',
    'user_input_required'
  )),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_task_logs_run_id ON agent_task_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_agent_task_logs_type ON agent_task_logs(log_type);
CREATE INDEX IF NOT EXISTS idx_agent_task_logs_created_at ON agent_task_logs(created_at DESC);

-- RLS
ALTER TABLE agent_task_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view logs of own runs"
  ON agent_task_logs FOR SELECT
  USING (run_id IN (SELECT id FROM agent_runs WHERE user_id = auth.uid()));

CREATE POLICY "Service role has full access"
  ON agent_task_logs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');
