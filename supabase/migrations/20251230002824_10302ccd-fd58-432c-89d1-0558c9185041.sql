-- Revoke all anon access to users table (defense-in-depth)
REVOKE ALL ON public.users FROM anon;

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;