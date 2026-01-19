-- =============================================
-- SWISSVAULT HEALTHCARE - MINIMAL SCHEMA
-- Browser-first architecture: documents stay in browser
-- Server only tracks: tasks, audit metadata, preferences
-- =============================================

-- =============================================
-- 1. HEALTHCARE TASKS (State Machine)
-- =============================================
CREATE TABLE IF NOT EXISTS healthcare_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Task details
  task_type TEXT NOT NULL CHECK (
    task_type IN (
      'prior_auth_review',
      'claims_appeal',
      'icd10_lookup',
      'drug_interaction',
      'literature_search',
      'clinical_documentation',
      'care_coordination',
      'general_query'
    )
  ),

  -- State machine
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'processing', 'awaiting_tool', 'completed', 'failed', 'cancelled')
  ),

  -- Request (encrypted query only, NO patient data)
  query_hash TEXT, -- SHA256 of query for dedup

  -- Model used
  model TEXT DEFAULT 'claude-opus-4-20250514',

  -- Tool tracking
  tools_called TEXT[] DEFAULT ARRAY[]::TEXT[],
  tool_results_count INTEGER DEFAULT 0,

  -- Usage
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,

  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  latency_ms INTEGER,

  -- Error handling
  error_code TEXT,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 2. HEALTHCARE AUDIT LOG (Metadata Only - HIPAA)
-- =============================================
CREATE TABLE IF NOT EXISTS healthcare_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- What (metadata only, NO content)
  action TEXT NOT NULL CHECK (
    action IN (
      'query', 'tool_call', 'document_upload', 'document_delete',
      'export', 'share', 'settings_change'
    )
  ),

  -- Context (NO PHI)
  task_type TEXT,
  task_id UUID REFERENCES healthcare_tasks(id),
  tools_used TEXT[],

  -- Client info
  ip_address INET,
  user_agent TEXT,

  -- Metadata (NO PHI)
  metadata JSONB DEFAULT '{}',

  -- Immutable timestamp
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Prevent modifications (HIPAA requirement)
CREATE OR REPLACE FUNCTION prevent_healthcare_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Healthcare audit log is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER prevent_healthcare_audit_update
  BEFORE UPDATE OR DELETE ON healthcare_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_healthcare_audit_modification();

-- =============================================
-- 3. HEALTHCARE USER PREFERENCES
-- =============================================
CREATE TABLE IF NOT EXISTS healthcare_user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Model preferences
  preferred_model TEXT DEFAULT 'claude-opus-4-20250514',
  use_streaming BOOLEAN DEFAULT true,

  -- UI preferences
  show_citations BOOLEAN DEFAULT true,
  show_confidence BOOLEAN DEFAULT true,
  language TEXT DEFAULT 'en',

  -- Privacy preferences
  local_storage_only BOOLEAN DEFAULT true, -- Default: browser only
  allow_encrypted_backup BOOLEAN DEFAULT false,

  -- Specialty context (optional)
  specialty TEXT, -- e.g., 'cardiology', 'oncology'
  organization_type TEXT, -- e.g., 'hospital', 'clinic', 'payer'

  -- Timestamps
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(user_id)
);

-- =============================================
-- 4. HEALTHCARE TOOL CACHE (Optional Performance)
-- =============================================
CREATE TABLE IF NOT EXISTS healthcare_tool_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Cache key (hashed tool input)
  tool_name TEXT NOT NULL,
  input_hash TEXT NOT NULL,

  -- Cached result
  result JSONB NOT NULL,

  -- TTL
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(tool_name, input_hash)
);

-- Auto-delete expired cache
CREATE INDEX idx_healthcare_cache_expires ON healthcare_tool_cache(expires_at);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE healthcare_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE healthcare_tool_cache ENABLE ROW LEVEL SECURITY;

-- Users can only see their own tasks
CREATE POLICY "Users manage own healthcare tasks"
  ON healthcare_tasks FOR ALL
  USING (auth.uid() = user_id);

-- Users can only see their own audit log
CREATE POLICY "Users view own healthcare audit"
  ON healthcare_audit_log FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert audit logs
CREATE POLICY "Service role can insert healthcare audit"
  ON healthcare_audit_log FOR INSERT
  WITH CHECK (auth.jwt() ->> 'role' = 'service_role');

-- Users manage their own preferences
CREATE POLICY "Users manage own healthcare preferences"
  ON healthcare_user_preferences FOR ALL
  USING (auth.uid() = user_id);

-- Cache is shared (public medical data)
CREATE POLICY "Cache is readable by authenticated users"
  ON healthcare_tool_cache FOR SELECT
  USING (auth.role() = 'authenticated');

-- Service role can manage cache
CREATE POLICY "Service role manages healthcare cache"
  ON healthcare_tool_cache FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_healthcare_tasks_user ON healthcare_tasks(user_id);
CREATE INDEX idx_healthcare_tasks_status ON healthcare_tasks(status);
CREATE INDEX idx_healthcare_tasks_type ON healthcare_tasks(task_type);
CREATE INDEX idx_healthcare_tasks_created ON healthcare_tasks(created_at DESC);
CREATE INDEX idx_healthcare_audit_user ON healthcare_audit_log(user_id);
CREATE INDEX idx_healthcare_audit_time ON healthcare_audit_log(created_at DESC);
CREATE INDEX idx_healthcare_prefs_user ON healthcare_user_preferences(user_id);

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

-- Log healthcare action (called from API)
CREATE OR REPLACE FUNCTION log_healthcare_action(
  p_user_id UUID,
  p_action TEXT,
  p_task_type TEXT DEFAULT NULL,
  p_task_id UUID DEFAULT NULL,
  p_tools_used TEXT[] DEFAULT NULL,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO healthcare_audit_log (
    user_id, action, task_type, task_id, tools_used,
    ip_address, user_agent, metadata
  ) VALUES (
    p_user_id, p_action, p_task_type, p_task_id, p_tools_used,
    p_ip_address, p_user_agent, p_metadata
  ) RETURNING id INTO v_log_id;

  RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get or create user preferences
CREATE OR REPLACE FUNCTION get_healthcare_preferences(p_user_id UUID)
RETURNS healthcare_user_preferences AS $$
DECLARE
  v_prefs healthcare_user_preferences;
BEGIN
  SELECT * INTO v_prefs
  FROM healthcare_user_preferences
  WHERE user_id = p_user_id;

  IF NOT FOUND THEN
    INSERT INTO healthcare_user_preferences (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_prefs;
  END IF;

  RETURN v_prefs;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create healthcare task
CREATE OR REPLACE FUNCTION create_healthcare_task(
  p_user_id UUID,
  p_task_type TEXT,
  p_query_hash TEXT DEFAULT NULL,
  p_model TEXT DEFAULT 'claude-opus-4-20250514'
) RETURNS UUID AS $$
DECLARE
  v_task_id UUID;
BEGIN
  INSERT INTO healthcare_tasks (
    user_id, task_type, query_hash, model, status, started_at
  ) VALUES (
    p_user_id, p_task_type, p_query_hash, p_model, 'processing', NOW()
  ) RETURNING id INTO v_task_id;

  RETURN v_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Complete healthcare task
CREATE OR REPLACE FUNCTION complete_healthcare_task(
  p_task_id UUID,
  p_tools_called TEXT[],
  p_tool_results_count INTEGER,
  p_input_tokens INTEGER,
  p_output_tokens INTEGER,
  p_status TEXT DEFAULT 'completed',
  p_error_code TEXT DEFAULT NULL,
  p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
  v_started_at TIMESTAMPTZ;
  v_latency_ms INTEGER;
BEGIN
  SELECT started_at INTO v_started_at FROM healthcare_tasks WHERE id = p_task_id;
  v_latency_ms := EXTRACT(EPOCH FROM (NOW() - v_started_at)) * 1000;

  UPDATE healthcare_tasks SET
    status = p_status,
    tools_called = p_tools_called,
    tool_results_count = p_tool_results_count,
    input_tokens = p_input_tokens,
    output_tokens = p_output_tokens,
    completed_at = NOW(),
    latency_ms = v_latency_ms,
    error_code = p_error_code,
    error_message = p_error_message
  WHERE id = p_task_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup expired cache
CREATE OR REPLACE FUNCTION cleanup_healthcare_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM healthcare_tool_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- COMMENTS
-- =============================================

COMMENT ON TABLE healthcare_tasks IS 'Healthcare task state machine - tracks queries without storing PHI';
COMMENT ON TABLE healthcare_audit_log IS 'HIPAA-compliant immutable audit log - metadata only, no PHI';
COMMENT ON TABLE healthcare_user_preferences IS 'User preferences for healthcare module';
COMMENT ON TABLE healthcare_tool_cache IS 'Cache for healthcare tool results (public medical data only)';
