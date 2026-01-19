-- =============================================
-- WIDE RESEARCH SCHEMA
-- Parallel multi-agent research system
-- =============================================

-- Drop existing tables if they exist
DROP TABLE IF EXISTS wide_research_subtasks CASCADE;
DROP TABLE IF EXISTS wide_research_templates CASCADE;
DROP TABLE IF EXISTS wide_research_jobs CASCADE;

-- =============================================
-- WIDE RESEARCH JOBS
-- Main job tracking
-- =============================================

CREATE TABLE wide_research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,

  -- Job definition
  prompt TEXT NOT NULL,
  items JSONB NOT NULL, -- Array of items to research
  output_schema JSONB NOT NULL, -- Expected output structure

  -- Configuration
  max_parallel INTEGER DEFAULT 50,
  timeout_per_item_seconds INTEGER DEFAULT 120,
  retry_failed BOOLEAN DEFAULT TRUE,
  max_retries INTEGER DEFAULT 2,

  -- Status
  status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN (
    'queued', 'running', 'completed', 'failed', 'cancelled', 'partial'
  )),

  -- Progress
  total_items INTEGER NOT NULL,
  completed_items INTEGER DEFAULT 0,
  failed_items INTEGER DEFAULT 0,

  -- Results
  results JSONB, -- Aggregated results

  -- Cost tracking
  total_credits_used DECIMAL(10,4) DEFAULT 0,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,

  -- Error
  error_message TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wide_research_jobs_user_id ON wide_research_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_wide_research_jobs_status ON wide_research_jobs(status);
CREATE INDEX IF NOT EXISTS idx_wide_research_jobs_created_at ON wide_research_jobs(created_at DESC);

-- =============================================
-- WIDE RESEARCH SUBTASKS
-- Individual item processing
-- =============================================

CREATE TABLE wide_research_subtasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES wide_research_jobs(id) ON DELETE CASCADE,

  -- Item
  item_index INTEGER NOT NULL,
  item_value TEXT NOT NULL,

  -- Execution
  agent_run_id UUID REFERENCES agent_runs(id) ON DELETE SET NULL,

  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending', 'queued', 'running', 'completed', 'failed', 'skipped'
  )),

  -- Result
  result JSONB,

  -- Error
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,

  -- Cost
  credits_used DECIMAL(10,4) DEFAULT 0,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Unique constraint
  UNIQUE(job_id, item_index)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wide_research_subtasks_job_id ON wide_research_subtasks(job_id);
CREATE INDEX IF NOT EXISTS idx_wide_research_subtasks_status ON wide_research_subtasks(status);
CREATE INDEX IF NOT EXISTS idx_wide_research_subtasks_agent_run ON wide_research_subtasks(agent_run_id);

-- =============================================
-- WIDE RESEARCH TEMPLATES
-- Reusable research templates
-- =============================================

CREATE TABLE wide_research_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Template definition
  name TEXT NOT NULL,
  description TEXT,
  prompt_template TEXT NOT NULL, -- Use {{item}} placeholder
  output_schema JSONB NOT NULL,

  -- Configuration
  default_max_parallel INTEGER DEFAULT 50,
  default_timeout_seconds INTEGER DEFAULT 120,

  -- Sharing
  is_public BOOLEAN DEFAULT FALSE,

  -- Usage stats
  usage_count INTEGER DEFAULT 0,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_wide_research_templates_user_id ON wide_research_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_wide_research_templates_public ON wide_research_templates(is_public) WHERE is_public = TRUE;

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE wide_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE wide_research_subtasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE wide_research_templates ENABLE ROW LEVEL SECURITY;

-- wide_research_jobs
CREATE POLICY "Users can view own jobs"
  ON wide_research_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own jobs"
  ON wide_research_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own jobs"
  ON wide_research_jobs FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to jobs"
  ON wide_research_jobs FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- wide_research_subtasks
CREATE POLICY "Users can view subtasks of own jobs"
  ON wide_research_subtasks FOR SELECT
  USING (job_id IN (SELECT id FROM wide_research_jobs WHERE user_id = auth.uid()));

CREATE POLICY "Service role has full access to subtasks"
  ON wide_research_subtasks FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- wide_research_templates
CREATE POLICY "Users can view own or public templates"
  ON wide_research_templates FOR SELECT
  USING (auth.uid() = user_id OR is_public = TRUE);

CREATE POLICY "Users can create own templates"
  ON wide_research_templates FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own templates"
  ON wide_research_templates FOR UPDATE
  USING (auth.uid() = user_id);

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to update job progress
CREATE OR REPLACE FUNCTION update_wide_research_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE wide_research_jobs
  SET
    completed_items = (SELECT COUNT(*) FROM wide_research_subtasks WHERE job_id = NEW.job_id AND status = 'completed'),
    failed_items = (SELECT COUNT(*) FROM wide_research_subtasks WHERE job_id = NEW.job_id AND status = 'failed'),
    total_credits_used = (SELECT COALESCE(SUM(credits_used), 0) FROM wide_research_subtasks WHERE job_id = NEW.job_id)
  WHERE id = NEW.job_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for progress updates
DROP TRIGGER IF EXISTS trigger_update_wide_research_progress ON wide_research_subtasks;
CREATE TRIGGER trigger_update_wide_research_progress
  AFTER UPDATE OF status ON wide_research_subtasks
  FOR EACH ROW
  EXECUTE FUNCTION update_wide_research_progress();

-- Function to check job completion
CREATE OR REPLACE FUNCTION check_wide_research_completion()
RETURNS TRIGGER AS $$
DECLARE
  pending_count INTEGER;
  total_count INTEGER;
  failed_count INTEGER;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE status IN ('pending', 'queued', 'running')),
    COUNT(*),
    COUNT(*) FILTER (WHERE status = 'failed')
  INTO pending_count, total_count, failed_count
  FROM wide_research_subtasks
  WHERE job_id = NEW.job_id;

  IF pending_count = 0 THEN
    IF failed_count = 0 THEN
      UPDATE wide_research_jobs
      SET status = 'completed', completed_at = NOW()
      WHERE id = NEW.job_id AND status = 'running';
    ELSIF failed_count < total_count THEN
      UPDATE wide_research_jobs
      SET status = 'partial', completed_at = NOW()
      WHERE id = NEW.job_id AND status = 'running';
    ELSE
      UPDATE wide_research_jobs
      SET status = 'failed', completed_at = NOW()
      WHERE id = NEW.job_id AND status = 'running';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for completion check
DROP TRIGGER IF EXISTS trigger_check_wide_research_completion ON wide_research_subtasks;
CREATE TRIGGER trigger_check_wide_research_completion
  AFTER UPDATE OF status ON wide_research_subtasks
  FOR EACH ROW
  WHEN (NEW.status IN ('completed', 'failed', 'skipped'))
  EXECUTE FUNCTION check_wide_research_completion();
