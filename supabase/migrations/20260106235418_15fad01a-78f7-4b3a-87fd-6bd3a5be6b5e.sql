-- Agent task logs table for live terminal view
CREATE TABLE IF NOT EXISTS agent_task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  log_type TEXT DEFAULT 'stdout' CHECK (log_type IN ('stdout', 'stderr', 'system')),
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  sequence_number SERIAL
);

-- Index for fast polling
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON agent_task_logs(task_id, sequence_number);

-- Storage bucket for agent outputs
INSERT INTO storage.buckets (id, name, public) 
VALUES ('agent-outputs', 'agent-outputs', true) 
ON CONFLICT (id) DO NOTHING;

-- RLS policies for agent_task_logs
ALTER TABLE agent_task_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own task logs" ON agent_task_logs 
FOR SELECT USING (
  task_id IN (SELECT id FROM agent_tasks WHERE user_id = auth.uid())
);

CREATE POLICY "Service role insert logs" ON agent_task_logs 
FOR INSERT WITH CHECK (true);