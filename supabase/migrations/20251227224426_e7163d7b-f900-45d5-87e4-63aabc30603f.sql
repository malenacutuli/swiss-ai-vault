-- ═══════════════════════════════════════════════════════════════════════════
-- GHOST CHAT TIER & USAGE SYSTEM
-- Extends existing infrastructure for Ghost Chat tiers
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Create subscription_tiers table for tier definitions
CREATE TABLE IF NOT EXISTS subscription_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  price_monthly_cents INTEGER DEFAULT 0,
  features_json JSONB DEFAULT '{}'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE subscription_tiers ENABLE ROW LEVEL SECURITY;

-- Anyone can view active tiers
CREATE POLICY "Anyone can view active tiers" ON subscription_tiers
  FOR SELECT USING (is_active = true);

-- Admins can manage tiers
CREATE POLICY "Admins can manage tiers" ON subscription_tiers
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Insert Ghost-specific tiers
INSERT INTO subscription_tiers (name, display_name, price_monthly_cents, features_json) VALUES
  ('ghost_free', 'Ghost Free', 0, '{
    "prompts_per_day": 15,
    "images_per_day": 3,
    "videos_per_day": 3,
    "files_per_day": 5,
    "searches_per_day": 5,
    "models": ["swissvault-1.0", "swiss-models"],
    "history": true,
    "encryption": true
  }'),
  ('ghost_pro', 'Ghost Pro', 1500, '{
    "prompts_per_day": -1,
    "images_per_day": 50,
    "videos_per_day": 20,
    "files_per_day": 50,
    "searches_per_day": -1,
    "models": ["all"],
    "history": true,
    "encryption": true,
    "commercial_models": true
  }'),
  ('swissvault_pro', 'SwissVault Pro', 4900, '{
    "prompts_per_day": -1,
    "images_per_day": 100,
    "videos_per_day": 50,
    "files_per_day": -1,
    "searches_per_day": -1,
    "models": ["all"],
    "history": true,
    "encryption": true,
    "commercial_models": true,
    "vault_chat": true,
    "fine_tuning": true,
    "api_access": true
  }')
ON CONFLICT (name) DO UPDATE SET
  price_monthly_cents = EXCLUDED.price_monthly_cents,
  features_json = EXCLUDED.features_json,
  updated_at = NOW();

-- 3. Add tier column to ghost_subscriptions if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ghost_subscriptions' AND column_name = 'tier'
  ) THEN
    ALTER TABLE ghost_subscriptions ADD COLUMN tier TEXT DEFAULT 'free';
  END IF;
END $$;

-- 4. Function: Get user's Ghost tier and limits
CREATE OR REPLACE FUNCTION get_ghost_tier(p_user_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_tier TEXT;
  v_features JSONB;
BEGIN
  -- Get tier from ghost_subscriptions
  SELECT COALESCE(gs.tier, gs.plan, 'free')
  INTO v_tier
  FROM ghost_subscriptions gs
  WHERE gs.user_id = p_user_id;
  
  -- Default to free if no subscription
  IF v_tier IS NULL THEN
    v_tier := 'free';
  END IF;
  
  -- Map tier to full tier name
  IF v_tier = 'free' THEN
    v_tier := 'ghost_free';
  ELSIF v_tier = 'pro' THEN
    v_tier := 'ghost_pro';
  END IF;
  
  -- Get features from subscription_tiers
  SELECT features_json INTO v_features 
  FROM subscription_tiers WHERE name = v_tier;
  
  -- Default features if tier not found
  IF v_features IS NULL THEN
    v_features := '{
      "prompts_per_day": 15,
      "images_per_day": 3,
      "videos_per_day": 3,
      "files_per_day": 5,
      "searches_per_day": 5
    }'::JSONB;
  END IF;
  
  RETURN jsonb_build_object(
    'tier', v_tier,
    'features', v_features
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Function: Check and increment Ghost usage (enhanced version)
CREATE OR REPLACE FUNCTION check_ghost_usage(
  p_user_id UUID,
  p_type TEXT  -- 'prompt', 'image', 'video', 'file', 'search'
)
RETURNS JSONB AS $$
DECLARE
  v_tier_data JSONB;
  v_tier TEXT;
  v_limit INTEGER;
  v_current INTEGER;
  v_usage ghost_usage;
BEGIN
  -- Get tier info
  v_tier_data := get_ghost_tier(p_user_id);
  v_tier := v_tier_data->>'tier';
  
  -- Get limit for this type
  v_limit := CASE p_type
    WHEN 'prompt' THEN (v_tier_data->'features'->>'prompts_per_day')::INTEGER
    WHEN 'image' THEN (v_tier_data->'features'->>'images_per_day')::INTEGER
    WHEN 'video' THEN (v_tier_data->'features'->>'videos_per_day')::INTEGER
    WHEN 'file' THEN (v_tier_data->'features'->>'files_per_day')::INTEGER
    WHEN 'search' THEN (v_tier_data->'features'->>'searches_per_day')::INTEGER
    ELSE 0
  END;
  
  -- -1 means unlimited
  IF v_limit = -1 THEN
    RETURN jsonb_build_object('allowed', true, 'unlimited', true, 'tier', v_tier);
  END IF;
  
  -- Get or create today's usage
  SELECT * INTO v_usage FROM ghost_usage 
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE
  ORDER BY created_at DESC LIMIT 1;
  
  -- Get current usage
  v_current := CASE p_type
    WHEN 'prompt' THEN COALESCE(v_usage.prompts_used, 0)
    WHEN 'image' THEN COALESCE(v_usage.images_generated, 0)
    WHEN 'video' THEN COALESCE(v_usage.videos_generated, 0)
    WHEN 'file' THEN COALESCE(v_usage.files_uploaded, 0)
    WHEN 'search' THEN COALESCE(v_usage.web_searches, 0)
    ELSE 0
  END;
  
  -- Check limit
  IF v_current >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', false,
      'current', v_current,
      'limit', v_limit,
      'tier', v_tier,
      'resets_at', (CURRENT_DATE + INTERVAL '1 day')::TEXT
    );
  END IF;
  
  RETURN jsonb_build_object(
    'allowed', true,
    'current', v_current,
    'limit', v_limit,
    'remaining', v_limit - v_current,
    'tier', v_tier
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. Grant execute permissions
GRANT EXECUTE ON FUNCTION get_ghost_tier(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION check_ghost_usage(UUID, TEXT) TO authenticated;