-- ============================================
-- CREATE STORAGE BUCKETS FOR SWISSVAULT
-- ============================================

-- Create datasets bucket (private, 100MB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'datasets', 
  'datasets', 
  false, 
  104857600,
  ARRAY['application/json', 'application/jsonl', 'text/plain', 'text/csv']
);

-- Create models bucket (private, 5GB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'models', 
  'models', 
  false, 
  5368709120
);

-- Create exports bucket (private, 10GB limit)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES (
  'exports', 
  'exports', 
  false, 
  10737418240
);

-- ============================================
-- STORAGE POLICIES FOR SWISSVAULT
-- ============================================

-- Datasets bucket policies
CREATE POLICY "Users can upload their own datasets"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'datasets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own datasets"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'datasets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own datasets"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'datasets' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Models bucket policies
CREATE POLICY "Users can upload their own models"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'models' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own models"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'models' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own models"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'models' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Exports bucket policies
CREATE POLICY "Users can upload their own exports"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'exports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can view their own exports"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'exports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own exports"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'exports' AND
  (storage.foldername(name))[1] = auth.uid()::text
);