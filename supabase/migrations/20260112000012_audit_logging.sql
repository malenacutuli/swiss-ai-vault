-- Audit log table (append-only, immutable)
CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id),
  user_id UUID REFERENCES auth.users(id),
  actor_email VARCHAR(255),
  action VARCHAR(100) NOT NULL,
  resource_type VARCHAR(50) NOT NULL,
  resource_id VARCHAR(255),
  details JSONB DEFAULT '{}',
  ip_address INET,
  user_agent TEXT,
  request_id VARCHAR(64),
  status VARCHAR(20) DEFAULT 'success' CHECK (status IN ('success', 'failure', 'pending')),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Partition by month for performance (optional, for high-volume)
-- CREATE TABLE audit_logs_2026_01 PARTITION OF audit_logs FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_org ON audit_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_org_created ON audit_logs(organization_id, created_at DESC);

-- GIN index for JSONB details search
CREATE INDEX IF NOT EXISTS idx_audit_logs_details ON audit_logs USING GIN (details);

-- Audit log categories
CREATE TABLE IF NOT EXISTS audit_actions (
  action VARCHAR(100) PRIMARY KEY,
  category VARCHAR(50) NOT NULL,
  description TEXT,
  severity VARCHAR(20) DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical')),
  retention_days INTEGER DEFAULT 365
);

-- Seed audit actions
INSERT INTO audit_actions (action, category, description, severity) VALUES
-- Authentication
('auth.login', 'authentication', 'User logged in', 'info'),
('auth.logout', 'authentication', 'User logged out', 'info'),
('auth.login_failed', 'authentication', 'Failed login attempt', 'warning'),
('auth.password_changed', 'authentication', 'Password changed', 'warning'),
('auth.mfa_enabled', 'authentication', 'MFA enabled', 'info'),
('auth.mfa_disabled', 'authentication', 'MFA disabled', 'warning'),
-- Organization
('org.created', 'organization', 'Organization created', 'info'),
('org.updated', 'organization', 'Organization settings updated', 'info'),
('org.member_added', 'organization', 'Member added to organization', 'info'),
('org.member_removed', 'organization', 'Member removed from organization', 'warning'),
('org.role_changed', 'organization', 'Member role changed', 'warning'),
('org.invite_sent', 'organization', 'Invite sent', 'info'),
-- Data access
('data.viewed', 'data_access', 'Data viewed', 'info'),
('data.exported', 'data_access', 'Data exported', 'warning'),
('data.deleted', 'data_access', 'Data deleted', 'critical'),
('data.shared', 'data_access', 'Data shared externally', 'warning'),
-- Agent tasks
('task.created', 'agent', 'Agent task created', 'info'),
('task.completed', 'agent', 'Agent task completed', 'info'),
('task.failed', 'agent', 'Agent task failed', 'warning'),
('task.cancelled', 'agent', 'Agent task cancelled', 'info'),
-- Integrations
('integration.connected', 'integration', 'Integration connected', 'info'),
('integration.disconnected', 'integration', 'Integration disconnected', 'info'),
('integration.token_refreshed', 'integration', 'OAuth token refreshed', 'info'),
-- Admin actions
('admin.settings_changed', 'admin', 'System settings changed', 'warning'),
('admin.user_impersonated', 'admin', 'User impersonated by admin', 'critical'),
('admin.data_purged', 'admin', 'Data purged', 'critical')
ON CONFLICT (action) DO NOTHING;

-- RLS - very restrictive
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only org admins can view audit logs
CREATE POLICY "Org admins can view audit logs" ON audit_logs
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
    )
  );

-- Service role for writing
CREATE POLICY "Service role can insert audit logs" ON audit_logs
  FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Service role can read all audit logs" ON audit_logs
  FOR SELECT USING (auth.jwt() ->> 'role' = 'service_role');

-- Prevent updates and deletes (immutable)
-- No UPDATE or DELETE policies = immutable logs

-- Function to log audit event
CREATE OR REPLACE FUNCTION log_audit_event(
  p_action VARCHAR,
  p_resource_type VARCHAR,
  p_resource_id VARCHAR DEFAULT NULL,
  p_details JSONB DEFAULT '{}',
  p_user_id UUID DEFAULT NULL,
  p_org_id UUID DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_request_id VARCHAR DEFAULT NULL,
  p_status VARCHAR DEFAULT 'success',
  p_error_message TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
  v_email VARCHAR;
BEGIN
  -- Get user email if user_id provided
  IF p_user_id IS NOT NULL THEN
    SELECT email INTO v_email FROM profiles WHERE id = p_user_id;
  END IF;

  INSERT INTO audit_logs (
    organization_id, user_id, actor_email, action, resource_type, resource_id,
    details, ip_address, user_agent, request_id, status, error_message
  )
  VALUES (
    p_org_id, p_user_id, v_email, p_action, p_resource_type, p_resource_id,
    p_details, p_ip_address, p_user_agent, p_request_id, p_status, p_error_message
  )
  RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search audit logs
CREATE OR REPLACE FUNCTION search_audit_logs(
  p_org_id UUID,
  p_action VARCHAR DEFAULT NULL,
  p_resource_type VARCHAR DEFAULT NULL,
  p_user_id UUID DEFAULT NULL,
  p_start_date TIMESTAMPTZ DEFAULT NULL,
  p_end_date TIMESTAMPTZ DEFAULT NULL,
  p_search_term TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 100,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  actor_email VARCHAR,
  action VARCHAR,
  resource_type VARCHAR,
  resource_id VARCHAR,
  details JSONB,
  status VARCHAR,
  created_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    al.id, al.user_id, al.actor_email, al.action, al.resource_type,
    al.resource_id, al.details, al.status, al.created_at
  FROM audit_logs al
  WHERE al.organization_id = p_org_id
    AND (p_action IS NULL OR al.action = p_action)
    AND (p_resource_type IS NULL OR al.resource_type = p_resource_type)
    AND (p_user_id IS NULL OR al.user_id = p_user_id)
    AND (p_start_date IS NULL OR al.created_at >= p_start_date)
    AND (p_end_date IS NULL OR al.created_at <= p_end_date)
    AND (p_search_term IS NULL OR
         al.details::TEXT ILIKE '%' || p_search_term || '%' OR
         al.actor_email ILIKE '%' || p_search_term || '%')
  ORDER BY al.created_at DESC
  LIMIT p_limit OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get audit summary
CREATE OR REPLACE FUNCTION get_audit_summary(
  p_org_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'total_events', COUNT(*),
      'by_action', (
        SELECT jsonb_object_agg(action, cnt)
        FROM (
          SELECT action, COUNT(*) as cnt
          FROM audit_logs
          WHERE organization_id = p_org_id AND created_at >= NOW() - (p_days || ' days')::INTERVAL
          GROUP BY action
          ORDER BY cnt DESC
          LIMIT 10
        ) sub
      ),
      'by_user', (
        SELECT jsonb_object_agg(COALESCE(actor_email, 'system'), cnt)
        FROM (
          SELECT actor_email, COUNT(*) as cnt
          FROM audit_logs
          WHERE organization_id = p_org_id AND created_at >= NOW() - (p_days || ' days')::INTERVAL
          GROUP BY actor_email
          ORDER BY cnt DESC
          LIMIT 10
        ) sub
      ),
      'by_severity', (
        SELECT jsonb_object_agg(severity, cnt)
        FROM (
          SELECT aa.severity, COUNT(*) as cnt
          FROM audit_logs al
          JOIN audit_actions aa ON al.action = aa.action
          WHERE al.organization_id = p_org_id AND al.created_at >= NOW() - (p_days || ' days')::INTERVAL
          GROUP BY aa.severity
        ) sub
      ),
      'failures', (
        SELECT COUNT(*) FROM audit_logs
        WHERE organization_id = p_org_id
          AND status = 'failure'
          AND created_at >= NOW() - (p_days || ' days')::INTERVAL
      )
    )
    FROM audit_logs
    WHERE organization_id = p_org_id AND created_at >= NOW() - (p_days || ' days')::INTERVAL
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup old logs based on retention policy
CREATE OR REPLACE FUNCTION cleanup_old_audit_logs()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER := 0;
  v_action RECORD;
BEGIN
  FOR v_action IN SELECT action, retention_days FROM audit_actions WHERE retention_days IS NOT NULL
  LOOP
    DELETE FROM audit_logs
    WHERE action = v_action.action
      AND created_at < NOW() - (v_action.retention_days || ' days')::INTERVAL;

    deleted_count := deleted_count + (SELECT COUNT(*) FROM audit_logs WHERE action = v_action.action);
  END LOOP;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
