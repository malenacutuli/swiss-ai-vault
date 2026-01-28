-- Block anonymous access to unified_subscriptions table
-- This table contains sensitive billing information

-- Revoke all permissions from anon role
REVOKE ALL ON public.unified_subscriptions FROM anon;

-- Ensure the table only allows authenticated users to access their own data
-- Drop any overly permissive policies first
DROP POLICY IF EXISTS "anon_read_unified_subscriptions" ON public.unified_subscriptions;
DROP POLICY IF EXISTS "public_read_unified_subscriptions" ON public.unified_subscriptions;

-- Create explicit deny policy for anon (belt and suspenders approach)
-- This ensures even if permissions are accidentally granted, RLS blocks access
CREATE POLICY "Deny anonymous access to subscriptions"
ON public.unified_subscriptions
FOR ALL
TO anon
USING (false)
WITH CHECK (false);