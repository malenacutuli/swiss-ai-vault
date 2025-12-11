-- Drop the overly permissive policy that exposes all user fields
DROP POLICY IF EXISTS "Organization members can view each other" ON public.users;

-- Create a security definer function to get org member profiles with limited fields only
CREATE OR REPLACE FUNCTION public.get_org_member_profiles(p_org_id uuid)
RETURNS TABLE (
  id uuid,
  avatar_url text,
  display_name text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    u.id,
    u.avatar_url,
    -- Only expose first name or a masked version for privacy
    COALESCE(
      SPLIT_PART(u.full_name, ' ', 1),
      'Member'
    ) as display_name
  FROM public.users u
  INNER JOIN public.organization_members om ON om.user_id = u.id
  WHERE om.org_id = p_org_id
    AND EXISTS (
      SELECT 1 FROM public.organization_members 
      WHERE org_id = p_org_id AND user_id = auth.uid()
    )
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.get_org_member_profiles(uuid) TO authenticated;