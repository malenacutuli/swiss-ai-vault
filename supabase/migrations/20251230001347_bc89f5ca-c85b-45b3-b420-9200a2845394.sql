-- Revoke all anon access to users table (defense-in-depth)
REVOKE ALL ON public.users FROM anon;

-- Drop existing SELECT policies and recreate with authenticated role targeting
DROP POLICY IF EXISTS "Users can only view own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all user profiles" ON public.users;

-- Recreate policies targeting authenticated role explicitly
CREATE POLICY "Users can only view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all user profiles"
ON public.users
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'));