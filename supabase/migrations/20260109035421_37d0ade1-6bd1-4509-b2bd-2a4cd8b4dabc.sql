-- Agent Tool Executions table (for tracking tool calls within tasks)
CREATE TABLE IF NOT EXISTS public.agent_tool_executions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE NOT NULL,
  step_id UUID REFERENCES public.agent_task_steps(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  tool_name TEXT NOT NULL,
  tool_category TEXT NOT NULL,
  input_params JSONB,
  output_result JSONB,
  execution_time_ms INTEGER,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'success', 'failed', 'blocked', 'cancelled')),
  error_message TEXT,
  required_confirmation BOOLEAN DEFAULT FALSE,
  user_confirmed BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tool_executions_task ON public.agent_tool_executions(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tool_executions_user ON public.agent_tool_executions(user_id);
CREATE INDEX IF NOT EXISTS idx_tool_executions_status ON public.agent_tool_executions(status);

-- Agent Files table (for generated/modified files)
CREATE TABLE IF NOT EXISTS public.agent_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE NOT NULL,
  step_id UUID REFERENCES public.agent_task_steps(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content TEXT,
  original_content TEXT,
  content_type TEXT,
  size_bytes INTEGER,
  storage_bucket TEXT,
  storage_path TEXT,
  action_type TEXT DEFAULT 'created' CHECK (action_type IN ('created', 'modified', 'deleted', 'renamed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_files_task ON public.agent_files(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_files_user ON public.agent_files(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_files_path ON public.agent_files(file_path);

-- Enable RLS
ALTER TABLE public.agent_tool_executions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_files ENABLE ROW LEVEL SECURITY;

-- RLS Policies for agent_tool_executions
CREATE POLICY "Users can view own tool executions"
  ON public.agent_tool_executions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own tool executions"
  ON public.agent_tool_executions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own tool executions"
  ON public.agent_tool_executions FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for agent_files
CREATE POLICY "Users can view own files"
  ON public.agent_files FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own files"
  ON public.agent_files FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own files"
  ON public.agent_files FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own files"
  ON public.agent_files FOR DELETE
  USING (auth.uid() = user_id);

-- Add plan_id to agent_checkpoints if not exists (links checkpoint to specific plan)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'agent_checkpoints' 
    AND column_name = 'plan_id'
  ) THEN
    ALTER TABLE public.agent_checkpoints ADD COLUMN plan_id UUID REFERENCES public.agent_plans(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add updated_at trigger for agent_files
CREATE OR REPLACE FUNCTION public.update_agent_files_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_agent_files_updated_at ON public.agent_files;
CREATE TRIGGER update_agent_files_updated_at
  BEFORE UPDATE ON public.agent_files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_files_updated_at();