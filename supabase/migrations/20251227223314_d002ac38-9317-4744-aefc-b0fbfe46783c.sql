
-- Add daily usage columns to ghost_usage
ALTER TABLE ghost_usage 
ADD COLUMN IF NOT EXISTS usage_date DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS prompts_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS images_generated INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS videos_generated INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS files_uploaded INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS web_searches INTEGER DEFAULT 0;

-- Update existing records to set usage_date from created_at
UPDATE ghost_usage 
SET usage_date = DATE(created_at)
WHERE usage_date IS NULL OR usage_date = CURRENT_DATE;

-- Create index for user+date lookups
CREATE INDEX IF NOT EXISTS idx_ghost_usage_user_date ON ghost_usage(user_id, usage_date);
