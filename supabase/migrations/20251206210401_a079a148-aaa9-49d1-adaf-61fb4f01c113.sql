-- Drop the existing SELECT policy
DROP POLICY IF EXISTS "Org members can view organizations" ON public.organizations;

-- Create new SELECT policy that includes owner access
CREATE POLICY "Org members can view organizations"
ON public.organizations
FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR public.is_org_member(auth.uid(), id));