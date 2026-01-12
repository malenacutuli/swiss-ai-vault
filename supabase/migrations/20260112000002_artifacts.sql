-- supabase/migrations/20260112000002_artifacts.sql
-- SwissBrain Artifact Registry - Content-Addressed Storage

-- ============================================================================
-- Artifacts Table (content-addressed storage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS artifacts (
  id VARCHAR(64) PRIMARY KEY,  -- SHA-256 hash
  type VARCHAR(20) NOT NULL CHECK (type IN ('file', 'image', 'document', 'code', 'data', 'model', 'other')),
  mime_type VARCHAR(255) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by_run_id UUID NOT NULL,
  created_by_step_id UUID NOT NULL,
  created_by_tool VARCHAR(100) NOT NULL,
  metadata JSONB DEFAULT '{}'
);

-- ============================================================================
-- Artifact Provenance Table (tracks usage/lineage)
-- ============================================================================

CREATE TABLE IF NOT EXISTS artifact_provenance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  artifact_id VARCHAR(64) NOT NULL REFERENCES artifacts(id) ON DELETE CASCADE,
  run_id UUID NOT NULL,
  step_id UUID NOT NULL,
  tool_name VARCHAR(100) NOT NULL,
  parent_artifacts TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_artifacts_run ON artifacts(created_by_run_id);
CREATE INDEX IF NOT EXISTS idx_artifacts_created ON artifacts(created_at);
CREATE INDEX IF NOT EXISTS idx_artifact_provenance_artifact ON artifact_provenance(artifact_id);
CREATE INDEX IF NOT EXISTS idx_artifact_provenance_run ON artifact_provenance(run_id);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifact_provenance ENABLE ROW LEVEL SECURITY;

-- Users can view artifacts from own runs
DROP POLICY IF EXISTS "Users can view artifacts from own runs" ON artifacts;
CREATE POLICY "Users can view artifacts from own runs" ON artifacts
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM agent_tasks WHERE id = created_by_run_id AND user_id = auth.uid())
  );

-- Service role full access to artifacts
DROP POLICY IF EXISTS "Service role full access to artifacts" ON artifacts;
CREATE POLICY "Service role full access to artifacts" ON artifacts
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Users can view provenance from own runs
DROP POLICY IF EXISTS "Users can view provenance from own runs" ON artifact_provenance;
CREATE POLICY "Users can view provenance from own runs" ON artifact_provenance
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM agent_tasks WHERE id = run_id AND user_id = auth.uid())
  );

-- Service role full access to provenance
DROP POLICY IF EXISTS "Service role full access to provenance" ON artifact_provenance;
CREATE POLICY "Service role full access to provenance" ON artifact_provenance
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');
