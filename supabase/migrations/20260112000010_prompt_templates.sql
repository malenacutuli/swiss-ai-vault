-- Prompt templates
CREATE TABLE IF NOT EXISTS prompt_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  content TEXT NOT NULL,
  variables JSONB DEFAULT '[]',
  model_id VARCHAR(100) REFERENCES ai_models(id),
  temperature DECIMAL(3, 2) DEFAULT 0.7,
  max_tokens INTEGER,
  is_public BOOLEAN DEFAULT FALSE,
  is_system BOOLEAN DEFAULT FALSE,
  version INTEGER DEFAULT 1,
  parent_id UUID REFERENCES prompt_templates(id),
  use_count INTEGER DEFAULT 0,
  avg_rating DECIMAL(3, 2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_templates_user ON prompt_templates(user_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_public ON prompt_templates(is_public) WHERE is_public = TRUE;
CREATE INDEX IF NOT EXISTS idx_prompt_templates_system ON prompt_templates(is_system) WHERE is_system = TRUE;

-- Template usage tracking
CREATE TABLE IF NOT EXISTS template_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES prompt_templates(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  variables_used JSONB,
  model_id VARCHAR(100),
  tokens_used INTEGER,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_template_usage_template ON template_usage(template_id);
CREATE INDEX IF NOT EXISTS idx_template_usage_user ON template_usage(user_id);

-- RLS
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE template_usage ENABLE ROW LEVEL SECURITY;

-- Users can see own templates, public templates, and system templates
CREATE POLICY "View own and public templates" ON prompt_templates
  FOR SELECT USING (
    auth.uid() = user_id
    OR is_public = TRUE
    OR is_system = TRUE
  );

CREATE POLICY "Users manage own templates" ON prompt_templates
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Service role full access templates" ON prompt_templates
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

CREATE POLICY "Users view own template usage" ON template_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users create template usage" ON template_usage
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role full access usage" ON template_usage
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Seed system templates
INSERT INTO prompt_templates (name, description, category, content, variables, is_system, is_public) VALUES
(
  'Code Review',
  'Review code for bugs, security issues, and best practices',
  'development',
  'Review the following {{language}} code for:
1. Bugs and potential errors
2. Security vulnerabilities
3. Performance issues
4. Code style and best practices

Code:
```{{language}}
{{code}}
```

Provide specific line-by-line feedback where applicable.',
  '[{"name": "language", "description": "Programming language", "default": "python"}, {"name": "code", "description": "Code to review", "required": true}]',
  TRUE,
  TRUE
),
(
  'Email Composer',
  'Draft professional emails with specified tone',
  'writing',
  'Write a {{tone}} email to {{recipient}} about {{subject}}.

Key points to include:
{{key_points}}

The email should be {{length}} and maintain a professional yet {{tone}} tone.',
  '[{"name": "tone", "description": "Email tone", "default": "professional"}, {"name": "recipient", "description": "Who the email is for", "required": true}, {"name": "subject", "description": "Email subject", "required": true}, {"name": "key_points", "description": "Main points to cover", "required": true}, {"name": "length", "description": "Email length", "default": "concise"}]',
  TRUE,
  TRUE
),
(
  'Data Analyst',
  'Analyze data and provide insights',
  'analysis',
  'Analyze the following {{data_type}} data:

{{data}}

Please provide:
1. Key statistics and metrics
2. Notable patterns or trends
3. Anomalies or outliers
4. Actionable insights
5. Recommendations based on the analysis

Format the response with clear sections and use tables where appropriate.',
  '[{"name": "data_type", "description": "Type of data", "default": "tabular"}, {"name": "data", "description": "Data to analyze", "required": true}]',
  TRUE,
  TRUE
),
(
  'Meeting Summary',
  'Summarize meeting notes into action items',
  'productivity',
  'Summarize the following meeting notes:

{{notes}}

Please provide:
1. Meeting Overview (2-3 sentences)
2. Key Discussion Points
3. Decisions Made
4. Action Items (with owners and deadlines if mentioned)
5. Next Steps

Format as a structured document suitable for sharing.',
  '[{"name": "notes", "description": "Raw meeting notes", "required": true}]',
  TRUE,
  TRUE
),
(
  'Technical Documentation',
  'Generate technical documentation for code or APIs',
  'development',
  'Generate {{doc_type}} documentation for the following:

{{content}}

Include:
1. Overview/Purpose
2. Installation/Setup (if applicable)
3. Usage examples
4. API reference (if applicable)
5. Configuration options
6. Troubleshooting common issues

Use markdown formatting with proper code blocks.',
  '[{"name": "doc_type", "description": "Type of documentation", "default": "README"}, {"name": "content", "description": "Code or API to document", "required": true}]',
  TRUE,
  TRUE
),
(
  'Swiss Legal Summary',
  'Summarize legal documents with Swiss law context',
  'legal',
  'Summarize the following legal document in the context of Swiss law:

{{document}}

Please provide:
1. Document Type and Purpose
2. Key Parties Involved
3. Main Provisions and Obligations
4. Relevant Swiss Legal Framework (cite specific laws if applicable)
5. Potential Risks or Concerns
6. Recommended Actions

Note: This is for informational purposes only and does not constitute legal advice.',
  '[{"name": "document", "description": "Legal document text", "required": true}]',
  TRUE,
  TRUE
)
ON CONFLICT DO NOTHING;

-- Function to render template with variables
CREATE OR REPLACE FUNCTION render_template(
  p_template_id UUID,
  p_variables JSONB
)
RETURNS TEXT AS $$
DECLARE
  v_content TEXT;
  v_var RECORD;
  v_value TEXT;
BEGIN
  SELECT content INTO v_content FROM prompt_templates WHERE id = p_template_id;

  IF v_content IS NULL THEN
    RAISE EXCEPTION 'Template not found';
  END IF;

  -- Replace each variable
  FOR v_var IN SELECT * FROM jsonb_array_elements(p_variables) AS elem
  LOOP
    v_value := v_var.elem->>'value';
    v_content := REPLACE(v_content, '{{' || (v_var.elem->>'name') || '}}', COALESCE(v_value, ''));
  END LOOP;

  RETURN v_content;
END;
$$ LANGUAGE plpgsql;

-- Function to increment use count
CREATE OR REPLACE FUNCTION use_template(
  p_template_id UUID,
  p_user_id UUID,
  p_variables JSONB DEFAULT NULL,
  p_model_id VARCHAR DEFAULT NULL,
  p_tokens INTEGER DEFAULT NULL
)
RETURNS TEXT AS $$
DECLARE
  v_rendered TEXT;
BEGIN
  -- Increment use count
  UPDATE prompt_templates
  SET use_count = use_count + 1, updated_at = NOW()
  WHERE id = p_template_id;

  -- Record usage
  INSERT INTO template_usage (template_id, user_id, variables_used, model_id, tokens_used)
  VALUES (p_template_id, p_user_id, p_variables, p_model_id, p_tokens);

  -- Render and return
  SELECT render_template(p_template_id, COALESCE(p_variables, '[]'::JSONB)) INTO v_rendered;

  RETURN v_rendered;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update average rating
CREATE OR REPLACE FUNCTION update_template_rating()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE prompt_templates
  SET avg_rating = (
    SELECT AVG(rating)::DECIMAL(3,2)
    FROM template_usage
    WHERE template_id = NEW.template_id AND rating IS NOT NULL
  )
  WHERE id = NEW.template_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_template_rating_trigger
AFTER INSERT OR UPDATE OF rating ON template_usage
FOR EACH ROW
WHEN (NEW.rating IS NOT NULL)
EXECUTE FUNCTION update_template_rating();
