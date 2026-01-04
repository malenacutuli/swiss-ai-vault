-- Create the audio-briefings storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-briefings', 
  'audio-briefings', 
  false,
  52428800,
  ARRAY['audio/mpeg', 'audio/mp3', 'audio/wav']
)
ON CONFLICT (id) DO NOTHING;

-- RLS: Users can read their own audio briefings
CREATE POLICY "Users can read own audio briefings"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'audio-briefings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Users can upload their own audio briefings  
CREATE POLICY "Users can upload own audio briefings"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'audio-briefings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Users can delete their own audio briefings
CREATE POLICY "Users can delete own audio briefings"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'audio-briefings' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- RLS: Service role full access (for edge functions)
CREATE POLICY "Service role full access to audio briefings"
ON storage.objects FOR ALL
USING (bucket_id = 'audio-briefings' AND auth.role() = 'service_role')
WITH CHECK (bucket_id = 'audio-briefings' AND auth.role() = 'service_role');