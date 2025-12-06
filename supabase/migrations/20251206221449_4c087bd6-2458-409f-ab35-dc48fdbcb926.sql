-- Create base_models table for the model catalog
CREATE TABLE IF NOT EXISTS public.base_models (
  id VARCHAR PRIMARY KEY,
  name VARCHAR NOT NULL,
  provider VARCHAR NOT NULL,
  parameters VARCHAR,
  context_length INTEGER,
  is_finetunable BOOLEAN DEFAULT true,
  is_active BOOLEAN DEFAULT true,
  input_price NUMERIC(10, 4) DEFAULT 0,
  output_price NUMERIC(10, 4) DEFAULT 0,
  license_type VARCHAR DEFAULT 'open',
  category VARCHAR DEFAULT 'general',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.base_models ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read base_models (it's a catalog)
CREATE POLICY "Anyone can view base models"
ON public.base_models
FOR SELECT
USING (true);

-- Only admins can modify base_models
CREATE POLICY "Admins can manage base models"
ON public.base_models
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add comment
COMMENT ON TABLE public.base_models IS 'Catalog of available base models for fine-tuning and inference';