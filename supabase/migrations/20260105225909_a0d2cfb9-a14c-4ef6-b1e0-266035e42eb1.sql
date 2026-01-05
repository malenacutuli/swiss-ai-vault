-- Add columns to agent_task_steps for tracking file actions
ALTER TABLE public.agent_task_steps 
ADD COLUMN IF NOT EXISTS current_action TEXT,
ADD COLUMN IF NOT EXISTS file_actions JSONB DEFAULT '[]'::jsonb;