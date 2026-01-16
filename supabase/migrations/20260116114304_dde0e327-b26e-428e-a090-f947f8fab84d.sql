-- Add missing full_text column to studio_sources table
ALTER TABLE public.studio_sources 
ADD COLUMN IF NOT EXISTS full_text TEXT;

COMMENT ON COLUMN public.studio_sources.full_text IS 'Extracted text content from the source document';