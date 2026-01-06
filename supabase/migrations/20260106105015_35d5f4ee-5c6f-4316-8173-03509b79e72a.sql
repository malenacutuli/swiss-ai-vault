-- ============================================
-- SWISS AGENTS COMPLETE INFRASTRUCTURE
-- ============================================

-- 1. Create agent-outputs storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'agent-outputs', 
  'agent-outputs', 
  true, 
  52428800,
  ARRAY['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain', 'text/markdown', 'text/csv', 'application/json', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'audio/mpeg', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage policies
CREATE POLICY "Users can upload agent outputs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'agent-outputs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read own agent outputs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'agent-outputs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Public can read agent outputs"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'agent-outputs');

-- 3. REASONING TRANSPARENCY TABLES
CREATE TABLE IF NOT EXISTS public.agent_reasoning (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  step_id UUID REFERENCES public.agent_task_steps(id),
  agent_type VARCHAR(50) NOT NULL,
  reasoning_text TEXT NOT NULL,
  confidence_score DECIMAL(3, 2),
  sources_used JSONB DEFAULT '[]',
  decisions_made JSONB DEFAULT '[]',
  alternatives_considered JSONB DEFAULT '[]',
  thinking_duration_ms INTEGER,
  model_used VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  source_url TEXT,
  source_title TEXT,
  source_snippet TEXT,
  relevance_score DECIMAL(3, 2),
  used_in_step UUID REFERENCES public.agent_task_steps(id),
  citation_key VARCHAR(20),
  page_number INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  from_agent VARCHAR(50) NOT NULL,
  to_agent VARCHAR(50) NOT NULL,
  message_type VARCHAR(50) NOT NULL,
  message_content TEXT NOT NULL,
  attachments JSONB DEFAULT '[]',
  tokens_used INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.agent_memory_context (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  user_id UUID,
  context_type VARCHAR(50) NOT NULL,
  context_content TEXT NOT NULL,
  relevance_score DECIMAL(3, 2),
  source_reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. NOTEBOOKLM INTEGRATION TABLES
CREATE TABLE IF NOT EXISTS public.notebooklm_notebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  notebook_id VARCHAR(255) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sources JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notebooklm_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID REFERENCES public.notebooklm_notebooks(id) ON DELETE CASCADE,
  source_type VARCHAR(50) NOT NULL,
  source_uri TEXT,
  title TEXT,
  content_preview TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notebooklm_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id UUID REFERENCES public.notebooklm_notebooks(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.agent_tasks(id),
  output_type VARCHAR(50) NOT NULL,
  content TEXT,
  audio_url TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Add missing columns to action_templates
ALTER TABLE public.action_templates
ADD COLUMN IF NOT EXISTS system_prompt TEXT,
ADD COLUMN IF NOT EXISTS output_schema JSONB,
ADD COLUMN IF NOT EXISTS tool_permissions JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS vertical VARCHAR(50),
ADD COLUMN IF NOT EXISTS complexity VARCHAR(20) DEFAULT 'medium',
ADD COLUMN IF NOT EXISTS requires_notebooklm BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS requires_code_sandbox BOOLEAN DEFAULT false;

-- 6. Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_reasoning;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_sources;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_communications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_memory_context;

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_reasoning_task ON public.agent_reasoning(task_id);
CREATE INDEX IF NOT EXISTS idx_sources_task ON public.agent_sources(task_id);
CREATE INDEX IF NOT EXISTS idx_communications_task ON public.agent_communications(task_id);
CREATE INDEX IF NOT EXISTS idx_memory_task ON public.agent_memory_context(task_id);

-- 8. Update agent_tasks with new fields
ALTER TABLE public.agent_tasks
ADD COLUMN IF NOT EXISTS reasoning_visible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS notebooklm_notebook_id UUID,
ADD COLUMN IF NOT EXISTS output_format VARCHAR(20) DEFAULT 'md',
ADD COLUMN IF NOT EXISTS requested_format VARCHAR(20);

-- 9. Update agent_outputs with format info
ALTER TABLE public.agent_outputs
ADD COLUMN IF NOT EXISTS requested_format VARCHAR(20),
ADD COLUMN IF NOT EXISTS actual_format VARCHAR(20),
ADD COLUMN IF NOT EXISTS conversion_status VARCHAR(20),
ADD COLUMN IF NOT EXISTS notebooklm_source_id UUID;

-- 10. Enable RLS on new tables
ALTER TABLE public.agent_reasoning ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_communications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_memory_context ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooklm_notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooklm_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notebooklm_outputs ENABLE ROW LEVEL SECURITY;

-- 11. RLS Policies for new tables
CREATE POLICY "Users can view reasoning for their tasks" ON public.agent_reasoning
FOR SELECT USING (task_id IN (SELECT id FROM public.agent_tasks WHERE user_id = auth.uid()));

CREATE POLICY "Users can view sources for their tasks" ON public.agent_sources
FOR SELECT USING (task_id IN (SELECT id FROM public.agent_tasks WHERE user_id = auth.uid()));

CREATE POLICY "Users can view communications for their tasks" ON public.agent_communications
FOR SELECT USING (task_id IN (SELECT id FROM public.agent_tasks WHERE user_id = auth.uid()));

CREATE POLICY "Users can view memory context for their tasks" ON public.agent_memory_context
FOR SELECT USING (user_id = auth.uid() OR task_id IN (SELECT id FROM public.agent_tasks WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their notebooks" ON public.notebooklm_notebooks
FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Users can view sources in their notebooks" ON public.notebooklm_sources
FOR SELECT USING (notebook_id IN (SELECT id FROM public.notebooklm_notebooks WHERE user_id = auth.uid()));

CREATE POLICY "Users can view outputs from their notebooks" ON public.notebooklm_outputs
FOR SELECT USING (notebook_id IN (SELECT id FROM public.notebooklm_notebooks WHERE user_id = auth.uid()));