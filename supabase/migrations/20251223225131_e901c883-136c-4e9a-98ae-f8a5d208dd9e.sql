-- Create function to check if user has sufficient credits for a given usage type
CREATE OR REPLACE FUNCTION public.check_user_usage(
  p_user_id UUID,
  p_usage_type TEXT,
  p_estimated_cost_cents INTEGER DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_credits RECORD;
  v_allowed BOOLEAN := FALSE;
  v_balance INTEGER := 0;
  v_daily_remaining INTEGER := 0;
  v_reason TEXT := '';
BEGIN
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