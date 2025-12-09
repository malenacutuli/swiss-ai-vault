-- Revoke direct table access from anon role for defense-in-depth
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.api_keys FROM anon;

-- Update the RLS policy to only allow users to see safe columns via a restricted view
-- Drop the existing policy that exposes all columns
DROP POLICY IF EXISTS "Users can manage own API keys" ON public.api_keys;

-- Create a more restrictive SELECT policy that still allows viewing own keys
-- (The actual column restriction will be via application layer - RLS controls row access)
CREATE POLICY "Users can view own API keys"
ON public.api_keys
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Separate policies for INSERT, UPDATE, DELETE with authenticated role only
CREATE POLICY "Users can create own API keys"
ON public.api_keys
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own API keys"
ON public.api_keys
FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own API keys"
ON public.api_keys
FOR DELETE
TO authenticated
USING (user_id = auth.uid());