-- =============================================
-- MIGRATION 2: STUDIO / NOTEBOOKLM TABLES
-- SwissVault Enterprise - January 2026
-- Uses org_id to match existing schema
-- =============================================

-- Studio Notebooks
CREATE TABLE IF NOT EXISTS studio_notebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  -- Discovery Engine reference
  discovery_engine_notebook_id TEXT,
  discovery_engine_data_store_id TEXT,
  
  title TEXT NOT NULL,
  description TEXT,
  sources_version INTEGER DEFAULT 1,
  
  -- Settings
  settings JSONB DEFAULT '{
    "default_artifact_style": "professional",
    "enable_grounding": true,
    "max_sources": 50
  }',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Studio Sources
CREATE TABLE IF NOT EXISTS studio_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  notebook_id UUID NOT NULL REFERENCES studio_notebooks(id) ON DELETE CASCADE,
  
  -- Discovery Engine reference
  discovery_engine_source_id TEXT,
  
  source_type TEXT NOT NULL CHECK (source_type IN ('pdf', 'doc', 'slide', 'sheet', 'web', 'youtube', 'text')),
  title TEXT,
  source_url TEXT,
  storage_key TEXT,
  
  -- File metadata
  file_size_bytes INTEGER,
  page_count INTEGER,
  
  -- Ingestion status
  ingestion_status TEXT DEFAULT 'pending' CHECK (ingestion_status IN ('pending', 'processing', 'completed', 'failed')),
  ingestion_error TEXT,
  
  -- For XLSX chunking (150k cell limit)
  ingestion_manifest JSONB DEFAULT '{}',
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Studio Chat Messages
CREATE TABLE IF NOT EXISTS studio_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  notebook_id UUID NOT NULL REFERENCES studio_notebooks(id) ON DELETE CASCADE,
  session_id TEXT,
  
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  
  -- Canonical Evidence Objects
  evidence JSONB DEFAULT '[]',
  
  -- Raw grounding from Discovery Engine
  grounding_metadata JSONB,
  
  -- Token usage
  tokens_input INTEGER,
  tokens_output INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Notebook Quota Usage (20 audio/day limit per Gemini feedback)
CREATE TABLE IF NOT EXISTS notebook_quota_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  notebook_id UUID NOT NULL REFERENCES studio_notebooks(id) ON DELETE CASCADE,
  
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Quotas
  audio_overview_count INTEGER DEFAULT 0,
  query_count INTEGER DEFAULT 0,
  quiz_count INTEGER DEFAULT 0,
  flashcard_count INTEGER DEFAULT 0,
  slides_count INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  mind_map_count INTEGER DEFAULT 0,
  
  UNIQUE(notebook_id, date)
);

-- Artifact Jobs (async processing)
CREATE TABLE IF NOT EXISTS artifact_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  notebook_id UUID NOT NULL REFERENCES studio_notebooks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  artifact_type TEXT NOT NULL CHECK (artifact_type IN (
    'podcast', 'audio_overview', 'quiz', 'flashcards', 'mind_map', 
    'slides', 'report', 'study_guide', 'faq', 'timeline', 'table'
  )),
  
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'processing', 'polling', 'completed', 'failed', 'cancelled'
  )),
  
  -- Parameters
  params JSONB DEFAULT '{}',
  
  -- Cache key = hash(notebook_id + type + params + sources_version)
  cache_key TEXT,
  
  -- Discovery Engine operation
  google_operation_name TEXT,
  
  -- Output
  result_storage_key TEXT,
  result_metadata JSONB DEFAULT '{}',
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  
  -- Error handling
  error_message TEXT,
  error_code TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Artifact Outputs
CREATE TABLE IF NOT EXISTS artifact_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  notebook_id UUID NOT NULL REFERENCES studio_notebooks(id) ON DELETE CASCADE,
  job_id UUID REFERENCES artifact_jobs(id) ON DELETE SET NULL,
  
  artifact_type TEXT NOT NULL,
  title TEXT,
  
  -- Storage (signed URLs only, never public)
  storage_key TEXT NOT NULL,
  storage_bucket TEXT DEFAULT 'artifacts',
  
  -- Type-specific metadata
  metadata JSONB DEFAULT '{}',
  
  -- Duration for audio
  duration_seconds INTEGER,
  
  -- Evidence for citations
  evidence JSONB DEFAULT '[]',
  
  -- Access control
  is_public BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_studio_notebooks_org ON studio_notebooks(org_id);
CREATE INDEX IF NOT EXISTS idx_studio_notebooks_user ON studio_notebooks(user_id);
CREATE INDEX IF NOT EXISTS idx_studio_sources_notebook ON studio_sources(notebook_id);
CREATE INDEX IF NOT EXISTS idx_studio_sources_type ON studio_sources(source_type);
CREATE INDEX IF NOT EXISTS idx_studio_messages_notebook ON studio_messages(notebook_id);
CREATE INDEX IF NOT EXISTS idx_studio_messages_session ON studio_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_quota_notebook_date ON notebook_quota_usage(notebook_id, date);
CREATE INDEX IF NOT EXISTS idx_artifact_jobs_status ON artifact_jobs(status) WHERE status IN ('pending', 'processing', 'polling');
CREATE INDEX IF NOT EXISTS idx_artifact_jobs_cache ON artifact_jobs(cache_key);
CREATE INDEX IF NOT EXISTS idx_artifact_jobs_notebook ON artifact_jobs(notebook_id);
CREATE INDEX IF NOT EXISTS idx_artifact_outputs_notebook ON artifact_outputs(notebook_id);
CREATE INDEX IF NOT EXISTS idx_artifact_outputs_type ON artifact_outputs(artifact_type);

-- RLS
ALTER TABLE studio_notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE studio_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE notebook_quota_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_outputs ENABLE ROW LEVEL SECURITY;

-- Policies
DROP POLICY IF EXISTS "Org members access notebooks" ON studio_notebooks;
CREATE POLICY "Org members access notebooks" ON studio_notebooks
  FOR ALL USING (
    org_id IN (SELECT get_user_org_ids())
    OR (org_id IS NULL AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Org members access sources" ON studio_sources;
CREATE POLICY "Org members access sources" ON studio_sources
  FOR ALL USING (
    org_id IN (SELECT get_user_org_ids())
    OR notebook_id IN (SELECT id FROM studio_notebooks WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Org members access messages" ON studio_messages;
CREATE POLICY "Org members access messages" ON studio_messages
  FOR ALL USING (
    org_id IN (SELECT get_user_org_ids())
    OR notebook_id IN (SELECT id FROM studio_notebooks WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Org members access quota" ON notebook_quota_usage;
CREATE POLICY "Org members access quota" ON notebook_quota_usage
  FOR ALL USING (
    org_id IN (SELECT get_user_org_ids())
    OR notebook_id IN (SELECT id FROM studio_notebooks WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Users access own jobs" ON artifact_jobs;
CREATE POLICY "Users access own jobs" ON artifact_jobs
  FOR ALL USING (
    user_id = auth.uid()
    OR org_id IN (SELECT get_user_org_ids())
  );

DROP POLICY IF EXISTS "Org members access outputs" ON artifact_outputs;
CREATE POLICY "Org members access outputs" ON artifact_outputs
  FOR ALL USING (
    org_id IN (SELECT get_user_org_ids())
    OR notebook_id IN (SELECT id FROM studio_notebooks WHERE user_id = auth.uid())
    OR is_public = TRUE
  );

-- Triggers
DROP TRIGGER IF EXISTS studio_notebooks_updated_at ON studio_notebooks;
CREATE TRIGGER studio_notebooks_updated_at
  BEFORE UPDATE ON studio_notebooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();