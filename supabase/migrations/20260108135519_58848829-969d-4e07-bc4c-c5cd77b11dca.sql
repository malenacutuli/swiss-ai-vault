-- Add audio tracking to anonymous_usage table
ALTER TABLE anonymous_usage 
ADD COLUMN IF NOT EXISTS daily_audio_used INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS max_daily_audio INTEGER DEFAULT 1;