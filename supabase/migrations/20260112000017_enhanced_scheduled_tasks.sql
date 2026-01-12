-- Enhanced scheduled tasks with task types and better tracking
-- This builds on the existing scheduled_tasks table

-- Add new columns to existing scheduled_tasks table
ALTER TABLE scheduled_tasks
ADD COLUMN IF NOT EXISTS task_type VARCHAR(50) DEFAULT 'agent'
  CHECK (task_type IN ('agent', 'webhook', 'email', 'backup'));

ALTER TABLE scheduled_tasks
ADD COLUMN IF NOT EXISTS error_count INTEGER DEFAULT 0;

ALTER TABLE scheduled_tasks
ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Task execution history with duration tracking
CREATE TABLE IF NOT EXISTS task_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status VARCHAR(20) DEFAULT 'running' CHECK (status IN ('running', 'completed', 'failed', 'cancelled')),
  result JSONB,
  error_message TEXT,
  duration_ms INTEGER
);

CREATE INDEX IF NOT EXISTS idx_task_executions_task ON task_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_task_executions_started ON task_executions(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_task_executions_status ON task_executions(status);

-- RLS for task_executions
ALTER TABLE task_executions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own task executions" ON task_executions
  FOR SELECT USING (
    task_id IN (SELECT id FROM scheduled_tasks WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access task executions" ON task_executions
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Enhanced calculate_next_run with more cron patterns
CREATE OR REPLACE FUNCTION calculate_next_run_enhanced(
  p_schedule VARCHAR,
  p_timezone VARCHAR DEFAULT 'UTC',
  p_from TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_parts TEXT[];
  v_next TIMESTAMPTZ;
  v_base TIMESTAMPTZ;
BEGIN
  v_base := p_from AT TIME ZONE p_timezone;

  -- Handle common cron patterns
  CASE p_schedule
    -- Every hour
    WHEN '0 * * * *' THEN
      v_next := date_trunc('hour', v_base) + INTERVAL '1 hour';

    -- Daily at midnight
    WHEN '0 0 * * *' THEN
      v_next := date_trunc('day', v_base) + INTERVAL '1 day';

    -- Daily at specific time (e.g., 9:00 AM)
    WHEN '0 9 * * *' THEN
      v_next := date_trunc('day', v_base) + INTERVAL '9 hours';
      IF v_next <= v_base THEN
        v_next := v_next + INTERVAL '1 day';
      END IF;

    -- Weekly on Monday
    WHEN '0 0 * * 1' THEN
      v_next := date_trunc('week', v_base) + INTERVAL '1 week';

    -- Monthly on 1st
    WHEN '0 0 1 * *' THEN
      v_next := date_trunc('month', v_base) + INTERVAL '1 month';

    -- Every 15 minutes
    WHEN '*/15 * * * *' THEN
      v_next := date_trunc('hour', v_base) +
                (EXTRACT(MINUTE FROM v_base)::INTEGER / 15 + 1) * INTERVAL '15 minutes';

    -- Every 30 minutes
    WHEN '*/30 * * * *' THEN
      v_next := date_trunc('hour', v_base) +
                (EXTRACT(MINUTE FROM v_base)::INTEGER / 30 + 1) * INTERVAL '30 minutes';

    ELSE
      -- Default: use existing simple parser
      v_next := calculate_next_run(p_schedule, p_timezone);
  END CASE;

  RETURN v_next AT TIME ZONE p_timezone;
END;
$$ LANGUAGE plpgsql;

-- Function to get due tasks with row locking
CREATE OR REPLACE FUNCTION get_due_tasks(p_limit INTEGER DEFAULT 10)
RETURNS TABLE (
  task_id UUID,
  user_id UUID,
  task_type VARCHAR,
  config JSONB,
  error_count INTEGER
) AS $$
BEGIN
  RETURN QUERY
  UPDATE scheduled_tasks
  SET
    last_run_at = NOW(),
    next_run_at = calculate_next_run_enhanced(schedule, timezone, NOW()),
    run_count = run_count + 1,
    updated_at = NOW()
  WHERE id IN (
    SELECT id FROM scheduled_tasks
    WHERE is_active = TRUE
      AND next_run_at <= NOW()
    ORDER BY next_run_at
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING
    id,
    scheduled_tasks.user_id,
    scheduled_tasks.task_type,
    scheduled_tasks.config,
    scheduled_tasks.error_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update trigger to use enhanced calculation
CREATE OR REPLACE FUNCTION update_scheduled_task_next_run_enhanced()
RETURNS TRIGGER AS $$
BEGIN
  NEW.next_run_at := calculate_next_run_enhanced(NEW.schedule, NEW.timezone);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS scheduled_task_update_next_run ON scheduled_tasks;
CREATE TRIGGER scheduled_task_update_next_run_enhanced
BEFORE INSERT OR UPDATE OF schedule, timezone ON scheduled_tasks
FOR EACH ROW
EXECUTE FUNCTION update_scheduled_task_next_run_enhanced();

-- Function to record task execution
CREATE OR REPLACE FUNCTION record_task_execution(
  p_task_id UUID,
  p_status VARCHAR,
  p_result JSONB DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL,
  p_duration_ms INTEGER DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_execution_id UUID;
BEGIN
  INSERT INTO task_executions (
    task_id,
    completed_at,
    status,
    result,
    error_message,
    duration_ms
  ) VALUES (
    p_task_id,
    CASE WHEN p_status IN ('completed', 'failed', 'cancelled') THEN NOW() ELSE NULL END,
    p_status,
    p_result,
    p_error_message,
    p_duration_ms
  )
  RETURNING id INTO v_execution_id;

  -- Update task error tracking
  IF p_status = 'failed' THEN
    UPDATE scheduled_tasks
    SET
      error_count = error_count + 1,
      last_error = p_error_message,
      last_run_status = p_status
    WHERE id = p_task_id;
  ELSIF p_status = 'completed' THEN
    UPDATE scheduled_tasks
    SET
      last_run_status = p_status,
      last_error = NULL
    WHERE id = p_task_id;
  END IF;

  RETURN v_execution_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- View for task execution summary
CREATE OR REPLACE VIEW task_execution_summary AS
SELECT
  t.id,
  t.name,
  t.task_type,
  t.schedule,
  t.is_active,
  t.run_count,
  t.error_count,
  t.last_run_at,
  t.next_run_at,
  t.last_run_status,
  COUNT(e.id) FILTER (WHERE e.status = 'completed') as successful_runs,
  COUNT(e.id) FILTER (WHERE e.status = 'failed') as failed_runs,
  AVG(e.duration_ms) FILTER (WHERE e.status = 'completed') as avg_duration_ms,
  MAX(e.completed_at) as last_execution_at
FROM scheduled_tasks t
LEFT JOIN task_executions e ON e.task_id = t.id
GROUP BY t.id, t.name, t.task_type, t.schedule, t.is_active, t.run_count,
         t.error_count, t.last_run_at, t.next_run_at, t.last_run_status;
