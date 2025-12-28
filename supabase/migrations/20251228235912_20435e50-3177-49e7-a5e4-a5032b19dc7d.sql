-- Revoke all anonymous access to traces table for defense-in-depth
-- This prevents any data exposure even if RLS policies are misconfigured
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.traces FROM anon;

-- Ensure RLS is enabled (should already be, but confirm)
ALTER TABLE public.traces ENABLE ROW LEVEL SECURITY;