-- Revoke anon access to users table for defense-in-depth
-- RLS policies already target 'authenticated' only, but removing anon grant adds extra security layer
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.users FROM anon;

-- Clean up duplicate policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;