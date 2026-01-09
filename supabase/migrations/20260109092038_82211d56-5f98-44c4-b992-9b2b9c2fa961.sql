-- Create sandbox_containers table for container tracking
CREATE TABLE IF NOT EXISTS sandbox_containers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  template TEXT NOT NULL,
  status TEXT DEFAULT 'warm' CHECK (status IN ('warming', 'warm', 'assigned', 'expired', 'terminated')),
  user_id UUID,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  assigned_at TIMESTAMPTZ,
  released_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '10 minutes')
);

-- Create indexes for efficient queries
CREATE INDEX idx_containers_region_template_status ON sandbox_containers(region, template, status);
CREATE INDEX idx_containers_status ON sandbox_containers(status);
CREATE INDEX idx_containers_user_id ON sandbox_containers(user_id);
CREATE INDEX idx_containers_task_id ON sandbox_containers(task_id);
CREATE INDEX idx_containers_expires_at ON sandbox_containers(expires_at);

-- Enable RLS
ALTER TABLE sandbox_containers ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view warm containers
CREATE POLICY "Authenticated users can view containers"
ON sandbox_containers
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Users can view their assigned containers
CREATE POLICY "Users can manage their assigned containers"
ON sandbox_containers
FOR ALL
USING (user_id = auth.uid());

-- Service role can manage all (for edge functions)
CREATE POLICY "Service role can manage all containers"
ON sandbox_containers
FOR ALL
USING (auth.jwt()->>'role' = 'service_role');

-- Create pool_metrics table for tracking
CREATE TABLE IF NOT EXISTS sandbox_pool_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region TEXT NOT NULL,
  template TEXT NOT NULL,
  metric_type TEXT NOT NULL,
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_pool_metrics_region_template ON sandbox_pool_metrics(region, template, recorded_at DESC);

-- Enable RLS
ALTER TABLE sandbox_pool_metrics ENABLE ROW LEVEL SECURITY;

-- Allow reading metrics
CREATE POLICY "Authenticated users can read pool metrics"
ON sandbox_pool_metrics
FOR SELECT
USING (auth.uid() IS NOT NULL);

-- Service role can insert metrics
CREATE POLICY "Service role can insert pool metrics"
ON sandbox_pool_metrics
FOR INSERT
WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Function to clean up expired containers
CREATE OR REPLACE FUNCTION cleanup_expired_containers()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM sandbox_containers
  WHERE status = 'expired' 
    OR (expires_at < NOW() AND status = 'warm');
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

-- Function to get pool statistics
CREATE OR REPLACE FUNCTION get_pool_stats(p_region TEXT DEFAULT 'eu-central-2')
RETURNS TABLE (
  template TEXT,
  warm_count BIGINT,
  assigned_count BIGINT,
  expired_count BIGINT,
  total_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sc.template,
    COUNT(*) FILTER (WHERE sc.status = 'warm') as warm_count,
    COUNT(*) FILTER (WHERE sc.status = 'assigned') as assigned_count,
    COUNT(*) FILTER (WHERE sc.status = 'expired') as expired_count,
    COUNT(*) as total_count
  FROM sandbox_containers sc
  WHERE sc.region = p_region
  GROUP BY sc.template;
END;
$$;