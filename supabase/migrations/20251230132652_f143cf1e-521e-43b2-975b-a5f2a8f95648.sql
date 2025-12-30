-- Harden audit_logs table: Revoke anonymous access and ensure RLS is enforced

-- 1. Revoke all permissions from anon role on audit_logs
REVOKE ALL ON public.audit_logs FROM anon;

-- 2. Ensure RLS is enabled and forced
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs FORCE ROW LEVEL SECURITY;

-- 3. Add explicit deny policy for anonymous role
CREATE POLICY "Deny anonymous access to audit_logs"
ON public.audit_logs
FOR ALL
TO anon
USING (false)
WITH CHECK (false);