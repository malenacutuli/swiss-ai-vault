-- Create agent_plans table for persistent plan storage
CREATE TABLE IF NOT EXISTS public.agent_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  plan_markdown TEXT NOT NULL,
  plan_title TEXT,
  current_phase INTEGER DEFAULT 1,
  total_phases INTEGER DEFAULT 1,
  completed_tasks INTEGER DEFAULT 0,
  total_tasks INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'completed', 'failed')),
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.agent_plans ENABLE ROW LEVEL SECURITY;

-- Users can only see their own plans
CREATE POLICY "Users can view own plans"
  ON public.agent_plans FOR SELECT
  USING (auth.uid() = user_id);

-- Users can create their own plans
CREATE POLICY "Users can create own plans"
  ON public.agent_plans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own plans
CREATE POLICY "Users can update own plans"
  ON public.agent_plans FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own plans
CREATE POLICY "Users can delete own plans"
  ON public.agent_plans FOR DELETE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_agent_plans_task_id ON public.agent_plans(task_id);
CREATE INDEX IF NOT EXISTS idx_agent_plans_user_id ON public.agent_plans(user_id);
CREATE INDEX IF NOT EXISTS idx_agent_plans_status ON public.agent_plans(status);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_agent_plans_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_agent_plans_updated_at
  BEFORE UPDATE ON public.agent_plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_agent_plans_updated_at();

-- Add comment
COMMENT ON TABLE public.agent_plans IS 'Stores todo.md-style execution plans for agent tasks';