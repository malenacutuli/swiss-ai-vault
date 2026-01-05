-- ============================================
-- 1. Clean up stuck tasks
-- ============================================
UPDATE agent_tasks
SET status = 'failed',
    error_message = 'Task timeout - cleaned up automatically',
    completed_at = NOW()
WHERE status IN ('executing', 'planning')
  AND created_at < NOW() - INTERVAL '30 minutes';

-- ============================================
-- 2. Ensure all required columns exist
-- ============================================
ALTER TABLE agent_tasks
ADD COLUMN IF NOT EXISTS progress_percentage INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_step INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_steps INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS result_summary TEXT,
ADD COLUMN IF NOT EXISTS model_used TEXT,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS plan_summary TEXT,
ADD COLUMN IF NOT EXISTS plan_json JSONB,
ADD COLUMN IF NOT EXISTS knowledge_sources JSONB;

ALTER TABLE agent_task_steps
ADD COLUMN IF NOT EXISTS file_actions JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS current_action TEXT,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS duration_ms INTEGER,
ADD COLUMN IF NOT EXISTS step_type TEXT;

-- ============================================
-- 3. Make all templates public
-- ============================================
UPDATE action_templates SET is_public = true WHERE is_public = false;

-- ============================================
-- 4. Enable realtime for live updates
-- ============================================
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE agent_tasks;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;

DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE agent_task_steps;
EXCEPTION WHEN duplicate_object THEN
  NULL;
END $$;