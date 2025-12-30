-- Revoke all anon access to audit_logs (defense-in-depth)
REVOKE ALL ON public.audit_logs FROM anon;

-- Ensure RLS is enabled (should already be, but confirm)
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;