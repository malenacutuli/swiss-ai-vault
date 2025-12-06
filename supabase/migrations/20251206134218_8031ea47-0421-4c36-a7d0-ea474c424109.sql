-- Create notification when finetuning job status changes
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

-- Create trigger for job status changes
DROP TRIGGER IF EXISTS on_job_status_change ON public.finetuning_jobs;
CREATE TRIGGER on_job_status_change
  AFTER UPDATE ON public.finetuning_jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.create_job_notification();

-- Create notification when evaluation status changes
CREATE OR REPLACE FUNCTION public.create_evaluation_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.user_id,
      'Evaluation Complete',
      'Your evaluation has finished running',
      'success',
      jsonb_build_object('evaluation_id', NEW.id, 'link', '/dashboard/evaluations')
    );
  ELSIF NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.user_id,
      'Evaluation Failed',
      format('Your evaluation has failed: %s', COALESCE(NEW.error_message, 'Unknown error')),
      'error',
      jsonb_build_object('evaluation_id', NEW.id, 'link', '/dashboard/evaluations')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for evaluation status changes
DROP TRIGGER IF EXISTS on_evaluation_status_change ON public.evaluations;
CREATE TRIGGER on_evaluation_status_change
  AFTER UPDATE ON public.evaluations
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.create_evaluation_notification();

-- Create notification when dataset processing completes
CREATE OR REPLACE FUNCTION public.create_dataset_notification()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ready' AND OLD.status IS DISTINCT FROM 'ready' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.user_id,
      'Dataset Ready',
      format('Your dataset "%s" has been processed and is ready to use', NEW.name),
      'success',
      jsonb_build_object('dataset_id', NEW.id, 'link', '/dashboard/datasets')
    );
  ELSIF NEW.status = 'error' AND OLD.status IS DISTINCT FROM 'error' THEN
    INSERT INTO public.notifications (user_id, title, message, type, metadata)
    VALUES (
      NEW.user_id,
      'Dataset Processing Failed',
      format('Your dataset "%s" failed to process: %s', NEW.name, COALESCE(NEW.error_message, 'Unknown error')),
      'error',
      jsonb_build_object('dataset_id', NEW.id, 'link', '/dashboard/datasets')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for dataset status changes
DROP TRIGGER IF EXISTS on_dataset_status_change ON public.datasets;
CREATE TRIGGER on_dataset_status_change
  AFTER UPDATE ON public.datasets
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION public.create_dataset_notification();