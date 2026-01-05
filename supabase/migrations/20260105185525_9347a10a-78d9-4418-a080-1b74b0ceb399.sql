-- ============================================================================
-- SWISSVAULT AGENTIC INFRASTRUCTURE MIGRATION
-- Version: 1.0.0
-- Date: January 5, 2026
-- ============================================================================

-- ============================================================================
-- TABLE 1: agent_tasks (Core task tracking - Manus-style)
-- ============================================================================

CREATE TABLE agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Task definition
  prompt TEXT NOT NULL,
  task_type VARCHAR(50) DEFAULT 'general',
  mode VARCHAR(20) DEFAULT 'agent',
  
  -- Execution state
  status VARCHAR(30) DEFAULT 'queued',
  current_step INTEGER DEFAULT 0,
  total_steps INTEGER DEFAULT 0,
  progress_percentage INTEGER DEFAULT 0,
  
  -- Planning
  plan_summary TEXT,
  plan_json JSONB,
  
  -- Privacy settings
  privacy_tier VARCHAR(20) DEFAULT 'vault',
  
  -- Results
  result_summary TEXT,
  error_message TEXT,
  
  -- Metadata
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  tokens_used INTEGER DEFAULT 0,
  credits_used DECIMAL(10,4) DEFAULT 0,
  
  -- Model used
  model_id VARCHAR(100) DEFAULT 'claude-sonnet-4-5-20250929',
  
  -- Sharing
  is_shared BOOLEAN DEFAULT false,
  share_token VARCHAR(64) UNIQUE,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE agent_tasks IS 'Manus-style autonomous task tracking';
COMMENT ON COLUMN agent_tasks.status IS 'queued|planning|executing|waiting_input|completed|failed|cancelled';
COMMENT ON COLUMN agent_tasks.mode IS 'agent|chat|adaptive';
COMMENT ON COLUMN agent_tasks.privacy_tier IS 'ghost|vault|agent';

-- ============================================================================
-- TABLE 2: agent_task_steps (Step-by-step execution log)
-- ============================================================================

CREATE TABLE agent_task_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE NOT NULL,
  
  step_number INTEGER NOT NULL,
  step_type VARCHAR(50) NOT NULL,
  description TEXT,
  
  status VARCHAR(20) DEFAULT 'pending',
  
  -- Tool call details
  tool_name VARCHAR(100),
  tool_input JSONB,
  tool_output JSONB,
  
  -- Error handling
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE agent_task_steps IS 'Individual execution steps within a task';
COMMENT ON COLUMN agent_task_steps.step_type IS 'plan|tool_call|output|review|human_input';
COMMENT ON COLUMN agent_task_steps.status IS 'pending|executing|completed|failed|skipped';

-- ============================================================================
-- TABLE 3: agent_outputs (Generated files - PPTX, DOCX, etc.)
-- ============================================================================

CREATE TABLE agent_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  output_type VARCHAR(50) NOT NULL,
  file_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500),
  file_size_bytes BIGINT,
  mime_type VARCHAR(100),
  
  -- Preview URLs
  preview_url VARCHAR(500),
  thumbnail_url VARCHAR(500),
  download_url VARCHAR(500),
  
  -- Encryption (Swiss security)
  is_encrypted BOOLEAN DEFAULT true,
  encryption_key_id UUID,
  
  -- Storage info
  storage_bucket VARCHAR(100) DEFAULT 'agent-outputs',
  storage_region VARCHAR(50) DEFAULT 'eu-central-2',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

COMMENT ON TABLE agent_outputs IS 'Generated files from agentic tasks';
COMMENT ON COLUMN agent_outputs.output_type IS 'pptx|docx|xlsx|pdf|image|code|html|csv|json';

-- ============================================================================
-- TABLE 4: scheduled_tasks (Cron-style recurring automation)
-- ============================================================================

CREATE TABLE scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  prompt TEXT NOT NULL,
  task_type VARCHAR(50) DEFAULT 'general',
  
  -- Schedule configuration
  schedule_type VARCHAR(20) NOT NULL,
  cron_expression VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'Europe/Zurich',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  
  -- Settings
  is_active BOOLEAN DEFAULT true,
  max_retries INTEGER DEFAULT 3,
  timeout_minutes INTEGER DEFAULT 30,
  
  -- Notifications
  notify_on_complete BOOLEAN DEFAULT true,
  notify_on_failure BOOLEAN DEFAULT true,
  notify_channels JSONB DEFAULT '["email"]',
  
  -- Stats
  run_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE scheduled_tasks IS 'Recurring automated tasks like Manus scheduled actions';
COMMENT ON COLUMN scheduled_tasks.schedule_type IS 'once|hourly|daily|weekly|monthly|custom';

-- ============================================================================
-- TABLE 5: wide_research_jobs (Parallel multi-agent processing)
-- ============================================================================

CREATE TABLE wide_research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Research configuration
  research_type VARCHAR(50) DEFAULT 'general',
  template_id UUID,
  
  -- Items to process
  total_items INTEGER NOT NULL,
  items_completed INTEGER DEFAULT 0,
  items_failed INTEGER DEFAULT 0,
  items_data JSONB NOT NULL,
  
  -- Worker management
  parallel_workers INTEGER DEFAULT 10,
  max_workers INTEGER DEFAULT 50,
  worker_status JSONB DEFAULT '[]',
  
  -- Results
  results JSONB,
  result_format VARCHAR(50) DEFAULT 'table',
  result_file_path VARCHAR(500),
  
  -- Timing
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  avg_item_duration_ms INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE wide_research_jobs IS 'Manus-style Wide Research for 250+ item parallel processing';
COMMENT ON COLUMN wide_research_jobs.result_format IS 'table|report|dataset|json|csv';

-- ============================================================================
-- TABLE 6: action_templates (Reusable task templates)
-- ============================================================================

CREATE TABLE action_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Template definition
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100),
  icon VARCHAR(50),
  
  -- Prompt template
  prompt_template TEXT NOT NULL,
  required_inputs JSONB DEFAULT '[]',
  default_values JSONB DEFAULT '{}',
  example_inputs JSONB,
  
  -- Execution settings
  estimated_duration_seconds INTEGER DEFAULT 60,
  required_tools JSONB DEFAULT '[]',
  output_types JSONB DEFAULT '[]',
  
  -- Visibility
  is_public BOOLEAN DEFAULT false,
  is_featured BOOLEAN DEFAULT false,
  created_by UUID REFERENCES auth.users(id),
  
  -- Usage stats
  usage_count INTEGER DEFAULT 0,
  avg_rating DECIMAL(3,2),
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE action_templates IS 'Library of reusable action templates (100+ planned)';

-- ============================================================================
-- TABLE 7: agent_sessions (Browser/sandbox sessions)
-- ============================================================================

CREATE TABLE agent_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  session_type VARCHAR(50) NOT NULL,
  
  -- Session state
  status VARCHAR(20) DEFAULT 'active',
  
  -- Browser sessions
  browser_url VARCHAR(500),
  screenshot_url VARCHAR(500),
  
  -- Code sandbox sessions
  workspace_path VARCHAR(500),
  
  -- Timing
  started_at TIMESTAMPTZ DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  
  -- Resource usage
  memory_mb INTEGER,
  cpu_seconds INTEGER,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE agent_sessions IS 'Active browser or code sandbox sessions';
COMMENT ON COLUMN agent_sessions.session_type IS 'browser|code_sandbox|terminal';

-- ============================================================================
-- TABLE 8: agent_tool_calls (Tool invocation audit log)
-- ============================================================================

CREATE TABLE agent_tool_calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE NOT NULL,
  step_id UUID REFERENCES agent_task_steps(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  tool_name VARCHAR(100) NOT NULL,
  tool_version VARCHAR(20),
  
  -- Request/Response (minimal for privacy)
  input_hash VARCHAR(64),
  input_size_bytes INTEGER,
  output_size_bytes INTEGER,
  
  -- Result
  status VARCHAR(20) NOT NULL,
  error_code VARCHAR(50),
  
  -- Timing
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,
  
  -- Cost
  tokens_used INTEGER DEFAULT 0,
  credits_charged DECIMAL(10,4) DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE agent_tool_calls IS 'Audit log of all tool invocations (privacy-preserving)';

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

ALTER TABLE agent_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_task_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_outputs ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE wide_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_tool_calls ENABLE ROW LEVEL SECURITY;

-- Policies: Users own their data
CREATE POLICY "Users own their tasks" ON agent_tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see their task steps" ON agent_task_steps
  FOR ALL USING (task_id IN (SELECT id FROM agent_tasks WHERE user_id = auth.uid()));

CREATE POLICY "Users own their outputs" ON agent_outputs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their schedules" ON scheduled_tasks
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users own their research jobs" ON wide_research_jobs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see public templates" ON action_templates
  FOR SELECT USING (is_public = true OR created_by = auth.uid());

CREATE POLICY "Users manage their templates" ON action_templates
  FOR ALL USING (created_by = auth.uid());

CREATE POLICY "Users own their sessions" ON agent_sessions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users see their tool calls" ON agent_tool_calls
  FOR ALL USING (auth.uid() = user_id);

-- ============================================================================
-- INDEXES (Performance optimization)
-- ============================================================================

CREATE INDEX idx_agent_tasks_user_status ON agent_tasks(user_id, status);
CREATE INDEX idx_agent_tasks_user_created ON agent_tasks(user_id, created_at DESC);
CREATE INDEX idx_agent_tasks_status ON agent_tasks(status) WHERE status NOT IN ('completed', 'failed', 'cancelled');

CREATE INDEX idx_agent_task_steps_task ON agent_task_steps(task_id, step_number);

CREATE INDEX idx_agent_outputs_task ON agent_outputs(task_id);
CREATE INDEX idx_agent_outputs_user ON agent_outputs(user_id, created_at DESC);

CREATE INDEX idx_scheduled_tasks_next_run ON scheduled_tasks(next_run_at) WHERE is_active = true;
CREATE INDEX idx_scheduled_tasks_user ON scheduled_tasks(user_id, is_active);

CREATE INDEX idx_wide_research_status ON wide_research_jobs(user_id) WHERE items_completed < total_items;

CREATE INDEX idx_action_templates_category ON action_templates(category) WHERE is_public = true;
CREATE INDEX idx_action_templates_featured ON action_templates(is_featured, usage_count DESC) WHERE is_public = true;

CREATE INDEX idx_agent_sessions_active ON agent_sessions(user_id, status) WHERE status = 'active';

CREATE INDEX idx_agent_tool_calls_task ON agent_tool_calls(task_id, created_at);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Update task progress
CREATE OR REPLACE FUNCTION update_task_progress()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE agent_tasks 
  SET 
    current_step = (SELECT COUNT(*) FROM agent_task_steps WHERE task_id = NEW.task_id AND status = 'completed'),
    progress_percentage = CASE 
      WHEN total_steps > 0 THEN 
        ((SELECT COUNT(*) FROM agent_task_steps WHERE task_id = NEW.task_id AND status = 'completed')::float / total_steps * 100)::int
      ELSE 0 
    END,
    updated_at = NOW()
  WHERE id = NEW.task_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_task_progress
AFTER UPDATE OF status ON agent_task_steps
FOR EACH ROW
WHEN (NEW.status = 'completed')
EXECUTE FUNCTION update_task_progress();

-- Function: Calculate next run time for scheduled tasks
CREATE OR REPLACE FUNCTION calculate_next_run(
  p_schedule_type VARCHAR(20),
  p_cron_expression VARCHAR(100),
  p_timezone VARCHAR(50)
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_now TIMESTAMPTZ;
  v_next TIMESTAMPTZ;
BEGIN
  v_now := NOW() AT TIME ZONE p_timezone;
  
  CASE p_schedule_type
    WHEN 'hourly' THEN
      v_next := date_trunc('hour', v_now) + INTERVAL '1 hour';
    WHEN 'daily' THEN
      v_next := date_trunc('day', v_now) + INTERVAL '1 day' + INTERVAL '9 hours';
    WHEN 'weekly' THEN
      v_next := date_trunc('week', v_now) + INTERVAL '1 week' + INTERVAL '1 day 9 hours';
    WHEN 'monthly' THEN
      v_next := date_trunc('month', v_now) + INTERVAL '1 month' + INTERVAL '9 hours';
    ELSE
      v_next := v_now + INTERVAL '1 day';
  END CASE;
  
  RETURN v_next AT TIME ZONE p_timezone;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================================================
-- SEED DATA: Default Action Templates
-- ============================================================================

INSERT INTO action_templates (name, description, category, icon, prompt_template, required_inputs, output_types, is_public, is_featured) VALUES
('Research Report', 'Research a topic and create a comprehensive report', 'research', 'search', 'Research {{topic}} thoroughly and create a detailed report covering: background, current state, key players, trends, and future outlook.', '["topic"]', '["docx", "pdf"]', true, true),
('Company Analysis', 'Analyze a company''s business, financials, and market position', 'research', 'building', 'Analyze {{company_name}} including: business model, revenue streams, competitive advantages, market position, recent developments, and investment thesis.', '["company_name"]', '["pptx", "docx"]', true, true),
('Presentation Creator', 'Create a professional presentation on any topic', 'document', 'presentation', 'Create a {{slide_count}}-slide presentation about {{topic}} with clear structure, key points, and supporting data.', '["topic", "slide_count"]', '["pptx"]', true, true),
('Data Analysis', 'Analyze data and create visualizations', 'data', 'chart', 'Analyze the provided data focusing on {{analysis_focus}}. Create visualizations and provide actionable insights.', '["analysis_focus"]', '["xlsx", "pdf"]', true, true),
('Competitor Comparison', 'Compare multiple competitors in a market', 'research', 'users', 'Compare these companies: {{companies}} on dimensions of: products, pricing, market share, strengths, weaknesses, and differentiation.', '["companies"]', '["pptx", "xlsx"]', true, true),
('Executive Summary', 'Create an executive summary from documents', 'document', 'file-text', 'Create a 1-page executive summary of the provided materials, highlighting: key findings, recommendations, and next steps.', '[]', '["docx", "pdf"]', true, false),
('Market Research', 'Research market size, trends, and opportunities', 'research', 'trending-up', 'Research the {{market}} market including: size, growth rate, key trends, major players, and emerging opportunities.', '["market"]', '["pptx", "docx"]', true, true),
('Legal Document Review', 'Review and summarize legal documents', 'legal', 'scale', 'Review the provided {{document_type}} and create a summary of: key terms, obligations, risks, and recommended actions.', '["document_type"]', '["docx"]', true, false),
('Financial Model', 'Create financial projections and models', 'finance', 'calculator', 'Create a {{projection_years}}-year financial model for {{business_type}} including: revenue projections, cost structure, and key metrics.', '["business_type", "projection_years"]', '["xlsx"]', true, false),
('Weekly Report', 'Generate a weekly progress report', 'reporting', 'calendar', 'Create a weekly report summarizing: accomplishments, challenges, next week priorities, and metrics for {{team_or_project}}.', '["team_or_project"]', '["docx", "pptx"]', true, false);