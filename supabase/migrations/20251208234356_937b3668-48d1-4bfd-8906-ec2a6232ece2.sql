-- Drop any existing SELECT policies on users table that might be too permissive
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.users;
DROP POLICY IF EXISTS "Anyone can view users" ON public.users;
DROP POLICY IF EXISTS "Public can view users" ON public.users;

-- Create restrictive SELECT policy - users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

-- Allow organization members to view each other's basic info
CREATE POLICY "Organization members can view each other"
ON public.users
FOR SELECT
TO authenticated
USING (
  id IN (
    SELECT om2.user_id 
    FROM public.organization_members om1
    JOIN public.organization_members om2 ON om1.org_id = om2.org_id
    WHERE om1.user_id = auth.uid()
  )
);

-- Ensure UPDATE policy is also authenticated-only
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());