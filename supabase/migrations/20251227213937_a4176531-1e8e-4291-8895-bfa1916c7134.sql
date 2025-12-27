-- Drop existing SELECT policies on users table
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Authenticated users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;

-- Create new secure SELECT policies with explicit role targeting
CREATE POLICY "Users can only view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Admins can view all user profiles"
ON public.users
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));