-- Create checkpoints table for task recovery
CREATE TABLE public.agent_checkpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  checkpoint_type TEXT NOT NULL DEFAULT 'auto', -- auto, phase_complete, pre_dangerous, user_pause, completion
  state JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days')
);

-- Index for efficient checkpoint retrieval
CREATE INDEX idx_checkpoints_task_created ON public.agent_checkpoints(task_id, created_at DESC);
CREATE INDEX idx_checkpoints_user ON public.agent_checkpoints(user_id);
CREATE INDEX idx_checkpoints_expires ON public.agent_checkpoints(expires_at);

-- Enable RLS
ALTER TABLE public.agent_checkpoints ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view their own checkpoints"
  ON public.agent_checkpoints FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own checkpoints"
  ON public.agent_checkpoints FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own checkpoints"
  ON public.agent_checkpoints FOR DELETE
  USING (auth.uid() = user_id);

-- Function to cleanup old checkpoints (keep last 5 per task, delete expired)
CREATE OR REPLACE FUNCTION cleanup_old_checkpoints()
RETURNS void AS $$
BEGIN
  -- Delete expired checkpoints (except completion type)
  DELETE FROM public.agent_checkpoints 
  WHERE expires_at < NOW() 
  AND checkpoint_type != 'completion';
  
  -- Keep only last 5 checkpoints per task (except completion type)
  DELETE FROM public.agent_checkpoints c1
  WHERE checkpoint_type != 'completion'
  AND id NOT IN (
    SELECT id FROM public.agent_checkpoints c2
    WHERE c2.task_id = c1.task_id
    ORDER BY created_at DESC
    LIMIT 5
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;