-- SWISSBRAIN MANUS - MISSING TABLES ONLY

-- 1. SANDBOX METRICS TABLE (Required by Phase 1 & 2)
CREATE TABLE IF NOT EXISTS sandbox_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  metric_name TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  template TEXT,
  region TEXT DEFAULT 'ch-gva-2',
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sandbox_metrics_name ON sandbox_metrics(metric_name, recorded_at);

-- 2. AGENT TASK OUTPUTS TABLE (Required by Phase 2 streaming)
CREATE TABLE IF NOT EXISTS agent_task_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
  output_type TEXT NOT NULL DEFAULT 'file',
  content JSONB,
  file_path TEXT,
  download_url TEXT,
  storage_region TEXT DEFAULT 'ch-gva-2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_outputs_task ON agent_task_outputs(task_id);

-- RLS for agent_task_outputs
ALTER TABLE agent_task_outputs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own task outputs" ON agent_task_outputs
  FOR SELECT TO authenticated USING (
    task_id IN (SELECT id FROM agent_tasks WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access outputs" ON agent_task_outputs
  FOR ALL TO service_role USING (true);

-- 3. SYSTEM ALERTS TABLE
CREATE TABLE IF NOT EXISTS system_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  message TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_severity ON system_alerts(severity, created_at);
CREATE INDEX IF NOT EXISTS idx_alerts_unack ON system_alerts(created_at) WHERE acknowledged_at IS NULL;

-- 4. WARM POOL CLAIM FUNCTION (Required by Phase 1)
CREATE OR REPLACE FUNCTION claim_warm_container(
  p_template TEXT,
  p_region TEXT DEFAULT 'ch-gva-2'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_container_id UUID;
BEGIN
  SELECT id INTO v_container_id
  FROM sandbox_containers
  WHERE status = 'warm'
    AND template = p_template
    AND region = p_region
  ORDER BY created_at ASC
  LIMIT 1
  FOR UPDATE SKIP LOCKED;
  
  IF v_container_id IS NOT NULL THEN
    UPDATE sandbox_containers
    SET status = 'assigned',
        assigned_at = NOW()
    WHERE id = v_container_id;
  END IF;
  
  RETURN v_container_id;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_warm_container(TEXT, TEXT) TO service_role;

-- 5. Add execution_region to agent_tasks if missing
ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS execution_region TEXT DEFAULT 'ch-gva-2';