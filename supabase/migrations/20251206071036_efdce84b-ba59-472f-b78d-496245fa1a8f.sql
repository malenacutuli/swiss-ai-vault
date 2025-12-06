-- Add DELETE policy for finetuning_jobs table
CREATE POLICY "Users can delete own jobs" 
  ON public.finetuning_jobs 
  FOR DELETE 
  USING (user_id = auth.uid());

-- Add DELETE policy for experiments table
CREATE POLICY "Users can delete own experiments" 
  ON public.experiments 
  FOR DELETE 
  USING (job_id IN (
    SELECT id FROM public.finetuning_jobs 
    WHERE user_id = auth.uid()
  ));