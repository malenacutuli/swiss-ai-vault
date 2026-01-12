-- Daily user activity tracking
CREATE TABLE IF NOT EXISTS user_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  sessions INTEGER DEFAULT 1,
  chat_messages INTEGER DEFAULT 0,
  agent_tasks INTEGER DEFAULT 0,
  documents_created INTEGER DEFAULT 0,
  tokens_used BIGINT DEFAULT 0,
  active_minutes INTEGER DEFAULT 0,
  features_used JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_activity_user ON user_activity(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_org ON user_activity(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_date ON user_activity(date DESC);

-- Organization metrics aggregates
CREATE TABLE IF NOT EXISTS org_metrics_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  active_users INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_chat_messages INTEGER DEFAULT 0,
  total_agent_tasks INTEGER DEFAULT 0,
  total_documents INTEGER DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  total_cost_usd DECIMAL(12, 6) DEFAULT 0,
  avg_session_minutes DECIMAL(6, 2) DEFAULT 0,
  feature_usage JSONB DEFAULT '{}',
  UNIQUE(organization_id, date)
);

CREATE INDEX IF NOT EXISTS idx_org_metrics_org ON org_metrics_daily(organization_id);
CREATE INDEX IF NOT EXISTS idx_org_metrics_date ON org_metrics_daily(date DESC);

-- Platform-wide metrics (admin only)
CREATE TABLE IF NOT EXISTS platform_metrics_daily (
  date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  total_users INTEGER DEFAULT 0,
  active_users INTEGER DEFAULT 0,
  new_users INTEGER DEFAULT 0,
  total_organizations INTEGER DEFAULT 0,
  total_sessions INTEGER DEFAULT 0,
  total_requests INTEGER DEFAULT 0,
  total_tokens BIGINT DEFAULT 0,
  total_revenue_usd DECIMAL(12, 2) DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0
);

-- RLS
ALTER TABLE user_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_metrics_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_metrics_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own activity" ON user_activity
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access user activity" ON user_activity
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Org admins view org metrics" ON org_metrics_daily
  FOR SELECT USING (
    organization_id IN (
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin') AND is_active = TRUE
    )
  );

CREATE POLICY "Service role full access org metrics" ON org_metrics_daily
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Platform metrics only for service role (admin)
CREATE POLICY "Service role only platform metrics" ON platform_metrics_daily
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Function to track user activity
CREATE OR REPLACE FUNCTION track_user_activity(
  p_user_id UUID,
  p_org_id UUID DEFAULT NULL,
  p_activity_type VARCHAR DEFAULT 'session',
  p_tokens INTEGER DEFAULT 0,
  p_feature VARCHAR DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
  v_features JSONB;
BEGIN
  -- Upsert user activity
  INSERT INTO user_activity (user_id, organization_id, date)
  VALUES (p_user_id, p_org_id, CURRENT_DATE)
  ON CONFLICT (user_id, date) DO UPDATE SET
    sessions = CASE WHEN p_activity_type = 'session' THEN user_activity.sessions + 1 ELSE user_activity.sessions END,
    chat_messages = CASE WHEN p_activity_type = 'chat' THEN user_activity.chat_messages + 1 ELSE user_activity.chat_messages END,
    agent_tasks = CASE WHEN p_activity_type = 'task' THEN user_activity.agent_tasks + 1 ELSE user_activity.agent_tasks END,
    documents_created = CASE WHEN p_activity_type = 'document' THEN user_activity.documents_created + 1 ELSE user_activity.documents_created END,
    tokens_used = user_activity.tokens_used + p_tokens,
    features_used = CASE
      WHEN p_feature IS NOT NULL THEN
        jsonb_set(
          COALESCE(user_activity.features_used, '{}'::JSONB),
          ARRAY[p_feature],
          to_jsonb(COALESCE((user_activity.features_used->>p_feature)::INTEGER, 0) + 1)
        )
      ELSE user_activity.features_used
    END,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to aggregate org metrics
CREATE OR REPLACE FUNCTION aggregate_org_metrics(p_org_id UUID, p_date DATE DEFAULT CURRENT_DATE)
RETURNS VOID AS $$
BEGIN
  INSERT INTO org_metrics_daily (organization_id, date, active_users, total_sessions, total_chat_messages, total_agent_tasks, total_documents, total_tokens)
  SELECT
    p_org_id,
    p_date,
    COUNT(DISTINCT user_id),
    COALESCE(SUM(sessions), 0),
    COALESCE(SUM(chat_messages), 0),
    COALESCE(SUM(agent_tasks), 0),
    COALESCE(SUM(documents_created), 0),
    COALESCE(SUM(tokens_used), 0)
  FROM user_activity
  WHERE organization_id = p_org_id AND date = p_date
  ON CONFLICT (organization_id, date) DO UPDATE SET
    active_users = EXCLUDED.active_users,
    total_sessions = EXCLUDED.total_sessions,
    total_chat_messages = EXCLUDED.total_chat_messages,
    total_agent_tasks = EXCLUDED.total_agent_tasks,
    total_documents = EXCLUDED.total_documents,
    total_tokens = EXCLUDED.total_tokens;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user analytics
CREATE OR REPLACE FUNCTION get_user_analytics(
  p_user_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'summary', jsonb_build_object(
        'total_sessions', COALESCE(SUM(sessions), 0),
        'total_messages', COALESCE(SUM(chat_messages), 0),
        'total_tasks', COALESCE(SUM(agent_tasks), 0),
        'total_documents', COALESCE(SUM(documents_created), 0),
        'total_tokens', COALESCE(SUM(tokens_used), 0),
        'active_days', COUNT(DISTINCT date)
      ),
      'by_day', (
        SELECT jsonb_agg(jsonb_build_object(
          'date', date,
          'sessions', sessions,
          'messages', chat_messages,
          'tasks', agent_tasks,
          'tokens', tokens_used
        ) ORDER BY date DESC)
        FROM user_activity
        WHERE user_id = p_user_id AND date >= CURRENT_DATE - p_days
      ),
      'top_features', (
        SELECT jsonb_object_agg(key, value::INTEGER)
        FROM (
          SELECT key, SUM(value::INTEGER) as value
          FROM user_activity, jsonb_each_text(features_used)
          WHERE user_id = p_user_id AND date >= CURRENT_DATE - p_days
          GROUP BY key
          ORDER BY value DESC
          LIMIT 10
        ) sub
      )
    )
    FROM user_activity
    WHERE user_id = p_user_id AND date >= CURRENT_DATE - p_days
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get org analytics
CREATE OR REPLACE FUNCTION get_org_analytics(
  p_org_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'summary', jsonb_build_object(
        'total_active_users', COALESCE(SUM(active_users), 0),
        'unique_active_users', (
          SELECT COUNT(DISTINCT user_id) FROM user_activity
          WHERE organization_id = p_org_id AND date >= CURRENT_DATE - p_days
        ),
        'total_sessions', COALESCE(SUM(total_sessions), 0),
        'total_messages', COALESCE(SUM(total_chat_messages), 0),
        'total_tasks', COALESCE(SUM(total_agent_tasks), 0),
        'total_tokens', COALESCE(SUM(total_tokens), 0),
        'total_cost_usd', COALESCE(SUM(total_cost_usd), 0)
      ),
      'by_day', (
        SELECT jsonb_agg(jsonb_build_object(
          'date', date,
          'active_users', active_users,
          'sessions', total_sessions,
          'messages', total_chat_messages,
          'tasks', total_agent_tasks,
          'tokens', total_tokens,
          'cost_usd', total_cost_usd
        ) ORDER BY date DESC)
        FROM org_metrics_daily
        WHERE organization_id = p_org_id AND date >= CURRENT_DATE - p_days
      ),
      'top_users', (
        SELECT jsonb_agg(jsonb_build_object(
          'user_id', user_id,
          'tokens', tokens,
          'tasks', tasks
        ))
        FROM (
          SELECT user_id, SUM(tokens_used) as tokens, SUM(agent_tasks) as tasks
          FROM user_activity
          WHERE organization_id = p_org_id AND date >= CURRENT_DATE - p_days
          GROUP BY user_id
          ORDER BY tokens DESC
          LIMIT 10
        ) sub
      )
    )
    FROM org_metrics_daily
    WHERE organization_id = p_org_id AND date >= CURRENT_DATE - p_days
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function for engagement metrics
CREATE OR REPLACE FUNCTION get_engagement_metrics(
  p_org_id UUID,
  p_days INTEGER DEFAULT 30
)
RETURNS JSONB AS $$
DECLARE
  v_dau DECIMAL;
  v_wau DECIMAL;
  v_mau DECIMAL;
  v_total_users INTEGER;
BEGIN
  -- Get total org members
  SELECT COUNT(*) INTO v_total_users
  FROM organization_members
  WHERE organization_id = p_org_id AND is_active = TRUE;

  -- DAU (today)
  SELECT COUNT(DISTINCT user_id)::DECIMAL INTO v_dau
  FROM user_activity
  WHERE organization_id = p_org_id AND date = CURRENT_DATE;

  -- WAU (last 7 days)
  SELECT COUNT(DISTINCT user_id)::DECIMAL INTO v_wau
  FROM user_activity
  WHERE organization_id = p_org_id AND date >= CURRENT_DATE - 7;

  -- MAU (last 30 days)
  SELECT COUNT(DISTINCT user_id)::DECIMAL INTO v_mau
  FROM user_activity
  WHERE organization_id = p_org_id AND date >= CURRENT_DATE - 30;

  RETURN jsonb_build_object(
    'total_members', v_total_users,
    'dau', v_dau,
    'wau', v_wau,
    'mau', v_mau,
    'dau_rate', CASE WHEN v_total_users > 0 THEN ROUND(v_dau / v_total_users * 100, 2) ELSE 0 END,
    'wau_rate', CASE WHEN v_total_users > 0 THEN ROUND(v_wau / v_total_users * 100, 2) ELSE 0 END,
    'mau_rate', CASE WHEN v_total_users > 0 THEN ROUND(v_mau / v_total_users * 100, 2) ELSE 0 END,
    'stickiness', CASE WHEN v_mau > 0 THEN ROUND(v_dau / v_mau * 100, 2) ELSE 0 END
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
