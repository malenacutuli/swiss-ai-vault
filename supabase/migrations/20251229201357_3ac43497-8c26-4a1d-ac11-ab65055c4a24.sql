-- ============================================
-- ANONYMOUS USAGE TRACKING
-- Full model access, capped daily usage
-- ============================================

CREATE TABLE IF NOT EXISTS anonymous_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Identifier (SHA-256 hash of IP)
  ip_hash TEXT NOT NULL UNIQUE,
  fingerprint_hash TEXT,
  
  -- Daily Usage Counters
  daily_prompts_used INTEGER DEFAULT 0,
  daily_images_used INTEGER DEFAULT 0,
  daily_videos_used INTEGER DEFAULT 0,
  daily_research_used INTEGER DEFAULT 0,
  daily_reset_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Limits (ALL models allowed, just capped)
  max_daily_prompts INTEGER DEFAULT 10,
  max_daily_images INTEGER DEFAULT 2,
  max_daily_videos INTEGER DEFAULT 2,
  max_daily_research INTEGER DEFAULT 2,
  
  -- Tracking
  first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  total_prompts_lifetime INTEGER DEFAULT 0,
  
  -- Abuse detection
  is_blocked BOOLEAN DEFAULT FALSE,
  block_reason TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_ip ON anonymous_usage(ip_hash);
CREATE INDEX IF NOT EXISTS idx_anonymous_usage_fingerprint ON anonymous_usage(fingerprint_hash) WHERE fingerprint_hash IS NOT NULL;

-- RLS
ALTER TABLE anonymous_usage ENABLE ROW LEVEL SECURITY;

-- Service role can manage all records (edge functions use service role)
CREATE POLICY "Service role manages anonymous" ON anonymous_usage 
  FOR ALL 
  USING (auth.role() = 'service_role');

-- ============================================
-- FUNCTION: Check anonymous usage (any type)
-- ============================================

CREATE OR REPLACE FUNCTION check_anonymous_usage(
  p_ip_hash TEXT,
  p_usage_type TEXT DEFAULT 'prompt',
  p_fingerprint TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_record RECORD;
  v_limit INTEGER;
  v_used INTEGER;
  v_column_name TEXT;
BEGIN
  -- Upsert record
  INSERT INTO anonymous_usage (ip_hash, fingerprint_hash, daily_reset_at)
  VALUES (p_ip_hash, p_fingerprint, NOW())
  ON CONFLICT (ip_hash) DO UPDATE SET
    fingerprint_hash = COALESCE(p_fingerprint, anonymous_usage.fingerprint_hash),
    last_seen_at = NOW(),
    updated_at = NOW()
  RETURNING * INTO v_record;
  
  -- Check if blocked
  IF v_record.is_blocked THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', 'Access restricted',
      'signup_required', TRUE
    );
  END IF;
  
  -- Reset if 24 hours passed
  IF v_record.daily_reset_at < NOW() - INTERVAL '24 hours' THEN
    UPDATE anonymous_usage
    SET daily_prompts_used = 0, 
        daily_images_used = 0, 
        daily_videos_used = 0,
        daily_research_used = 0,
        daily_reset_at = NOW()
    WHERE ip_hash = p_ip_hash
    RETURNING * INTO v_record;
  END IF;
  
  -- Get limit/usage based on type
  CASE p_usage_type
    WHEN 'prompt' THEN
      v_limit := v_record.max_daily_prompts;
      v_used := v_record.daily_prompts_used;
      v_column_name := 'daily_prompts_used';
    WHEN 'image' THEN
      v_limit := v_record.max_daily_images;
      v_used := v_record.daily_images_used;
      v_column_name := 'daily_images_used';
    WHEN 'video' THEN
      v_limit := v_record.max_daily_videos;
      v_used := v_record.daily_videos_used;
      v_column_name := 'daily_videos_used';
    WHEN 'research' THEN
      v_limit := v_record.max_daily_research;
      v_used := v_record.daily_research_used;
      v_column_name := 'daily_research_used';
    ELSE
      v_limit := v_record.max_daily_prompts;
      v_used := v_record.daily_prompts_used;
      v_column_name := 'daily_prompts_used';
  END CASE;
  
  -- Check limit
  IF v_used >= v_limit THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'reason', format('%s/%s daily %s limit reached. Sign up free for more!', v_used, v_limit, p_usage_type),
      'used', v_used,
      'limit', v_limit,
      'type', p_usage_type,
      'resets_in_seconds', EXTRACT(EPOCH FROM (v_record.daily_reset_at + INTERVAL '24 hours' - NOW()))::INTEGER,
      'signup_required', TRUE
    );
  END IF;
  
  -- Increment usage
  EXECUTE format('UPDATE anonymous_usage SET %I = %I + 1, total_prompts_lifetime = total_prompts_lifetime + 1 WHERE ip_hash = $1', v_column_name, v_column_name)
  USING p_ip_hash;
  
  -- Return all usage info for UI
  RETURN jsonb_build_object(
    'allowed', TRUE,
    'type', p_usage_type,
    'used', v_used + 1,
    'limit', v_limit,
    'remaining', v_limit - v_used - 1,
    'is_anonymous', TRUE,
    'all_usage', jsonb_build_object(
      'prompts', jsonb_build_object('used', v_record.daily_prompts_used + (CASE WHEN p_usage_type = 'prompt' THEN 1 ELSE 0 END), 'limit', v_record.max_daily_prompts),
      'images', jsonb_build_object('used', v_record.daily_images_used + (CASE WHEN p_usage_type = 'image' THEN 1 ELSE 0 END), 'limit', v_record.max_daily_images),
      'videos', jsonb_build_object('used', v_record.daily_videos_used + (CASE WHEN p_usage_type = 'video' THEN 1 ELSE 0 END), 'limit', v_record.max_daily_videos),
      'research', jsonb_build_object('used', v_record.daily_research_used + (CASE WHEN p_usage_type = 'research' THEN 1 ELSE 0 END), 'limit', v_record.max_daily_research)
    ),
    'resets_in_seconds', EXTRACT(EPOCH FROM (v_record.daily_reset_at + INTERVAL '24 hours' - NOW()))::INTEGER
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;