-- Add vision capability columns
ALTER TABLE base_models ADD COLUMN IF NOT EXISTS supports_vision BOOLEAN DEFAULT false;
ALTER TABLE base_models ADD COLUMN IF NOT EXISTS supports_images BOOLEAN DEFAULT false;
ALTER TABLE base_models ADD COLUMN IF NOT EXISTS model_type TEXT DEFAULT 'text';