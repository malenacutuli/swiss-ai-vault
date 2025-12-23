-- ==============================================
-- GHOST CHAT COMPLETE DATABASE SCHEMA
-- ==============================================

-- Ghost Mode Settings (per user)
CREATE TABLE IF NOT EXISTS public.ghost_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Theme
  theme TEXT CHECK (theme IN ('light', 'dark', 'system')) DEFAULT 'system',
  accent_color TEXT DEFAULT 'swissNavy',
  
  -- Chat Behavior
  start_temporary BOOLEAN DEFAULT false,
  show_message_date BOOLEAN DEFAULT true,
  enter_submits BOOLEAN DEFAULT true,
  arrow_key_nav BOOLEAN DEFAULT true,
  enter_after_edit TEXT CHECK (enter_after_edit IN ('regenerate', 'fork')) DEFAULT 'regenerate',
  
  -- Privacy
  show_external_link_warning BOOLEAN DEFAULT true,
  disable_telemetry BOOLEAN DEFAULT false,
  hide_personal_info BOOLEAN DEFAULT false,
  
  -- Text Settings
  web_enabled BOOLEAN DEFAULT true,
  url_scraping BOOLEAN DEFAULT false,
  system_prompt TEXT,
  
  -- Voice Settings
  voice_read_responses BOOLEAN DEFAULT false,
  voice_language TEXT DEFAULT 'en-US',
  voice_id TEXT DEFAULT 'alloy',
  voice_speed DECIMAL(2,1) DEFAULT 1.0,
  
  -- Advanced
  disable_system_prompt BOOLEAN DEFAULT false,
  default_temperature DECIMAL(2,1) DEFAULT 0.7,
  default_top_p DECIMAL(2,1) DEFAULT 0.9,
  
  -- Image Settings
  image_aspect_ratio TEXT DEFAULT '1:1',
  image_hide_watermark BOOLEAN DEFAULT false,
  image_enhance_prompts BOOLEAN DEFAULT true,
  image_format TEXT DEFAULT 'webp',
  image_embed_exif BOOLEAN DEFAULT true,
  
  -- Mature Content
  mature_filter_enabled BOOLEAN DEFAULT true,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend ghost_credits with additional fields
ALTER TABLE public.ghost_credits 
  ADD COLUMN IF NOT EXISTS free_credits_remaining INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS paid_credits_balance INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_free_limit INTEGER DEFAULT 20,
  ADD COLUMN IF NOT EXISTS daily_free_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS daily_reset_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS image_credits_remaining INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS image_daily_limit INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS image_daily_used INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS video_credits_remaining INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS video_daily_limit INTEGER DEFAULT 5,
  ADD COLUMN IF NOT EXISTS video_daily_used INTEGER DEFAULT 0;

-- Extend ghost_usage with additional fields
ALTER TABLE public.ghost_usage
  ADD COLUMN IF NOT EXISTS modality TEXT DEFAULT 'text',
  ADD COLUMN IF NOT EXISTS provider TEXT DEFAULT 'modal',
  ADD COLUMN IF NOT EXISTS generation_time_ms INTEGER,
  ADD COLUMN IF NOT EXISTS credits_used DECIMAL(10,4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS was_free_tier BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS resolution TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- Add check constraint for modality
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ghost_usage_modality_check'
  ) THEN
    ALTER TABLE public.ghost_usage 
      ADD CONSTRAINT ghost_usage_modality_check 
      CHECK (modality IN ('text', 'image', 'video', 'voice', 'search'));
  END IF;
END $$;

-- Ghost Library (generated content references)
CREATE TABLE IF NOT EXISTS public.ghost_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Content type
  content_type TEXT NOT NULL CHECK (content_type IN ('image', 'video', 'audio')),
  
  -- Storage
  storage_type TEXT NOT NULL CHECK (storage_type IN ('local', 'cloud')),
  storage_key TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT true,
  
  -- Metadata
  prompt TEXT,
  model_id TEXT,
  
  -- Display
  thumbnail_key TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  file_size_bytes INTEGER,
  format TEXT,
  
  -- Organization
  title TEXT,
  is_favorite BOOLEAN DEFAULT false,
  folder_id UUID,
  tags TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ghost API Keys (for developer access)
CREATE TABLE IF NOT EXISTS public.ghost_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Key details
  name TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  key_prefix TEXT NOT NULL,
  
  -- Permissions
  permissions TEXT[] DEFAULT ARRAY['text', 'image', 'video'],
  
  -- Limits
  rate_limit_per_minute INTEGER DEFAULT 60,
  monthly_credit_limit INTEGER,
  
  -- Usage
  last_used_at TIMESTAMPTZ,
  total_requests INTEGER DEFAULT 0,
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.ghost_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_library ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ghost_api_keys ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ghost_settings
CREATE POLICY "Users manage own ghost settings" 
  ON public.ghost_settings FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for ghost_library
CREATE POLICY "Users manage own ghost library" 
  ON public.ghost_library FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- RLS Policies for ghost_api_keys
CREATE POLICY "Users manage own ghost api keys" 
  ON public.ghost_api_keys FOR ALL 
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_ghost_usage_user_date ON public.ghost_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ghost_library_user_type ON public.ghost_library(user_id, content_type);
CREATE INDEX IF NOT EXISTS idx_ghost_library_favorites ON public.ghost_library(user_id) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_ghost_api_keys_user ON public.ghost_api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_ghost_settings_user ON public.ghost_settings(user_id);

-- Function to initialize ghost settings and credits for new users
CREATE OR REPLACE FUNCTION public.init_ghost_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert ghost settings
  INSERT INTO public.ghost_settings (user_id) 
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Insert ghost credits if not exists
  INSERT INTO public.ghost_credits (user_id, balance, free_credits_remaining, paid_credits_balance) 
  VALUES (NEW.id, 0, 50, 0)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for new users (check if exists first)
DROP TRIGGER IF EXISTS on_auth_user_created_ghost ON auth.users;
CREATE TRIGGER on_auth_user_created_ghost
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.init_ghost_user();

-- Function to reset daily limits
CREATE OR REPLACE FUNCTION public.reset_ghost_daily_limits()
RETURNS void AS $$
BEGIN
  UPDATE public.ghost_credits
  SET 
    daily_free_used = 0,
    image_daily_used = 0,
    video_daily_used = 0,
    daily_reset_at = NOW()
  WHERE daily_reset_at < NOW() - INTERVAL '24 hours'
     OR daily_reset_at IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Function to update ghost_settings updated_at
CREATE OR REPLACE FUNCTION public.update_ghost_settings_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Trigger for ghost_settings updated_at
DROP TRIGGER IF EXISTS update_ghost_settings_updated_at ON public.ghost_settings;
CREATE TRIGGER update_ghost_settings_updated_at
  BEFORE UPDATE ON public.ghost_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_ghost_settings_timestamp();