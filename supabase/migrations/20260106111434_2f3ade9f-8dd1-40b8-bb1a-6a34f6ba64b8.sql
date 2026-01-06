-- Create scheduled_task_runs table if not exists
CREATE TABLE IF NOT EXISTS public.scheduled_task_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scheduled_task_id UUID NOT NULL REFERENCES public.scheduled_tasks(id) ON DELETE CASCADE,
  agent_task_id UUID REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped')),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  error_message TEXT,
  result_summary TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns to scheduled_tasks if they don't exist
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'name') THEN
    ALTER TABLE public.scheduled_tasks ADD COLUMN name VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'description') THEN
    ALTER TABLE public.scheduled_tasks ADD COLUMN description TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'timezone') THEN
    ALTER TABLE public.scheduled_tasks ADD COLUMN timezone VARCHAR(50) DEFAULT 'UTC';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'prompt') THEN
    ALTER TABLE public.scheduled_tasks ADD COLUMN prompt TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'retry_count') THEN
    ALTER TABLE public.scheduled_tasks ADD COLUMN retry_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'max_retries') THEN
    ALTER TABLE public.scheduled_tasks ADD COLUMN max_retries INTEGER DEFAULT 3;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'last_error') THEN
    ALTER TABLE public.scheduled_tasks ADD COLUMN last_error TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'run_count') THEN
    ALTER TABLE public.scheduled_tasks ADD COLUMN run_count INTEGER DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_tasks' AND column_name = 'updated_at') THEN
    ALTER TABLE public.scheduled_tasks ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;

-- Enable RLS on runs table
ALTER TABLE public.scheduled_task_runs ENABLE ROW LEVEL SECURITY;

-- RLS policy for scheduled_task_runs
DROP POLICY IF EXISTS "Users can view runs for their scheduled tasks" ON public.scheduled_task_runs;
CREATE POLICY "Users can view runs for their scheduled tasks"
  ON public.scheduled_task_runs FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.scheduled_tasks st
    WHERE st.id = scheduled_task_id AND st.user_id = auth.uid()
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_task_id ON public.scheduled_task_runs(scheduled_task_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_task_runs_created ON public.scheduled_task_runs(created_at DESC);

-- Function to calculate next run time from cron expression
CREATE OR REPLACE FUNCTION public.calculate_next_cron_run(
  p_cron_expression VARCHAR,
  p_timezone VARCHAR DEFAULT 'UTC',
  p_from_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  parts TEXT[];
  minute_part TEXT;
  hour_part TEXT;
  dom_part TEXT;
  minute_val INTEGER;
  hour_val INTEGER;
  next_time TIMESTAMPTZ;
  current_time_tz TIMESTAMPTZ;
BEGIN
  parts := string_to_array(trim(p_cron_expression), ' ');
  
  IF array_length(parts, 1) < 5 THEN
    RETURN p_from_time + INTERVAL '1 hour';
  END IF;
  
  minute_part := parts[1];
  hour_part := parts[2];
  dom_part := parts[3];
  
  current_time_tz := p_from_time AT TIME ZONE p_timezone;
  
  IF minute_part = '*' AND hour_part = '*' THEN
    RETURN p_from_time + INTERVAL '1 minute';
  END IF;
  
  IF minute_part ~ '^\d+$' AND hour_part = '*' THEN
    minute_val := minute_part::INTEGER;
    next_time := date_trunc('hour', current_time_tz) + (minute_val || ' minutes')::INTERVAL;
    IF next_time <= current_time_tz THEN
      next_time := next_time + INTERVAL '1 hour';
    END IF;
    RETURN next_time AT TIME ZONE p_timezone;
  END IF;
  
  IF minute_part ~ '^\d+$' AND hour_part ~ '^\d+$' AND dom_part = '*' THEN
    minute_val := minute_part::INTEGER;
    hour_val := hour_part::INTEGER;
    next_time := date_trunc('day', current_time_tz) + (hour_val || ' hours')::INTERVAL + (minute_val || ' minutes')::INTERVAL;
    IF next_time <= current_time_tz THEN
      next_time := next_time + INTERVAL '1 day';
    END IF;
    RETURN next_time AT TIME ZONE p_timezone;
  END IF;
  
  RETURN p_from_time + INTERVAL '1 hour';
END;
$$;

-- Function to check and queue due scheduled tasks
CREATE OR REPLACE FUNCTION public.check_scheduled_tasks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task RECORD;
  v_count INTEGER := 0;
  v_run_id UUID;
BEGIN
  FOR v_task IN
    SELECT * FROM public.scheduled_tasks
    WHERE status = 'active'
      AND next_run_at <= NOW()
    ORDER BY next_run_at ASC
    LIMIT 100
    FOR UPDATE SKIP LOCKED
  LOOP
    INSERT INTO public.scheduled_task_runs (scheduled_task_id, status, started_at)
    VALUES (v_task.id, 'pending', NOW())
    RETURNING id INTO v_run_id;
    
    UPDATE public.scheduled_tasks
    SET 
      last_run_at = NOW(),
      next_run_at = calculate_next_cron_run(cron_expression, COALESCE(timezone, 'UTC'), NOW()),
      run_count = COALESCE(run_count, 0) + 1,
      updated_at = NOW()
    WHERE id = v_task.id;
    
    v_count := v_count + 1;
  END LOOP;
  
  RETURN v_count;
END;
$$;

-- Trigger to set initial next_run_at
CREATE OR REPLACE FUNCTION public.set_initial_next_run()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.next_run_at IS NULL AND NEW.status = 'active' THEN
    NEW.next_run_at := calculate_next_cron_run(NEW.cron_expression, COALESCE(NEW.timezone, 'UTC'), NOW());
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_set_initial_next_run ON public.scheduled_tasks;
CREATE TRIGGER tr_set_initial_next_run
  BEFORE INSERT OR UPDATE ON public.scheduled_tasks
  FOR EACH ROW
  EXECUTE FUNCTION public.set_initial_next_run();

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;