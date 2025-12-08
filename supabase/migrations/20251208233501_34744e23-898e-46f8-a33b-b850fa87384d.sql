-- Drop existing policies on users table
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;

-- Create new policies that explicitly target authenticated role only
CREATE POLICY "Authenticated users can view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (id = auth.uid());

CREATE POLICY "Authenticated users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));