-- Add missing columns for execution tracking (IF NOT EXISTS handles already-present columns)
ALTER TABLE agent_task_steps 
ADD COLUMN IF NOT EXISTS file_actions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS current_action TEXT,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

ALTER TABLE agent_tasks
ADD COLUMN IF NOT EXISTS model_used TEXT,
ADD COLUMN IF NOT EXISTS total_steps INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS result_summary TEXT,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- Ensure RLS policies exist (drop and recreate)
DROP POLICY IF EXISTS "Users own their tasks" ON agent_tasks;
DROP POLICY IF EXISTS "Users own their task steps" ON agent_task_steps;
DROP POLICY IF EXISTS "Users own their outputs" ON agent_outputs;

CREATE POLICY "Users own their tasks" ON agent_tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their task steps" ON agent_task_steps
  FOR ALL USING (
    task_id IN (SELECT id FROM agent_tasks WHERE user_id = auth.uid())
  );

CREATE POLICY "Users own their outputs" ON agent_outputs
  FOR ALL USING (
    task_id IN (SELECT id FROM agent_tasks WHERE user_id = auth.uid())
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_agent_tasks_user_status ON agent_tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_created ON agent_tasks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_task_steps_task ON agent_task_steps(task_id, step_number);
CREATE INDEX IF NOT EXISTS idx_action_templates_public ON action_templates(is_public, category);

-- Grant realtime access for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_task_steps;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_outputs;