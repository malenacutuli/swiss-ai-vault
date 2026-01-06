-- ============================================
-- ENTERPRISE FEATURES
-- ============================================

-- SSO Configurations
CREATE TABLE IF NOT EXISTS sso_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  provider_type VARCHAR(20) NOT NULL CHECK (provider_type IN ('saml', 'oidc')),
  provider_name VARCHAR(100) NOT NULL,
  metadata_url TEXT,
  client_id TEXT,
  client_secret TEXT,
  certificate TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Organization Roles (separate from user_roles which already exists)
CREATE TABLE IF NOT EXISTS org_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(50) NOT NULL,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- COLLABORATION
-- ============================================

CREATE TABLE IF NOT EXISTS collab_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  created_by UUID REFERENCES auth.users(id),
  status VARCHAR(20) DEFAULT 'active',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS collab_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES collab_sessions(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  role VARCHAR(20) DEFAULT 'viewer',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  left_at TIMESTAMPTZ
);

-- ============================================
-- CODE SANDBOXES
-- ============================================

CREATE TABLE IF NOT EXISTS code_sandboxes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  environment VARCHAR(20) NOT NULL,
  status VARCHAR(20) DEFAULT 'creating',
  container_id TEXT,
  files JSONB DEFAULT '{}',
  installed_packages JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  destroyed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS code_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sandbox_id UUID REFERENCES code_sandboxes(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  language VARCHAR(20) NOT NULL,
  stdin TEXT,
  stdout TEXT,
  stderr TEXT,
  exit_code INTEGER,
  execution_time_ms INTEGER,
  memory_used_mb DECIMAL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- BROWSER SESSIONS
-- ============================================

CREATE TABLE IF NOT EXISTS browser_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id),
  status VARCHAR(20) DEFAULT 'creating',
  session_token TEXT,
  current_url TEXT,
  viewport_width INTEGER DEFAULT 1920,
  viewport_height INTEGER DEFAULT 1080,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_action_at TIMESTAMPTZ,
  closed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS browser_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES browser_sessions(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  action_data JSONB NOT NULL,
  result JSONB,
  screenshot_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- NOTIFICATIONS
-- ============================================

CREATE TABLE IF NOT EXISTS notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  email_enabled BOOLEAN DEFAULT true,
  slack_enabled BOOLEAN DEFAULT false,
  push_enabled BOOLEAN DEFAULT false,
  webhook_url TEXT,
  digest_frequency VARCHAR(20) DEFAULT 'immediate',
  quiet_hours_start TIME,
  quiet_hours_end TIME,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add read_at column to notifications if missing
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMPTZ;

-- ============================================
-- ENHANCED AGENT TABLES
-- ============================================

CREATE TABLE IF NOT EXISTS agent_file_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID REFERENCES agent_task_steps(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL,
  file_path TEXT NOT NULL,
  file_content TEXT,
  storage_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wide_research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  query TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  items_total INTEGER DEFAULT 0,
  items_completed INTEGER DEFAULT 0,
  result JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS research_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID REFERENCES wide_research_jobs(id) ON DELETE CASCADE,
  item_index INTEGER NOT NULL,
  item_input TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending',
  result JSONB,
  sources JSONB DEFAULT '[]',
  worker_id TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT
);

CREATE TABLE IF NOT EXISTS agent_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  suggestion_text TEXT NOT NULL,
  suggestion_type VARCHAR(50),
  priority INTEGER DEFAULT 0,
  was_used BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- RLS POLICIES
-- ============================================

ALTER TABLE sso_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE collab_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_sandboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE code_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE browser_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_file_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wide_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_suggestions ENABLE ROW LEVEL SECURITY;

-- SSO: Org admins only
CREATE POLICY "Org admins manage SSO" ON sso_configurations
  FOR ALL USING (public.is_org_admin(auth.uid(), organization_id));

-- Org Roles: Org admins can manage
CREATE POLICY "Org admins manage roles" ON org_roles
  FOR ALL USING (public.is_org_admin(auth.uid(), organization_id));

-- Collab sessions: Task owner and participants
CREATE POLICY "Users access own collab sessions" ON collab_sessions
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Participants view sessions" ON collab_sessions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM collab_participants WHERE session_id = id AND user_id = auth.uid()
  ));

-- Collab participants
CREATE POLICY "Users manage own participation" ON collab_participants
  FOR ALL USING (user_id = auth.uid());

-- Code sandboxes
CREATE POLICY "Users manage own sandboxes" ON code_sandboxes
  FOR ALL USING (user_id = auth.uid());

-- Code executions: Via sandbox ownership
CREATE POLICY "Users access own executions" ON code_executions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM code_sandboxes WHERE id = sandbox_id AND user_id = auth.uid()
  ));

-- Browser sessions
CREATE POLICY "Users manage own browser sessions" ON browser_sessions
  FOR ALL USING (user_id = auth.uid());

-- Browser actions
CREATE POLICY "Users access own browser actions" ON browser_actions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM browser_sessions WHERE id = session_id AND user_id = auth.uid()
  ));

-- Notification preferences
CREATE POLICY "Users manage own notification prefs" ON notification_preferences
  FOR ALL USING (user_id = auth.uid());

-- Agent file actions: Via step ownership
CREATE POLICY "Users access own file actions" ON agent_file_actions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM agent_task_steps s 
    JOIN agent_tasks t ON s.task_id = t.id 
    WHERE s.id = step_id AND t.user_id = auth.uid()
  ));

-- Wide research jobs
CREATE POLICY "Users manage own research jobs" ON wide_research_jobs
  FOR ALL USING (user_id = auth.uid());

-- Research items
CREATE POLICY "Users access own research items" ON research_items
  FOR ALL USING (EXISTS (
    SELECT 1 FROM wide_research_jobs WHERE id = job_id AND user_id = auth.uid()
  ));

-- Agent suggestions
CREATE POLICY "Users access own suggestions" ON agent_suggestions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM agent_tasks WHERE id = task_id AND user_id = auth.uid()
  ));

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id) WHERE read_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_code_executions_sandbox ON code_executions(sandbox_id);
CREATE INDEX IF NOT EXISTS idx_browser_actions_session ON browser_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_research_items_job_status ON research_items(job_id, status);
CREATE INDEX IF NOT EXISTS idx_agent_suggestions_task ON agent_suggestions(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_file_actions_step ON agent_file_actions(step_id);
CREATE INDEX IF NOT EXISTS idx_wide_research_jobs_user ON wide_research_jobs(user_id);

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE collab_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE collab_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE research_items;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_file_actions;
ALTER PUBLICATION supabase_realtime ADD TABLE agent_suggestions;