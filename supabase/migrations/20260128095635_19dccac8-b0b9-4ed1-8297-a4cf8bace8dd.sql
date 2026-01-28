-- Fix healthcare_audit_log for HIPAA compliance: make it immutable
-- Only service_role can insert, users can only view their own, no updates/deletes allowed

-- Drop existing policies
DROP POLICY IF EXISTS "System inserts audit logs" ON public.healthcare_audit_log;
DROP POLICY IF EXISTS "Users view own audit logs" ON public.healthcare_audit_log;

-- Create strict SELECT policy: users can only view their own logs
CREATE POLICY "Users can view own healthcare audit logs"
ON public.healthcare_audit_log
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Create INSERT policy: only service_role can insert audit logs
CREATE POLICY "Only service role can insert healthcare audit logs"
ON public.healthcare_audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- Explicitly deny UPDATE and DELETE by not creating any policies for those operations
-- RLS will block them by default since no matching policy exists

-- Create a trigger to prevent any updates or deletes as an extra safety measure
CREATE OR REPLACE FUNCTION public.prevent_healthcare_audit_modification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE EXCEPTION 'Healthcare audit logs are immutable and cannot be modified or deleted for HIPAA compliance';
  RETURN NULL;
END;
$$;

-- Drop existing trigger if it exists and recreate
DROP TRIGGER IF EXISTS prevent_healthcare_audit_modification ON public.healthcare_audit_log;

CREATE TRIGGER prevent_healthcare_audit_modification
BEFORE UPDATE OR DELETE ON public.healthcare_audit_log
FOR EACH ROW
EXECUTE FUNCTION public.prevent_healthcare_audit_modification();