-- 1. Agent task logs for live terminal view
CREATE TABLE IF NOT EXISTS agent_task_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  log_type TEXT DEFAULT 'stdout', -- stdout, stderr, system
  content TEXT NOT NULL,
  timestamp TIMESTAMPTZ DEFAULT now(),
  sequence_number INTEGER
);

-- Index for fast retrieval
CREATE INDEX IF NOT EXISTS idx_task_logs_task_id ON agent_task_logs(task_id, sequence_number);

-- 2. NotebookLM-style sources
CREATE TABLE IF NOT EXISTS agent_notebook_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  source_type TEXT, -- pdf, url, youtube, audio, text
  source_name TEXT,
  source_url TEXT,
  content_summary TEXT,
  full_text TEXT,
  embeddings vector(384),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Generated study materials (flashcards, quizzes)
CREATE TABLE IF NOT EXISTS agent_study_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  material_type TEXT, -- flashcard, quiz, mindmap, timeline, faq
  content JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Scheduled tasks
CREATE TABLE IF NOT EXISTS scheduled_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  schedule_type TEXT, -- once, daily, weekly, monthly
  schedule_time TIME,
  schedule_day INTEGER, -- day of week (0-6) or day of month (1-31)
  next_run TIMESTAMPTZ,
  last_run TIMESTAMPTZ,
  run_mode TEXT DEFAULT 'confirm', -- confirm, auto
  connectors JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Presentation templates
CREATE TABLE IF NOT EXISTS presentation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  theme_name TEXT, -- zurich, geneva, alps, etc.
  preview_url TEXT,
  colors JSONB, -- { primary, secondary, accent, background }
  fonts JSONB, -- { heading, body }
  is_premium BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Seed Swiss templates
INSERT INTO presentation_templates (name, theme_name, preview_url, colors, fonts) VALUES
('Swiss Classic', 'swiss-classic', '/templates/swiss-classic.png', 
 '{"primary": "#1A365D", "secondary": "#722F37", "accent": "#D4AF37", "background": "#FFFFFF"}',
 '{"heading": "Inter", "body": "Inter"}'),
('Zurich', 'zurich', '/templates/zurich.png',
 '{"primary": "#0F4C81", "secondary": "#1D4E5F", "accent": "#10B981", "background": "#F8FAFC"}',
 '{"heading": "Inter", "body": "Inter"}'),
('Geneva', 'geneva', '/templates/geneva.png',
 '{"primary": "#722F37", "secondary": "#1A365D", "accent": "#F59E0B", "background": "#FFFBEB"}',
 '{"heading": "Playfair Display", "body": "Inter"}'),
('Alps', 'alps', '/templates/alps.png',
 '{"primary": "#1E3A5F", "secondary": "#3B82F6", "accent": "#FFFFFF", "background": "#0F172A"}',
 '{"heading": "Inter", "body": "Inter"}'),
('Glacier', 'glacier', '/templates/glacier.png',
 '{"primary": "#0EA5E9", "secondary": "#06B6D4", "accent": "#FFFFFF", "background": "#F0F9FF"}',
 '{"heading": "Inter", "body": "Inter"}'),
('Burgundy', 'burgundy', '/templates/burgundy.png',
 '{"primary": "#722F37", "secondary": "#4A1C23", "accent": "#D4AF37", "background": "#FDF2F8"}',
 '{"heading": "Playfair Display", "body": "Lora"}'),
('Minimal', 'minimal', '/templates/minimal.png',
 '{"primary": "#1A1A1A", "secondary": "#666666", "accent": "#000000", "background": "#FFFFFF"}',
 '{"heading": "Inter", "body": "Inter"}'),
('Navy', 'navy', '/templates/navy.png',
 '{"primary": "#1A365D", "secondary": "#2D4A6F", "accent": "#F59E0B", "background": "#F8FAFC"}',
 '{"heading": "Inter", "body": "Inter"}')
ON CONFLICT DO NOTHING;

-- RLS Policies
ALTER TABLE agent_task_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_notebook_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE agent_study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE scheduled_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE presentation_templates ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Users can view own task logs" ON agent_task_logs;
DROP POLICY IF EXISTS "Users can view own notebook sources" ON agent_notebook_sources;
DROP POLICY IF EXISTS "Users can view own study materials" ON agent_study_materials;
DROP POLICY IF EXISTS "Users can manage own scheduled tasks" ON scheduled_tasks;
DROP POLICY IF EXISTS "Anyone can view presentation templates" ON presentation_templates;

CREATE POLICY "Users can view own task logs" ON agent_task_logs
  FOR SELECT USING (
    task_id IN (SELECT id FROM agent_tasks WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can view own notebook sources" ON agent_notebook_sources
  FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view own study materials" ON agent_study_materials
  FOR SELECT USING (
    task_id IN (SELECT id FROM agent_tasks WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can manage own scheduled tasks" ON scheduled_tasks
  FOR ALL USING (user_id = auth.uid());

-- Presentation templates are public read
CREATE POLICY "Anyone can view presentation templates" ON presentation_templates
  FOR SELECT USING (true);