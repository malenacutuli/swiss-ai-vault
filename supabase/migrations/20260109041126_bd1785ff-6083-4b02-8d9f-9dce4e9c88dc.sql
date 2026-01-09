-- Agent instances table for tracking running agents
CREATE TABLE IF NOT EXISTS agent_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT DEFAULT 'idle' CHECK (status IN ('idle', 'busy', 'waiting', 'error', 'terminated')),
  current_subtask TEXT,
  metrics JSONB DEFAULT '{"tasksCompleted": 0, "tasksFailed": 0, "avgDurationMs": 0}'::jsonb,
  last_heartbeat TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent messages table for inter-agent communication logging
CREATE TABLE IF NOT EXISTS agent_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  message_type TEXT NOT NULL,
  priority TEXT DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'critical')),
  sender TEXT NOT NULL,
  sender_role TEXT,
  recipient TEXT,
  recipient_role TEXT,
  payload JSONB,
  correlation_id UUID,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_agent_instances_task ON agent_instances(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_instances_status ON agent_instances(status);
CREATE INDEX IF NOT EXISTS idx_agent_instances_role ON agent_instances(role);
CREATE INDEX IF NOT EXISTS idx_agent_instances_heartbeat ON agent_instances(last_heartbeat);
CREATE INDEX IF NOT EXISTS idx_agent_messages_task ON agent_messages(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_type ON agent_messages(message_type);
CREATE INDEX IF NOT EXISTS idx_agent_messages_sender ON agent_messages(sender);
CREATE INDEX IF NOT EXISTS idx_agent_messages_correlation ON agent_messages(correlation_id);
CREATE INDEX IF NOT EXISTS idx_agent_messages_created ON agent_messages(created_at DESC);

-- Enable RLS
ALTER TABLE agent_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_messages ENABLE ROW LEVEL SECURITY;

-- RLS policies for agent_instances
CREATE POLICY "Users can view instances for their tasks"
  ON agent_instances FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM agent_tasks WHERE agent_tasks.id = agent_instances.task_id AND agent_tasks.user_id = auth.uid()
  ));

CREATE POLICY "System can insert agent instances"
  ON agent_instances FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM agent_tasks WHERE agent_tasks.id = agent_instances.task_id AND agent_tasks.user_id = auth.uid()
  ));

CREATE POLICY "System can update agent instances"
  ON agent_instances FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM agent_tasks WHERE agent_tasks.id = agent_instances.task_id AND agent_tasks.user_id = auth.uid()
  ));

-- RLS policies for agent_messages
CREATE POLICY "Users can view messages for their tasks"
  ON agent_messages FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM agent_tasks WHERE agent_tasks.id = agent_messages.task_id AND agent_tasks.user_id = auth.uid()
  ));

CREATE POLICY "System can insert agent messages"
  ON agent_messages FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM agent_tasks WHERE agent_tasks.id = agent_messages.task_id AND agent_tasks.user_id = auth.uid()
  ));

-- Function to cleanup stale agent instances
CREATE OR REPLACE FUNCTION cleanup_stale_agents()
RETURNS INTEGER AS $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  UPDATE agent_instances
  SET status = 'terminated', updated_at = NOW()
  WHERE status IN ('idle', 'busy', 'waiting')
    AND last_heartbeat < NOW() - INTERVAL '5 minutes';
  
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  RETURN cleaned_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_agent_instances_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_instances_timestamp
  BEFORE UPDATE ON agent_instances
  FOR EACH ROW
  EXECUTE FUNCTION update_agent_instances_updated_at();