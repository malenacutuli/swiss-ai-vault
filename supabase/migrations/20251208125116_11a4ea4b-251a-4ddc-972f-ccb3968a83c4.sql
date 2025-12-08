-- Drop and recreate api_keys policy with explicit role targeting
DROP POLICY IF EXISTS "Users can manage own API keys" ON public.api_keys;

-- Create policy explicitly for authenticated users only
CREATE POLICY "Users can manage own API keys" 
ON public.api_keys 
FOR ALL 
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());