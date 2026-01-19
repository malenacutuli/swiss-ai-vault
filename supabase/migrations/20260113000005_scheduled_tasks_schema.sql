-- =============================================
-- SCHEDULED TASKS SCHEMA
-- Cron-based task scheduling
-- =============================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS scheduled_task_runs CASCADE;
DROP TABLE IF EXISTS scheduled_tasks CASCADE;

-- =============================================
-- SCHEDULED TASKS TABLE
-- =============================================

CREATE TABLE scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Task definition
  name TEXT NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  mode agent_mode NOT NULL DEFAULT 'chat',
  config JSONB DEFAULT '{}',

  -- Schedule
  schedule_type TEXT NOT NULL CHECK (schedule_type IN ('cron', 'interval', 'once')),
  cron_expression TEXT, -- For cron type: "0 9 * * 1-5" (weekdays at 9am)
  interval_seconds INTEGER, -- For interval type
  run_at TIMESTAMPTZ, -- For once type
  timezone TEXT DEFAULT 'UTC',

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_paused BOOLEAN DEFAULT FALSE,

  -- Execution tracking
  last_run_at TIMESTAMPTZ,
  last_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,
  last_run_status TEXT,
  next_run_at TIMESTAMPTZ,

  -- Statistics
  total_runs INTEGER DEFAULT 0,
  successful_runs INTEGER DEFAULT 0,
  failed_runs INTEGER DEFAULT 0,
  total_credits_used DECIMAL(10,4) DEFAULT 0,

  -- Limits
  max_runs INTEGER, -- NULL = unlimited
  max_consecutive_failures INTEGER DEFAULT 5,
  consecutive_failures INTEGER DEFAULT 0,

  -- Notification
  notify_on_failure BOOLEAN DEFAULT TRUE,
  notify_on_success BOOLEAN DEFAULT FALSE,
  notification_email TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user_id ON scheduled_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_active ON scheduled_tasks(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at) WHERE is_active = TRUE AND is_paused = FALSE;

-- =============================================
-- SCHEDULED TASK RUNS TABLE
-- History of scheduled task executions
-- =============================================

CREATE TABLE scheduled_task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,

  -- Execution
  scheduled_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'running', 'completed', 'failed', 'skipped', 'cancelled'
  )),

  -- Result
  credits_used DECIMAL(10,4) DEFAULT 0,
  error_message TEXT,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_task_id ON scheduled_task_runs(task_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_status ON scheduled_task_runs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_scheduled_at ON scheduled_task_runs(scheduled_at DESC);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_task_runs ENABLE ROW LEVEL SECURITY;

-- scheduled_tasks
CREATE POLICY "Users can view own tasks"
  ON scheduled_tasks FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own tasks"
  ON scheduled_tasks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tasks"
  ON scheduled_tasks FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own tasks"
  ON scheduled_tasks FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to tasks"
  ON scheduled_tasks FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- scheduled_task_runs
CREATE POLICY "Users can view runs of own tasks"
  ON scheduled_task_runs FOR SELECT
  USING (task_id IN (SELECT id FROM scheduled_tasks WHERE user_id = auth.uid()));

CREATE POLICY "Service role has full access to runs"
  ON scheduled_task_runs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to calculate next run time from cron expression
-- Note: Full cron parsing should be done in application code
-- This is a simplified version for common patterns
CREATE OR REPLACE FUNCTION calculate_next_run(
  p_schedule_type TEXT,
  p_cron_expression TEXT,
  p_interval_seconds INTEGER,
  p_run_at TIMESTAMPTZ,
  p_timezone TEXT DEFAULT 'UTC'
)
RETURNS TIMESTAMPTZ AS $$
BEGIN
  CASE p_schedule_type
    WHEN 'once' THEN
      RETURN p_run_at;
    WHEN 'interval' THEN
      RETURN NOW() + (p_interval_seconds || ' seconds')::INTERVAL;
    WHEN 'cron' THEN
      -- Simplified: return next hour for now
      -- Full cron parsing should be done in application
      RETURN date_trunc('hour', NOW() AT TIME ZONE p_timezone) + INTERVAL '1 hour';
    ELSE
      RETURN NULL;
  END CASE;
END;
$$ LANGUAGE plpgsql;

-- Function to update task statistics after run
CREATE OR REPLACE FUNCTION update_scheduled_task_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' THEN
    UPDATE scheduled_tasks
    SET
      last_run_at = NEW.completed_at,
      last_run_id = NEW.run_id,
      last_run_status = NEW.status,
      total_runs = total_runs + 1,
      successful_runs = successful_runs + 1,
      consecutive_failures = 0,
      total_credits_used = total_credits_used + COALESCE(NEW.credits_used, 0),
      updated_at = NOW()
    WHERE id = NEW.task_id;
  ELSIF NEW.status = 'failed' THEN
    UPDATE scheduled_tasks
    SET
      last_run_at = NEW.completed_at,
      last_run_id = NEW.run_id,
      last_run_status = NEW.status,
      total_runs = total_runs + 1,
      failed_runs = failed_runs + 1,
      consecutive_failures = consecutive_failures + 1,
      total_credits_used = total_credits_used + COALESCE(NEW.credits_used, 0),
      -- Auto-pause after max consecutive failures
      is_paused = CASE
        WHEN consecutive_failures + 1 >= max_consecutive_failures THEN TRUE
        ELSE is_paused
      END,
      updated_at = NOW()
    WHERE id = NEW.task_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for stats update
DROP TRIGGER IF EXISTS trigger_update_scheduled_task_stats ON scheduled_task_runs;
CREATE TRIGGER trigger_update_scheduled_task_stats
  AFTER UPDATE OF status ON scheduled_task_runs
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'failed'))
  EXECUTE FUNCTION update_scheduled_task_stats();
