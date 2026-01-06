-- Update check_user_usage to add admin bypass
CREATE OR REPLACE FUNCTION public.check_user_usage(
  p_user_id UUID,
  p_usage_type TEXT,
  p_estimated_cost_cents INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credits RECORD;
  v_allowed BOOLEAN := FALSE;
  v_balance INTEGER := 0;
  v_daily_remaining INTEGER := 0;
  v_reason TEXT := '';
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Check if user is admin - admins bypass all limits
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'allowed', TRUE,
      'balance', 999999999,
      'daily_remaining', 999999999,
      'image_remaining', 999999999,
      'video_remaining', 999999999,
      'reason', 'admin_bypass'
    );
  END IF;

  -- Get user's credit record
  SELECT * INTO v_credits
  FROM ghost_credits
  WHERE user_id = p_user_id;
  
  -- If no record, user has no credits
  IF v_credits IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', FALSE,
      'balance', 0,
      'daily_remaining', 0,
      'reason', 'no_credit_record'
    );
  END IF;
  
  -- Calculate total available balance
  v_balance := COALESCE(v_credits.free_credits_remaining, 0) + COALESCE(v_credits.paid_credits_balance, 0);
  
  -- Check based on usage type
  CASE p_usage_type
    WHEN 'text' THEN
      -- Text uses token-based balance
      v_daily_remaining := COALESCE(v_credits.daily_free_limit, 50000) - COALESCE(v_credits.daily_free_used, 0);
      v_allowed := v_balance > 0 OR v_daily_remaining > 0;
      IF NOT v_allowed THEN v_reason := 'insufficient_text_credits'; END IF;
      
    WHEN 'image' THEN
      -- Image has daily limit
      v_daily_remaining := COALESCE(v_credits.image_daily_limit, 10) - COALESCE(v_credits.image_daily_used, 0);
      v_allowed := v_daily_remaining > 0 OR COALESCE(v_credits.image_credits_remaining, 0) > 0;
      IF NOT v_allowed THEN v_reason := 'no_image_credits'; END IF;
      
    WHEN 'video' THEN
      -- Video has daily limit
      v_daily_remaining := COALESCE(v_credits.video_daily_limit, 3) - COALESCE(v_credits.video_daily_used, 0);
      v_allowed := v_daily_remaining > 0 OR COALESCE(v_credits.video_credits_remaining, 0) > 0;
      IF NOT v_allowed THEN v_reason := 'no_video_credits'; END IF;
      
    WHEN 'search' THEN
      -- Search uses general balance
      v_allowed := v_balance > 0;
      IF NOT v_allowed THEN v_reason := 'insufficient_credits'; END IF;
      
    WHEN 'tts' THEN
      -- TTS uses general balance
      v_allowed := v_balance > 0;
      IF NOT v_allowed THEN v_reason := 'insufficient_credits'; END IF;
      
    WHEN 'stt' THEN
      -- STT uses general balance
      v_allowed := v_balance > 0;
      IF NOT v_allowed THEN v_reason := 'insufficient_credits'; END IF;
      
    ELSE
      v_allowed := v_balance > 0;
      IF NOT v_allowed THEN v_reason := 'insufficient_credits'; END IF;
  END CASE;
  
  RETURN jsonb_build_object(
    'allowed', v_allowed,
    'balance', v_balance,
    'daily_remaining', v_daily_remaining,
    'image_remaining', COALESCE(v_credits.image_credits_remaining, 0) + 
      (COALESCE(v_credits.image_daily_limit, 10) - COALESCE(v_credits.image_daily_used, 0)),
    'video_remaining', COALESCE(v_credits.video_credits_remaining, 0) + 
      (COALESCE(v_credits.video_daily_limit, 3) - COALESCE(v_credits.video_daily_used, 0)),
    'reason', v_reason
  );
END;
$$;

-- Update check_ghost_usage to add admin bypass
CREATE OR REPLACE FUNCTION public.check_ghost_usage(
  p_user_id UUID,
  p_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier_data JSONB;
  v_tier TEXT;
  v_limit INTEGER;
  v_current INTEGER;
  v_usage ghost_usage;
  v_is_admin BOOLEAN := FALSE;
BEGIN
  -- Check if user is admin - admins bypass all limits
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;
  
  IF v_is_admin THEN
    RETURN jsonb_build_object(
      'allowed', TRUE,
      'unlimited', TRUE,
      'tier', 'admin',
      'current', 0,
      'limit', -1,
      'remaining', 999999999
    );
  END IF;

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
$$;