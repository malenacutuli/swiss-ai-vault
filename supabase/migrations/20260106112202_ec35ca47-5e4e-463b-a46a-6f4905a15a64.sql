-- RLS policies for sso_sessions (service role only - managed by edge functions)
CREATE POLICY "SSO sessions service access"
  ON public.sso_sessions FOR ALL
  TO service_role
  USING (true);

-- RLS policies for sso_audit_logs
CREATE POLICY "Org admins can view SSO audit logs"
  ON public.sso_audit_logs FOR SELECT
  TO authenticated
  USING (
    organization_id IS NULL OR
    EXISTS (
      SELECT 1 FROM public.organization_members om
      WHERE om.org_id = organization_id 
      AND om.user_id = auth.uid()
      AND om.role IN ('owner', 'admin')
    )
  );