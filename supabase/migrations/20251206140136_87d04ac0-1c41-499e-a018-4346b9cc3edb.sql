-- Create audit logging function
CREATE OR REPLACE FUNCTION public.log_audit_event()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_logs (user_id, action, resource_type, resource_id, old_values, new_values)
  VALUES (
    auth.uid(),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id)::text,
    CASE WHEN TG_OP = 'DELETE' THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP != 'DELETE' THEN to_jsonb(NEW) ELSE NULL END
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Apply audit triggers to tables
DROP TRIGGER IF EXISTS audit_datasets ON public.datasets;
CREATE TRIGGER audit_datasets AFTER INSERT OR UPDATE OR DELETE ON public.datasets
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_models ON public.models;
CREATE TRIGGER audit_models AFTER INSERT OR UPDATE OR DELETE ON public.models
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();

DROP TRIGGER IF EXISTS audit_finetuning_jobs ON public.finetuning_jobs;
CREATE TRIGGER audit_finetuning_jobs AFTER INSERT OR UPDATE OR DELETE ON public.finetuning_jobs
  FOR EACH ROW EXECUTE FUNCTION public.log_audit_event();