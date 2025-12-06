-- Fix api_keys table RLS to block anonymous access
DROP POLICY IF EXISTS "Users can manage own API keys" ON public.api_keys;

-- Recreate with explicit authenticated role requirement
CREATE POLICY "Users can manage own API keys"
ON public.api_keys
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());