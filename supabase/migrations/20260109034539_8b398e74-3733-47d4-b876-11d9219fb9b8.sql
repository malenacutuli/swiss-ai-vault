-- Fix function search path for cleanup_old_checkpoints
CREATE OR REPLACE FUNCTION public.cleanup_old_checkpoints()
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;