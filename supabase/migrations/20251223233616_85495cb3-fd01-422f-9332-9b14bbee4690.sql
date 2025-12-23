-- Fix users table RLS: restrict SELECT to own profile only, keep admin access via security definer function
-- Drop existing overly permissive policies
DROP POLICY IF EXISTS "Users can view own data" ON public.users;
DROP POLICY IF EXISTS "Admins can view all users" ON public.users;
DROP POLICY IF EXISTS "Users can update own data" ON public.users;

-- Create new restrictive policies
-- Users can only view their own profile
CREATE POLICY "Users can view own profile"
ON public.users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Admins can view all users (uses existing has_role security definer function)
CREATE POLICY "Admins can view all users"
ON public.users
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Users can update their own profile only
CREATE POLICY "Users can update own profile"
ON public.users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Users can insert their own profile only (for new user creation triggers)
CREATE POLICY "Users can insert own profile"
ON public.users
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id);