-- Revoke all anonymous access to users table for defense-in-depth
-- This prevents any data exposure even if RLS policies are misconfigured
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.users FROM anon;

-- Ensure RLS is enabled
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;