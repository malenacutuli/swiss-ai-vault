-- =============================================
-- SWISSVAULT AGENTS DATABASE MIGRATION
-- =============================================

-- 1. Main task tracking table (add missing columns)
ALTER TABLE IF EXISTS agent_tasks 
ADD COLUMN IF NOT EXISTS progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS memory_context JSONB,
ADD COLUMN IF NOT EXISTS params JSONB,
ADD COLUMN IF NOT EXISTS result JSONB,
ADD COLUMN IF NOT EXISTS output_files TEXT[],
ADD COLUMN IF NOT EXISTS thinking_level VARCHAR(20),
ADD COLUMN IF NOT EXISTS cost_usd DECIMAL(10, 6) DEFAULT 0;

-- 2. Add missing columns to agent_task_steps
ALTER TABLE IF EXISTS agent_task_steps
ADD COLUMN IF NOT EXISTS title VARCHAR(255),
ADD COLUMN IF NOT EXISTS input_data JSONB,
ADD COLUMN IF NOT EXISTS output_data JSONB;

-- Update title from step_type if null
UPDATE agent_task_steps SET title = step_type WHERE title IS NULL AND step_type IS NOT NULL;

-- 3. Add sequence_number to logs if missing
ALTER TABLE IF EXISTS agent_task_logs
ADD COLUMN IF NOT EXISTS sequence_number INTEGER;

-- Create sequence for log ordering
CREATE SEQUENCE IF NOT EXISTS agent_task_logs_seq;

-- 4. Deep research jobs table
CREATE TABLE IF NOT EXISTS deep_research_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  depth VARCHAR(20) DEFAULT 'standard',
  status VARCHAR(20) DEFAULT 'pending',
  report TEXT,
  citations JSONB,
  sources_used INTEGER DEFAULT 0,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. TTS generations table
CREATE TABLE IF NOT EXISTS tts_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  text TEXT NOT NULL,
  voice VARCHAR(50) NOT NULL,
  audio_url TEXT,
  audio_duration_seconds DECIMAL(10, 2),
  character_count INTEGER,
  cost_usd DECIMAL(10, 6),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Video generations table
CREATE TABLE IF NOT EXISTS video_generations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  prompt TEXT NOT NULL,
  style VARCHAR(50),
  status VARCHAR(20) DEFAULT 'pending',
  video_url TEXT,
  video_duration_seconds DECIMAL(10, 2),
  cost_usd DECIMAL(10, 6),
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 7. Presentation templates table
CREATE TABLE IF NOT EXISTS presentation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  theme_name VARCHAR(100) NOT NULL,
  preview_url TEXT,
  colors JSONB NOT NULL,
  fonts JSONB NOT NULL,
  is_premium BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_deep_research_jobs_user_id ON deep_research_jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_deep_research_jobs_status ON deep_research_jobs(status);
CREATE INDEX IF NOT EXISTS idx_tts_generations_user_id ON tts_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_user_id ON video_generations(user_id);
CREATE INDEX IF NOT EXISTS idx_video_generations_status ON video_generations(status);
CREATE INDEX IF NOT EXISTS idx_agent_task_logs_sequence ON agent_task_logs(task_id, sequence_number);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================
ALTER TABLE deep_research_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE tts_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE video_generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentation_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies first
DROP POLICY IF EXISTS "Users manage own research" ON deep_research_jobs;
DROP POLICY IF EXISTS "Users manage own TTS" ON tts_generations;
DROP POLICY IF EXISTS "Users manage own videos" ON video_generations;
DROP POLICY IF EXISTS "Anyone can view templates" ON presentation_templates;

-- Create policies
CREATE POLICY "Users manage own research" ON deep_research_jobs
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own TTS" ON tts_generations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own videos" ON video_generations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view templates" ON presentation_templates
  FOR SELECT USING (TRUE);

-- =============================================
-- SEED PRESENTATION TEMPLATES
-- =============================================
INSERT INTO presentation_templates (name, theme_name, colors, fonts, is_premium) VALUES
('Swiss Classic', 'swiss-classic', 
  '{"primary": "#1D4E5F", "secondary": "#FFFFFF", "accent": "#E8F4F8", "text": "#1F2937"}',
  '{"heading": "Inter", "body": "Inter"}',
  FALSE
),
('Zurich', 'zurich',
  '{"primary": "#0F4C81", "secondary": "#F8FAFC", "accent": "#E2E8F0", "text": "#1E293B"}',
  '{"heading": "Playfair Display", "body": "Inter"}',
  FALSE
),
('Alpine', 'alpine',
  '{"primary": "#1A365D", "secondary": "#FFFFFF", "accent": "#F0FDF4", "text": "#1F2937"}',
  '{"heading": "Inter", "body": "Inter"}',
  FALSE
),
('Geneva', 'geneva',
  '{"primary": "#722F37", "secondary": "#FFFBF5", "accent": "#FEF3C7", "text": "#1C1917"}',
  '{"heading": "Playfair Display", "body": "Inter"}',
  TRUE
),
('Corporate Swiss', 'corporate-swiss',
  '{"primary": "#18181B", "secondary": "#FFFFFF", "accent": "#F4F4F5", "text": "#27272A"}',
  '{"heading": "Inter", "body": "Inter"}',
  TRUE
)
ON CONFLICT DO NOTHING;

-- =============================================
-- HELPER FUNCTION: Calculate Gemini API cost
-- =============================================
CREATE OR REPLACE FUNCTION calculate_gemini_cost(
  model_name TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER
) RETURNS DECIMAL(10, 6) AS $$
DECLARE
  input_rate DECIMAL(10, 6);
  output_rate DECIMAL(10, 6);
BEGIN
  CASE model_name
    WHEN 'gemini-2.5-flash' THEN
      input_rate := 0.00000175;
      output_rate := 0.000007;
    WHEN 'gemini-2.5-pro' THEN
      input_rate := 0.0000035;
      output_rate := 0.000014;
    WHEN 'gemini-3-pro-preview' THEN
      input_rate := 0.000007;
      output_rate := 0.000021;
    WHEN 'gemini-3-flash-preview' THEN
      input_rate := 0.0000035;
      output_rate := 0.000014;
    ELSE
      input_rate := 0.000002;
      output_rate := 0.000008;
  END CASE;
  
  RETURN (input_tokens * input_rate) + (output_tokens * output_rate);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;