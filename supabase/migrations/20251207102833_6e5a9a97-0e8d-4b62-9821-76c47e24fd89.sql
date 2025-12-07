-- Add missing columns to organizations table
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS avatar_url TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Update created_by from owner_id for existing records
UPDATE public.organizations SET created_by = owner_id WHERE created_by IS NULL;

-- Add joined_at to organization_members
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS joined_at TIMESTAMPTZ DEFAULT NOW();

-- Update existing records
UPDATE public.organization_members SET joined_at = created_at WHERE joined_at IS NULL;

-- Create organization_invitations table
CREATE TABLE IF NOT EXISTS public.organization_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE NOT NULL,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT UNIQUE NOT NULL,
  invited_by UUID REFERENCES auth.users(id),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add current_organization_id to user_settings
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS current_organization_id UUID REFERENCES public.organizations(id),
ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}'::JSONB;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON public.organization_invitations(email);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON public.organization_invitations(token);
CREATE INDEX IF NOT EXISTS idx_org_invites_org ON public.organization_invitations(organization_id);

-- Enable realtime for invitations
ALTER TABLE public.organization_invitations REPLICA IDENTITY FULL;

-- Enable RLS on invitations
ALTER TABLE public.organization_invitations ENABLE ROW LEVEL SECURITY;

-- Drop existing RLS policies that might conflict
DROP POLICY IF EXISTS "Org members can view organizations" ON public.organizations;
DROP POLICY IF EXISTS "Org admins can update organization" ON public.organizations;
DROP POLICY IF EXISTS "Users can create organizations" ON public.organizations;
DROP POLICY IF EXISTS "Org owner can delete organization" ON public.organizations;
DROP POLICY IF EXISTS "Org members can view members" ON public.organization_members;
DROP POLICY IF EXISTS "Org admins can add members" ON public.organization_members;
DROP POLICY IF EXISTS "Org admins can remove members" ON public.organization_members;
DROP POLICY IF EXISTS "Org admins can update members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can add themselves as first admin" ON public.organization_members;
DROP POLICY IF EXISTS "Members can leave organization" ON public.organization_members;

-- Helper function to check org membership with role
CREATE OR REPLACE FUNCTION public.is_org_member_with_role(_user_id uuid, _org_id uuid, _roles text[])
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.organization_members
    WHERE user_id = _user_id 
    AND org_id = _org_id 
    AND role = ANY(_roles)
  )
$$;

-- Organizations RLS policies
CREATE POLICY "view_member_organizations" ON public.organizations
  FOR SELECT USING (
    created_by = auth.uid() OR 
    public.is_org_member(auth.uid(), id)
  );

CREATE POLICY "update_organization" ON public.organizations
  FOR UPDATE USING (
    public.is_org_member_with_role(auth.uid(), id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "create_organization" ON public.organizations
  FOR INSERT WITH CHECK (
    auth.uid() = created_by OR auth.uid() = owner_id
  );

CREATE POLICY "delete_organization" ON public.organizations
  FOR DELETE USING (
    created_by = auth.uid() OR owner_id = auth.uid()
  );

-- Organization members RLS policies
CREATE POLICY "view_org_members" ON public.organization_members
  FOR SELECT USING (
    public.is_org_member(auth.uid(), org_id) OR user_id = auth.uid()
  );

CREATE POLICY "add_org_members" ON public.organization_members
  FOR INSERT WITH CHECK (
    -- Allow admins/owners to add members
    public.is_org_member_with_role(auth.uid(), org_id, ARRAY['owner', 'admin'])
    OR
    -- Allow users to add themselves as owner (for new org creation)
    (user_id = auth.uid() AND role = 'owner')
  );

CREATE POLICY "update_org_members" ON public.organization_members
  FOR UPDATE USING (
    public.is_org_member_with_role(auth.uid(), org_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "remove_org_members" ON public.organization_members
  FOR DELETE USING (
    public.is_org_member_with_role(auth.uid(), org_id, ARRAY['owner', 'admin'])
    OR user_id = auth.uid()
  );

-- Invitations RLS policies
CREATE POLICY "view_invitations" ON public.organization_invitations
  FOR SELECT USING (
    public.is_org_member_with_role(auth.uid(), organization_id, ARRAY['owner', 'admin'])
    OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
  );

CREATE POLICY "create_invitations" ON public.organization_invitations
  FOR INSERT WITH CHECK (
    public.is_org_member_with_role(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

CREATE POLICY "delete_invitations" ON public.organization_invitations
  FOR DELETE USING (
    public.is_org_member_with_role(auth.uid(), organization_id, ARRAY['owner', 'admin'])
  );

-- Helper function: Create organization and add creator as owner
CREATE OR REPLACE FUNCTION public.create_organization_with_owner(
  p_name TEXT,
  p_slug TEXT,
  p_avatar_url TEXT DEFAULT NULL
) RETURNS public.organizations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org public.organizations;
BEGIN
  -- Insert organization
  INSERT INTO public.organizations (name, slug, avatar_url, created_by, owner_id)
  VALUES (p_name, p_slug, p_avatar_url, auth.uid(), auth.uid())
  RETURNING * INTO v_org;
  
  -- Add creator as owner
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_org.id, auth.uid(), 'owner');
  
  -- Set as user's current organization
  INSERT INTO public.user_settings (user_id, current_organization_id)
  VALUES (auth.uid(), v_org.id)
  ON CONFLICT (user_id) 
  DO UPDATE SET current_organization_id = v_org.id, updated_at = NOW();
  
  RETURN v_org;
END;
$$;

-- Helper function: Accept invitation
CREATE OR REPLACE FUNCTION public.accept_organization_invitation(p_token TEXT)
RETURNS public.organization_members
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invitation public.organization_invitations;
  v_member public.organization_members;
  v_user_email TEXT;
BEGIN
  -- Get current user's email
  SELECT email INTO v_user_email FROM auth.users WHERE id = auth.uid();
  
  -- Find valid invitation
  SELECT * INTO v_invitation 
  FROM public.organization_invitations 
  WHERE token = p_token 
    AND email = v_user_email
    AND expires_at > NOW();
  
  IF v_invitation IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invitation';
  END IF;
  
  -- Add user as member
  INSERT INTO public.organization_members (org_id, user_id, role)
  VALUES (v_invitation.organization_id, auth.uid(), v_invitation.role)
  ON CONFLICT (org_id, user_id) DO UPDATE SET role = v_invitation.role
  RETURNING * INTO v_member;
  
  -- Delete the invitation
  DELETE FROM public.organization_invitations WHERE id = v_invitation.id;
  
  -- Set as current organization
  INSERT INTO public.user_settings (user_id, current_organization_id)
  VALUES (auth.uid(), v_invitation.organization_id)
  ON CONFLICT (user_id) 
  DO UPDATE SET current_organization_id = v_invitation.organization_id, updated_at = NOW();
  
  RETURN v_member;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_organization_with_owner TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_organization_invitation TO authenticated;