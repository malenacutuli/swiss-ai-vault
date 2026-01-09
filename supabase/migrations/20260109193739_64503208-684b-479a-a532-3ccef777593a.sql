-- Fix RLS on sandbox_metrics and system_alerts

-- Enable RLS on sandbox_metrics
ALTER TABLE sandbox_metrics ENABLE ROW LEVEL SECURITY;

-- Metrics are internal - service role only
CREATE POLICY "Service role full access metrics" ON sandbox_metrics
  FOR ALL TO service_role USING (true);

-- Enable RLS on system_alerts  
ALTER TABLE system_alerts ENABLE ROW LEVEL SECURITY;

-- Alerts are internal - service role only for writes, admins can read
CREATE POLICY "Service role full access alerts" ON system_alerts
  FOR ALL TO service_role USING (true);