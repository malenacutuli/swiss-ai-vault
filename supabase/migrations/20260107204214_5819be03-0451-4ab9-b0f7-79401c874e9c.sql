-- Fix security issues from Migration 1

-- 1. Enable RLS on org_role_permissions (it's a lookup table, publicly readable)
ALTER TABLE org_role_permissions ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can read role permissions (it's configuration data)
CREATE POLICY "Anyone can read role permissions" ON org_role_permissions
  FOR SELECT USING (true);

-- 2. Fix function search_path for security
CREATE OR REPLACE FUNCTION get_user_org_ids()
RETURNS SETOF UUID AS $$
  SELECT org_id FROM public.organization_members WHERE user_id = auth.uid()
$$ LANGUAGE SQL SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;