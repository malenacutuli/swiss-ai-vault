-- Enable Supabase Realtime on agent tables
-- This allows frontend to subscribe to changes instead of polling

-- Enable realtime for agent_runs (task status updates)
ALTER PUBLICATION supabase_realtime ADD TABLE agent_runs;

-- Enable realtime for agent_task_logs (execution logs)
ALTER PUBLICATION supabase_realtime ADD TABLE agent_task_logs;

-- Enable realtime for agent_steps (step progress)
ALTER PUBLICATION supabase_realtime ADD TABLE agent_steps;

-- Enable realtime for agent_artifacts (output files)
ALTER PUBLICATION supabase_realtime ADD TABLE agent_artifacts;

-- Enable realtime for agent_messages (conversation updates)
ALTER PUBLICATION supabase_realtime ADD TABLE agent_messages;

-- Create index for faster realtime filtering by run_id
CREATE INDEX IF NOT EXISTS idx_agent_task_logs_run_id_created
  ON agent_task_logs(run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_steps_run_id_created
  ON agent_steps(run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_artifacts_run_id_created
  ON agent_artifacts(run_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_agent_messages_run_id_created
  ON agent_messages(run_id, created_at DESC);

-- Add comment for documentation
COMMENT ON TABLE agent_runs IS 'Agent task runs with realtime enabled for status updates';
COMMENT ON TABLE agent_task_logs IS 'Agent execution logs with realtime enabled for live streaming';
COMMENT ON TABLE agent_steps IS 'Agent execution steps with realtime enabled for progress tracking';
