-- supabase/migrations/20260112000006_health_metrics.sql
-- SwissBrain Swiss K8s Health - Sandbox Verification

-- ============================================================================
-- Health Metrics Storage
-- ============================================================================

CREATE TABLE IF NOT EXISTS health_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  overall_status VARCHAR(20) NOT NULL CHECK (overall_status IN ('healthy', 'degraded', 'unhealthy')),
  checks JSONB NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_health_metrics_timestamp ON health_metrics(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_health_metrics_status ON health_metrics(overall_status);

-- ============================================================================
-- Cleanup Function for Old Metrics
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_old_health_metrics()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM health_metrics WHERE timestamp < NOW() - INTERVAL '7 days';
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE health_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role access to health metrics" ON health_metrics
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- View for Latest Health Status
-- ============================================================================

CREATE OR REPLACE VIEW latest_health_status AS
SELECT
  overall_status,
  checks,
  timestamp
FROM health_metrics
ORDER BY timestamp DESC
LIMIT 1;
