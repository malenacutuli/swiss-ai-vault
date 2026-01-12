-- Scheduled tasks table
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  schedule VARCHAR(100) NOT NULL, -- Cron expression
  timezone VARCHAR(50) DEFAULT 'UTC',
  config JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  run_count INTEGER DEFAULT 0,
  last_run_status VARCHAR(20),
  last_run_id UUID REFERENCES agent_tasks(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Scheduled task runs history
CREATE TABLE IF NOT EXISTS scheduled_task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_task_id UUID NOT NULL REFERENCES scheduled_tasks(id) ON DELETE CASCADE,
  run_id UUID REFERENCES agent_tasks(id),
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_user ON scheduled_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_active ON scheduled_tasks(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at);
CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_task ON scheduled_task_runs(scheduled_task_id);

-- RLS
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_task_runs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own scheduled tasks" ON scheduled_tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role full access scheduled tasks" ON scheduled_tasks
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users view own task runs" ON scheduled_task_runs
  FOR SELECT USING (
    scheduled_task_id IN (SELECT id FROM scheduled_tasks WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access task runs" ON scheduled_task_runs
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to calculate next run time from cron expression
-- Note: This is a simplified version - production should use pg_cron
CREATE OR REPLACE FUNCTION calculate_next_run(
  p_cron VARCHAR,
  p_timezone VARCHAR DEFAULT 'UTC'
)
RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_parts TEXT[];
  v_minute INT;
  v_hour INT;
  v_now TIMESTAMPTZ;
  v_next TIMESTAMPTZ;
BEGIN
  -- Simple cron parsing (minute hour * * *)
  v_parts := string_to_array(p_cron, ' ');

  IF array_length(v_parts, 1) < 2 THEN
    RETURN NOW() + INTERVAL '1 hour';
  END IF;

  v_minute := CASE WHEN v_parts[1] = '*' THEN 0 ELSE v_parts[1]::INT END;
  v_hour := CASE WHEN v_parts[2] = '*' THEN EXTRACT(HOUR FROM NOW())::INT ELSE v_parts[2]::INT END;

  v_now := NOW() AT TIME ZONE p_timezone;
  v_next := DATE_TRUNC('day', v_now) + v_hour * INTERVAL '1 hour' + v_minute * INTERVAL '1 minute';

  IF v_next <= v_now THEN
    v_next := v_next + INTERVAL '1 day';
  END IF;

  RETURN v_next AT TIME ZONE p_timezone;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update next_run_at
CREATE OR REPLACE FUNCTION update_scheduled_task_next_run()
RETURNS TRIGGER AS $$
BEGIN
  NEW.next_run_at := calculate_next_run(NEW.schedule, NEW.timezone);
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER scheduled_task_update_next_run
BEFORE INSERT OR UPDATE OF schedule, timezone ON scheduled_tasks
FOR EACH ROW
EXECUTE FUNCTION update_scheduled_task_next_run();
