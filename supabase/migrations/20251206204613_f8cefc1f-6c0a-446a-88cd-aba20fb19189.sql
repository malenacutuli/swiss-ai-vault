-- ============================================
-- STEP 1: Add owner_id column to organizations
-- ============================================
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- ============================================
-- STEP 2: Create helper functions (avoids recursion)
-- ============================================
CREATE OR REPLACE FUNCTION public.is_org_admin(_user_id uuid, _org_id uuid)
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
    AND role = 'admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_org_member(_user_id uuid, _org_id uuid)
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
  )
$$;

-- ============================================
-- STEP 3: Fix organizations table policies
-- ============================================

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Org members can view" ON public.organizations;

-- Allow org members to view their organizations
CREATE POLICY "Org members can view organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), id));

-- Allow authenticated users to create organizations
CREATE POLICY "Users can create organizations"
ON public.organizations
FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

-- Allow org admins to update their organization
CREATE POLICY "Org admins can update organization"
ON public.organizations
FOR UPDATE
TO authenticated
USING (public.is_org_admin(auth.uid(), id))
WITH CHECK (public.is_org_admin(auth.uid(), id));

-- Allow org owner to delete organization
CREATE POLICY "Org owner can delete organization"
ON public.organizations
FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

-- ============================================
-- STEP 4: Fix organization_members policies
-- ============================================

-- Drop the recursive policy
DROP POLICY IF EXISTS "Org admins can manage members" ON public.organization_members;
DROP POLICY IF EXISTS "Users can view own memberships" ON public.organization_members;

-- Members can view their own org's members
CREATE POLICY "Org members can view members"
ON public.organization_members
FOR SELECT
TO authenticated
USING (public.is_org_member(auth.uid(), org_id) OR user_id = auth.uid());

-- Users can add themselves as admin (for org creation - first member)
CREATE POLICY "Users can add themselves as first admin"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid() 
  AND role = 'admin'
);

-- Admins can add other members
CREATE POLICY "Org admins can add members"
ON public.organization_members
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_org_admin(auth.uid(), org_id)
  AND user_id != auth.uid()
);

-- Admins can update member roles
CREATE POLICY "Org admins can update members"
ON public.organization_members
FOR UPDATE
TO authenticated
USING (public.is_org_admin(auth.uid(), org_id))
WITH CHECK (public.is_org_admin(auth.uid(), org_id));

-- Admins can remove members (except themselves)
CREATE POLICY "Org admins can remove members"
ON public.organization_members
FOR DELETE
TO authenticated
USING (
  public.is_org_admin(auth.uid(), org_id)
  AND user_id != auth.uid()
);

-- Members can leave organization
CREATE POLICY "Members can leave organization"
ON public.organization_members
FOR DELETE
TO authenticated
USING (user_id = auth.uid());