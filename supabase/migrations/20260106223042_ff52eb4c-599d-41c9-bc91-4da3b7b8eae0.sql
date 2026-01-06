-- Add public read policy for presentation_templates (drop if exists first)
DROP POLICY IF EXISTS "Anyone can view templates" ON presentation_templates;
CREATE POLICY "Anyone can view templates" ON presentation_templates
  FOR SELECT USING (true);

-- Create storage bucket for agent outputs
INSERT INTO storage.buckets (id, name, public)
VALUES ('agent-outputs', 'agent-outputs', true)
ON CONFLICT DO NOTHING;

-- Storage policies for agent outputs (drop if exists first)
DROP POLICY IF EXISTS "Users can upload agent outputs" ON storage.objects;
CREATE POLICY "Users can upload agent outputs"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'agent-outputs' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can view agent outputs" ON storage.objects;
CREATE POLICY "Anyone can view agent outputs"
ON storage.objects FOR SELECT
USING (bucket_id = 'agent-outputs');