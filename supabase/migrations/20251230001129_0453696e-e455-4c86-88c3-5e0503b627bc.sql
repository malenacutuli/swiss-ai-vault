-- Revoke all anon access to audit_logs table (defense-in-depth)
REVOKE ALL ON public.audit_logs FROM anon;

-- Drop existing SELECT policies and recreate with authenticated role targeting
DROP POLICY IF EXISTS "Org admins can view audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;

-- Recreate policies targeting authenticated role explicitly
CREATE POLICY "Org admins can view audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (org_id IN (
  SELECT org_id FROM organization_members
  WHERE user_id = auth.uid() AND role IN ('admin', 'owner')
));

CREATE POLICY "Users can view own audit logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());