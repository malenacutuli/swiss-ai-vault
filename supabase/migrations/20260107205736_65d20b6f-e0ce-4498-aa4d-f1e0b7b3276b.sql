-- =============================================
-- MIGRATION 3: AGENT TABLES + AUDIT LOGGING
-- SwissVault Enterprise - January 2026
-- Adapted: handles existing tables
-- =============================================

-- Add org_id to existing agent tables (if they exist and don't have it)
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_tasks') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tasks' AND column_name = 'org_id') THEN
      ALTER TABLE agent_tasks ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_task_steps') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_task_steps' AND column_name = 'org_id') THEN
      ALTER TABLE agent_task_steps ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_outputs') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_outputs' AND column_name = 'org_id') THEN
      ALTER TABLE agent_outputs ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
  END IF;

  -- Add org_id to existing agent_tool_calls if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_tool_calls') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tool_calls' AND column_name = 'org_id') THEN
      ALTER TABLE agent_tool_calls ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    -- Add audit columns if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tool_calls' AND column_name = 'provider') THEN
      ALTER TABLE agent_tool_calls ADD COLUMN provider TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tool_calls' AND column_name = 'model') THEN
      ALTER TABLE agent_tool_calls ADD COLUMN model TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tool_calls' AND column_name = 'request_json') THEN
      ALTER TABLE agent_tool_calls ADD COLUMN request_json JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tool_calls' AND column_name = 'response_json') THEN
      ALTER TABLE agent_tool_calls ADD COLUMN response_json JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tool_calls' AND column_name = 'cost_usd') THEN
      ALTER TABLE agent_tool_calls ADD COLUMN cost_usd DECIMAL(10,6);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tool_calls' AND column_name = 'latency_ms') THEN
      ALTER TABLE agent_tool_calls ADD COLUMN latency_ms INTEGER;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tool_calls' AND column_name = 'ip_address') THEN
      ALTER TABLE agent_tool_calls ADD COLUMN ip_address INET;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_tool_calls' AND column_name = 'user_agent') THEN
      ALTER TABLE agent_tool_calls ADD COLUMN user_agent TEXT;
    END IF;
  END IF;

  -- Add org_id to existing agent_sessions if missing
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'agent_sessions') THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_sessions' AND column_name = 'org_id') THEN
      ALTER TABLE agent_sessions ADD COLUMN org_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_sessions' AND column_name = 'title') THEN
      ALTER TABLE agent_sessions ADD COLUMN title TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_sessions' AND column_name = 'prompt') THEN
      ALTER TABLE agent_sessions ADD COLUMN prompt TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_sessions' AND column_name = 'privacy_tier') THEN
      ALTER TABLE agent_sessions ADD COLUMN privacy_tier TEXT DEFAULT 'vault';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_sessions' AND column_name = 'current_step') THEN
      ALTER TABLE agent_sessions ADD COLUMN current_step INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_sessions' AND column_name = 'total_steps') THEN
      ALTER TABLE agent_sessions ADD COLUMN total_steps INTEGER DEFAULT 0;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_sessions' AND column_name = 'todo_md') THEN
      ALTER TABLE agent_sessions ADD COLUMN todo_md TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_sessions' AND column_name = 'error_message') THEN
      ALTER TABLE agent_sessions ADD COLUMN error_message TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agent_sessions' AND column_name = 'updated_at') THEN
      ALTER TABLE agent_sessions ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
    END IF;
  END IF;
END $$;

-- Audit Events (comprehensive logging)
CREATE TABLE IF NOT EXISTS audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID,
  
  -- Event classification
  event_category TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_severity TEXT DEFAULT 'info' CHECK (event_severity IN ('debug', 'info', 'warning', 'error', 'critical')),
  
  -- Target
  target_type TEXT,
  target_id UUID,
  target_name TEXT,
  
  -- Details
  description TEXT,
  metadata JSONB DEFAULT '{}',
  
  -- Request context
  ip_address INET,
  user_agent TEXT,
  request_id TEXT,
  
  -- Geo (for compliance)
  country_code TEXT,
  region TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Events (event stream)
CREATE TABLE IF NOT EXISTS agent_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  
  event_type TEXT NOT NULL CHECK (event_type IN (
    'message', 'action', 'observation', 'plan', 'knowledge', 'datasource', 'error', 'user_input'
  )),
  
  content JSONB NOT NULL,
  
  -- Metrics
  token_count INTEGER,
  duration_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Agent Workspace Files
CREATE TABLE IF NOT EXISTS agent_workspace_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
  
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size_bytes INTEGER,
  
  -- Storage
  storage_key TEXT,
  storage_bucket TEXT DEFAULT 'agent-workspaces',
  
  -- Flags
  is_output BOOLEAN DEFAULT FALSE,
  is_intermediate BOOLEAN DEFAULT TRUE,
  
  metadata JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tool_calls_org ON agent_tool_calls(org_id);
CREATE INDEX IF NOT EXISTS idx_tool_calls_provider ON agent_tool_calls(provider);
CREATE INDEX IF NOT EXISTS idx_audit_events_org ON audit_events(org_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_user ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_events_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_events_created ON audit_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_org ON agent_sessions(org_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_session ON agent_events(session_id);
CREATE INDEX IF NOT EXISTS idx_agent_events_type ON agent_events(event_type);
CREATE INDEX IF NOT EXISTS idx_workspace_files_session ON agent_workspace_files(session_id);

-- RLS
ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_workspace_files ENABLE ROW LEVEL SECURITY;

-- Update RLS on existing tables for org support
DROP POLICY IF EXISTS "Org members view tool calls" ON agent_tool_calls;
CREATE POLICY "Org members view tool calls" ON agent_tool_calls
  FOR SELECT USING (
    org_id IN (SELECT get_user_org_ids())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Org admins view audit" ON audit_events;
CREATE POLICY "Org admins view audit" ON audit_events
  FOR SELECT USING (
    org_id IN (SELECT get_user_org_ids())
    OR user_id = auth.uid()
  );

DROP POLICY IF EXISTS "Org members access sessions" ON agent_sessions;
CREATE POLICY "Org members access sessions" ON agent_sessions
  FOR ALL USING (
    user_id = auth.uid()
    OR org_id IN (SELECT get_user_org_ids())
  );

DROP POLICY IF EXISTS "Users access session events" ON agent_events;
CREATE POLICY "Users access session events" ON agent_events
  FOR ALL USING (
    session_id IN (
      SELECT id FROM agent_sessions 
      WHERE user_id = auth.uid() OR org_id IN (SELECT get_user_org_ids())
    )
  );

DROP POLICY IF EXISTS "Users access workspace files" ON agent_workspace_files;
CREATE POLICY "Users access workspace files" ON agent_workspace_files
  FOR ALL USING (
    session_id IN (
      SELECT id FROM agent_sessions 
      WHERE user_id = auth.uid() OR org_id IN (SELECT get_user_org_ids())
    )
  );

-- Triggers
DROP TRIGGER IF EXISTS agent_sessions_updated_at ON agent_sessions;
CREATE TRIGGER agent_sessions_updated_at
  BEFORE UPDATE ON agent_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();