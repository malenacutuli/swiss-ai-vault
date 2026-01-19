-- Custom Agents Schema
-- Allows users to create reusable agent templates with custom prompts and tools

-- =============================================
-- CUSTOM AGENTS TABLE
-- =============================================

CREATE TABLE IF NOT EXISTS custom_agents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Owner
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID REFERENCES workspaces(id) ON DELETE CASCADE,

  -- Agent identity
  name TEXT NOT NULL,
  slug TEXT NOT NULL, -- URL-friendly identifier
  description TEXT,
  icon TEXT, -- emoji or icon name
  avatar_url TEXT,

  -- Agent configuration
  system_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'claude-3-5-sonnet', -- default model
  temperature DECIMAL(3,2) DEFAULT 0.7,
  max_tokens INTEGER DEFAULT 4096,

  -- Tools configuration
  enabled_tools TEXT[] DEFAULT '{}', -- list of tool names
  tool_config JSONB DEFAULT '{}', -- tool-specific settings

  -- Context and memory
  context_instructions TEXT, -- additional context always included
  memory_enabled BOOLEAN DEFAULT TRUE,
  memory_window INTEGER DEFAULT 20, -- number of messages to remember

  -- Input/output configuration
  input_schema JSONB, -- JSON Schema for structured input
  output_schema JSONB, -- JSON Schema for structured output
  output_format TEXT DEFAULT 'text', -- 'text', 'json', 'markdown'

  -- Conversation starters
  starter_prompts TEXT[] DEFAULT '{}', -- suggested first messages

  -- Capabilities
  can_search_web BOOLEAN DEFAULT TRUE,
  can_execute_code BOOLEAN DEFAULT FALSE,
  can_browse_web BOOLEAN DEFAULT FALSE,
  can_generate_images BOOLEAN DEFAULT FALSE,
  can_access_files BOOLEAN DEFAULT FALSE,

  -- Sharing
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'workspace', 'public')),
  is_featured BOOLEAN DEFAULT FALSE,
  share_token TEXT UNIQUE,

  -- Usage stats
  run_count INTEGER DEFAULT 0,
  avg_satisfaction DECIMAL(3,2),
  last_used_at TIMESTAMPTZ,

  -- Status
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  published_at TIMESTAMPTZ,

  -- Unique slug per user
  UNIQUE(user_id, slug)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_custom_agents_user ON custom_agents(user_id);
CREATE INDEX IF NOT EXISTS idx_custom_agents_workspace ON custom_agents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_custom_agents_visibility ON custom_agents(visibility);
CREATE INDEX IF NOT EXISTS idx_custom_agents_status ON custom_agents(status);
CREATE INDEX IF NOT EXISTS idx_custom_agents_slug ON custom_agents(slug);
CREATE INDEX IF NOT EXISTS idx_custom_agents_featured ON custom_agents(is_featured) WHERE is_featured = TRUE;

-- =============================================
-- AGENT VERSIONS TABLE (for version history)
-- =============================================

CREATE TABLE IF NOT EXISTS custom_agent_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES custom_agents(id) ON DELETE CASCADE,

  -- Version info
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,

  -- Snapshot of configuration
  system_prompt TEXT NOT NULL,
  model TEXT,
  temperature DECIMAL(3,2),
  enabled_tools TEXT[],
  tool_config JSONB,
  context_instructions TEXT,

  -- Change tracking
  change_summary TEXT,
  changed_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique version per agent
  UNIQUE(agent_id, version)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_versions_agent ON custom_agent_versions(agent_id);
CREATE INDEX IF NOT EXISTS idx_agent_versions_created ON custom_agent_versions(created_at DESC);

-- =============================================
-- AGENT TEMPLATES TABLE (pre-built templates)
-- =============================================

CREATE TABLE IF NOT EXISTS agent_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Template identity
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  category TEXT,

  -- Template configuration
  system_prompt TEXT NOT NULL,
  model TEXT DEFAULT 'claude-3-5-sonnet',
  temperature DECIMAL(3,2) DEFAULT 0.7,
  enabled_tools TEXT[] DEFAULT '{}',
  tool_config JSONB DEFAULT '{}',
  context_instructions TEXT,
  starter_prompts TEXT[] DEFAULT '{}',

  -- Capabilities
  can_search_web BOOLEAN DEFAULT TRUE,
  can_execute_code BOOLEAN DEFAULT FALSE,
  can_browse_web BOOLEAN DEFAULT FALSE,

  -- Display
  is_featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 100,

  -- Stats
  use_count INTEGER DEFAULT 0,

  -- Status
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft', 'active', 'deprecated')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_agent_templates_slug ON agent_templates(slug);
CREATE INDEX IF NOT EXISTS idx_agent_templates_category ON agent_templates(category);
CREATE INDEX IF NOT EXISTS idx_agent_templates_featured ON agent_templates(is_featured, display_order);

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE custom_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE custom_agent_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_templates ENABLE ROW LEVEL SECURITY;

-- custom_agents
CREATE POLICY "Users can manage own agents"
  ON custom_agents FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view workspace agents"
  ON custom_agents FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active'
    )
    AND visibility IN ('workspace', 'public')
  );

CREATE POLICY "Anyone can view public agents"
  ON custom_agents FOR SELECT
  USING (visibility = 'public' AND status = 'active');

CREATE POLICY "Service role full access agents"
  ON custom_agents FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- custom_agent_versions
CREATE POLICY "Users can view versions of accessible agents"
  ON custom_agent_versions FOR SELECT
  USING (
    agent_id IN (
      SELECT id FROM custom_agents
      WHERE user_id = auth.uid()
        OR (visibility = 'public' AND status = 'active')
        OR (visibility = 'workspace' AND workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active'
        ))
    )
  );

CREATE POLICY "Users can create versions for own agents"
  ON custom_agent_versions FOR INSERT
  WITH CHECK (
    agent_id IN (SELECT id FROM custom_agents WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access versions"
  ON custom_agent_versions FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- agent_templates
CREATE POLICY "Anyone can view active templates"
  ON agent_templates FOR SELECT
  USING (status = 'active');

CREATE POLICY "Service role full access templates"
  ON agent_templates FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- FUNCTIONS
-- =============================================

-- Generate URL-friendly slug
CREATE OR REPLACE FUNCTION generate_agent_slug(p_name TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(regexp_replace(regexp_replace(p_name, '[^a-zA-Z0-9\s-]', '', 'g'), '\s+', '-', 'g'));
END;
$$ LANGUAGE plpgsql;

-- Create agent with version
CREATE OR REPLACE FUNCTION create_custom_agent(
  p_name TEXT,
  p_system_prompt TEXT,
  p_description TEXT DEFAULT NULL,
  p_workspace_id UUID DEFAULT NULL,
  p_model TEXT DEFAULT 'claude-3-5-sonnet',
  p_enabled_tools TEXT[] DEFAULT '{}',
  p_visibility TEXT DEFAULT 'private'
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_agent_id UUID;
  v_slug TEXT;
  v_slug_suffix INTEGER := 0;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Generate unique slug
  v_slug := generate_agent_slug(p_name);

  -- Handle duplicate slugs
  WHILE EXISTS (SELECT 1 FROM custom_agents WHERE user_id = v_user_id AND slug = v_slug || CASE WHEN v_slug_suffix > 0 THEN '-' || v_slug_suffix ELSE '' END) LOOP
    v_slug_suffix := v_slug_suffix + 1;
  END LOOP;

  IF v_slug_suffix > 0 THEN
    v_slug := v_slug || '-' || v_slug_suffix;
  END IF;

  -- Create agent
  INSERT INTO custom_agents (
    user_id, workspace_id, name, slug, description,
    system_prompt, model, enabled_tools, visibility, status
  ) VALUES (
    v_user_id, p_workspace_id, p_name, v_slug, p_description,
    p_system_prompt, p_model, p_enabled_tools, p_visibility, 'active'
  ) RETURNING id INTO v_agent_id;

  -- Create initial version
  INSERT INTO custom_agent_versions (
    agent_id, version, name, description, system_prompt, model, enabled_tools, change_summary, changed_by
  ) VALUES (
    v_agent_id, 1, p_name, p_description, p_system_prompt, p_model, p_enabled_tools, 'Initial version', v_user_id
  );

  RETURN jsonb_build_object(
    'success', true,
    'agent_id', v_agent_id,
    'slug', v_slug
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update agent and create version
CREATE OR REPLACE FUNCTION update_custom_agent(
  p_agent_id UUID,
  p_updates JSONB,
  p_change_summary TEXT DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_agent RECORD;
  v_new_version INTEGER;
BEGIN
  -- Get current agent
  SELECT * INTO v_agent FROM custom_agents WHERE id = p_agent_id AND user_id = v_user_id;

  IF v_agent IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Agent not found or access denied');
  END IF;

  -- Update agent
  UPDATE custom_agents SET
    name = COALESCE(p_updates->>'name', name),
    description = COALESCE(p_updates->>'description', description),
    system_prompt = COALESCE(p_updates->>'system_prompt', system_prompt),
    model = COALESCE(p_updates->>'model', model),
    temperature = COALESCE((p_updates->>'temperature')::DECIMAL, temperature),
    enabled_tools = COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_updates->'enabled_tools')), enabled_tools),
    tool_config = COALESCE(p_updates->'tool_config', tool_config),
    context_instructions = COALESCE(p_updates->>'context_instructions', context_instructions),
    visibility = COALESCE(p_updates->>'visibility', visibility),
    updated_at = NOW()
  WHERE id = p_agent_id;

  -- Create new version if system_prompt changed
  IF p_updates->>'system_prompt' IS NOT NULL THEN
    SELECT COALESCE(MAX(version), 0) + 1 INTO v_new_version
    FROM custom_agent_versions WHERE agent_id = p_agent_id;

    INSERT INTO custom_agent_versions (
      agent_id, version, name, description, system_prompt, model, enabled_tools, change_summary, changed_by
    )
    SELECT
      p_agent_id,
      v_new_version,
      COALESCE(p_updates->>'name', v_agent.name),
      COALESCE(p_updates->>'description', v_agent.description),
      p_updates->>'system_prompt',
      COALESCE(p_updates->>'model', v_agent.model),
      COALESCE(ARRAY(SELECT jsonb_array_elements_text(p_updates->'enabled_tools')), v_agent.enabled_tools),
      p_change_summary,
      v_user_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'version', v_new_version);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clone agent from template
CREATE OR REPLACE FUNCTION clone_agent_from_template(
  p_template_slug TEXT,
  p_name TEXT DEFAULT NULL,
  p_workspace_id UUID DEFAULT NULL
) RETURNS JSONB AS $$
DECLARE
  v_template RECORD;
  v_result JSONB;
BEGIN
  SELECT * INTO v_template FROM agent_templates WHERE slug = p_template_slug AND status = 'active';

  IF v_template IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Template not found');
  END IF;

  -- Create agent from template
  SELECT create_custom_agent(
    COALESCE(p_name, v_template.name),
    v_template.system_prompt,
    v_template.description,
    p_workspace_id,
    v_template.model,
    v_template.enabled_tools
  ) INTO v_result;

  -- Update template use count
  UPDATE agent_templates SET use_count = use_count + 1 WHERE id = v_template.id;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get agent for execution
CREATE OR REPLACE FUNCTION get_agent_config(
  p_agent_id UUID
) RETURNS JSONB AS $$
DECLARE
  v_agent RECORD;
BEGIN
  SELECT * INTO v_agent
  FROM custom_agents
  WHERE id = p_agent_id AND status = 'active';

  IF v_agent IS NULL THEN
    RETURN NULL;
  END IF;

  -- Update last used
  UPDATE custom_agents SET
    last_used_at = NOW(),
    run_count = run_count + 1
  WHERE id = p_agent_id;

  RETURN jsonb_build_object(
    'id', v_agent.id,
    'name', v_agent.name,
    'system_prompt', v_agent.system_prompt,
    'model', v_agent.model,
    'temperature', v_agent.temperature,
    'max_tokens', v_agent.max_tokens,
    'enabled_tools', v_agent.enabled_tools,
    'tool_config', v_agent.tool_config,
    'context_instructions', v_agent.context_instructions,
    'memory_enabled', v_agent.memory_enabled,
    'memory_window', v_agent.memory_window,
    'output_format', v_agent.output_format,
    'can_search_web', v_agent.can_search_web,
    'can_execute_code', v_agent.can_execute_code,
    'can_browse_web', v_agent.can_browse_web,
    'can_generate_images', v_agent.can_generate_images,
    'can_access_files', v_agent.can_access_files
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- SEED DEFAULT TEMPLATES
-- =============================================

INSERT INTO agent_templates (name, slug, description, icon, category, system_prompt, enabled_tools, starter_prompts, is_featured, display_order)
VALUES
  (
    'Research Assistant',
    'research-assistant',
    'An agent specialized in conducting thorough research and synthesizing information from multiple sources.',
    '🔬',
    'research',
    'You are a research assistant. Your goal is to help users find accurate, comprehensive information on any topic. Always cite your sources, verify facts from multiple sources, and present information in a clear, organized manner. When researching, consider different perspectives and provide balanced analysis.',
    ARRAY['web_search', 'deep_research'],
    ARRAY['Help me research the latest developments in renewable energy', 'What are the key factors to consider when evaluating a startup?', 'Compile a comprehensive overview of AI safety research'],
    TRUE,
    1
  ),
  (
    'Code Assistant',
    'code-assistant',
    'A programming expert that can write, review, debug, and explain code in multiple languages.',
    '💻',
    'development',
    'You are an expert software developer. Help users with coding tasks including writing new code, reviewing existing code, debugging issues, and explaining programming concepts. Write clean, well-documented, and efficient code. Follow best practices and design patterns appropriate for each language.',
    ARRAY['code_execute', 'file_read', 'file_write'],
    ARRAY['Help me write a Python function to process CSV files', 'Review this code and suggest improvements', 'Debug why my React component is not rendering'],
    TRUE,
    2
  ),
  (
    'Writing Assistant',
    'writing-assistant',
    'Helps with all forms of writing - from emails to articles, with grammar checking and style suggestions.',
    '✍️',
    'writing',
    'You are a professional writing assistant. Help users improve their writing, whether it''s emails, articles, reports, or creative writing. Provide suggestions for clarity, grammar, style, and tone. Adapt your feedback to the intended audience and purpose of the writing.',
    ARRAY['web_search'],
    ARRAY['Help me write a professional email to a client', 'Review this article and suggest improvements', 'Help me brainstorm ideas for a blog post about remote work'],
    TRUE,
    3
  ),
  (
    'Data Analyst',
    'data-analyst',
    'Analyzes data, creates visualizations, and provides insights from datasets.',
    '📊',
    'analysis',
    'You are a data analyst expert. Help users analyze data, create visualizations, and extract meaningful insights. You can work with various data formats, perform statistical analysis, and create charts and graphs to present findings clearly. Explain your analysis methodology and findings in accessible terms.',
    ARRAY['code_execute', 'file_read', 'generate_chart'],
    ARRAY['Analyze this CSV file and identify trends', 'Create a visualization of sales data over time', 'Help me perform a statistical analysis of survey results'],
    TRUE,
    4
  ),
  (
    'Meeting Assistant',
    'meeting-assistant',
    'Takes notes, creates summaries, and tracks action items from meetings.',
    '📝',
    'productivity',
    'You are a meeting assistant. Help users prepare for, conduct, and follow up on meetings. You can create agendas, take notes, summarize discussions, track action items, and send follow-up communications. Be concise and focus on key decisions and next steps.',
    ARRAY['calendar_action', 'email_action'],
    ARRAY['Create an agenda for tomorrow''s team meeting', 'Summarize this meeting transcript', 'Draft follow-up email with action items'],
    FALSE,
    5
  )
ON CONFLICT (slug) DO NOTHING;

-- Comments
COMMENT ON TABLE custom_agents IS 'User-created custom agent configurations';
COMMENT ON TABLE custom_agent_versions IS 'Version history for custom agents';
COMMENT ON TABLE agent_templates IS 'Pre-built agent templates for quick start';
COMMENT ON FUNCTION create_custom_agent IS 'Create a new custom agent with initial version';
COMMENT ON FUNCTION update_custom_agent IS 'Update agent and optionally create new version';
COMMENT ON FUNCTION clone_agent_from_template IS 'Create a custom agent from a template';
COMMENT ON FUNCTION get_agent_config IS 'Get agent configuration for execution';
