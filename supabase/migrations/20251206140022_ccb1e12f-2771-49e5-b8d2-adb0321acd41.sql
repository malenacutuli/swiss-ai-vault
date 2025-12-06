-- Update notification trigger for jobs to use metadata column for link
CREATE OR REPLACE FUNCTION public.create_job_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.user_id,
      'Fine-tuning Complete',
      format('Your job "%s" has finished training successfully', NEW.name),
      'success',
      jsonb_build_object('job_id', NEW.id, 'link', format('/dashboard/finetuning'))
    );
  ELSIF NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.user_id,
      'Fine-tuning Failed',
      format('Your job "%s" has failed: %s', NEW.name, COALESCE(NEW.error_message, 'Unknown error')),
      'error',
      jsonb_build_object('job_id', NEW.id, 'link', format('/dashboard/finetuning'))
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS on_job_status_change ON public.finetuning_jobs;
CREATE TRIGGER on_job_status_change
  AFTER UPDATE ON public.finetuning_jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.create_job_notification();