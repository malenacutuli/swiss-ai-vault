-- Create function to record usage and deduct credits after generation
CREATE OR REPLACE FUNCTION public.record_ghost_usage(
  p_user_id UUID,
  p_service_type TEXT,
  p_model_id TEXT,
  p_input_tokens INTEGER DEFAULT 0,
  p_output_tokens INTEGER DEFAULT 0,
  p_duration_seconds INTEGER DEFAULT NULL,
  p_resolution TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_credits_used INTEGER := 0;
  v_was_free_tier BOOLEAN := FALSE;
  v_credits RECORD;
BEGIN
  -- Get user's credit record
  SELECT * INTO v_credits
  FROM ghost_credits
  WHERE user_id = p_user_id
  FOR UPDATE;
  
  -- Calculate credits based on service type
  CASE p_service_type
    WHEN 'text' THEN
      -- Text: ~1 credit per 1000 tokens
      v_credits_used := GREATEST(1, CEIL((p_input_tokens + p_output_tokens) / 1000.0));
      
      -- Check if using free daily allowance
      IF COALESCE(v_credits.daily_free_used, 0) + (p_input_tokens + p_output_tokens) <= COALESCE(v_credits.daily_free_limit, 50000) THEN
        v_was_free_tier := TRUE;
        UPDATE ghost_credits
        SET daily_free_used = COALESCE(daily_free_used, 0) + (p_input_tokens + p_output_tokens),
            updated_at = NOW()
        WHERE user_id = p_user_id;
      ELSE
        -- Deduct from paid balance
        UPDATE ghost_credits
        SET paid_credits_balance = GREATEST(0, COALESCE(paid_credits_balance, 0) - v_credits_used),
            updated_at = NOW()
        WHERE user_id = p_user_id;
      END IF;
      
    WHEN 'image' THEN
      v_credits_used := 3; -- Base image cost
      
      -- Check if using free daily allowance
      IF COALESCE(v_credits.image_daily_used, 0) < COALESCE(v_credits.image_daily_limit, 10) THEN
        v_was_free_tier := TRUE;
        UPDATE ghost_credits
        SET image_daily_used = COALESCE(image_daily_used, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id;
      ELSE
        -- Deduct from image credits or paid balance
        IF COALESCE(v_credits.image_credits_remaining, 0) > 0 THEN
          UPDATE ghost_credits
          SET image_credits_remaining = image_credits_remaining - 1,
              updated_at = NOW()
          WHERE user_id = p_user_id;
        ELSE
          UPDATE ghost_credits
          SET paid_credits_balance = GREATEST(0, COALESCE(paid_credits_balance, 0) - v_credits_used),
              updated_at = NOW()
          WHERE user_id = p_user_id;
        END IF;
      END IF;
      
    WHEN 'video' THEN
      v_credits_used := 10; -- Base video cost
      
      -- Check if using free daily allowance
      IF COALESCE(v_credits.video_daily_used, 0) < COALESCE(v_credits.video_daily_limit, 3) THEN
        v_was_free_tier := TRUE;
        UPDATE ghost_credits
        SET video_daily_used = COALESCE(video_daily_used, 0) + 1,
            updated_at = NOW()
        WHERE user_id = p_user_id;
      ELSE
        -- Deduct from video credits or paid balance
        IF COALESCE(v_credits.video_credits_remaining, 0) > 0 THEN
          UPDATE ghost_credits
          SET video_credits_remaining = video_credits_remaining - 1,
              updated_at = NOW()
          WHERE user_id = p_user_id;
        ELSE
          UPDATE ghost_credits
          SET paid_credits_balance = GREATEST(0, COALESCE(paid_credits_balance, 0) - v_credits_used),
              updated_at = NOW()
          WHERE user_id = p_user_id;
        END IF;
      END IF;
      
    WHEN 'search' THEN
      v_credits_used := 2;
      UPDATE ghost_credits
      SET paid_credits_balance = GREATEST(0, COALESCE(paid_credits_balance, 0) - v_credits_used),
          updated_at = NOW()
      WHERE user_id = p_user_id;
      
    WHEN 'tts' THEN
      v_credits_used := 1;
      UPDATE ghost_credits
      SET paid_credits_balance = GREATEST(0, COALESCE(paid_credits_balance, 0) - v_credits_used),
          updated_at = NOW()
      WHERE user_id = p_user_id;
      
    WHEN 'stt' THEN
      v_credits_used := 1;
      UPDATE ghost_credits
      SET paid_credits_balance = GREATEST(0, COALESCE(paid_credits_balance, 0) - v_credits_used),
          updated_at = NOW()
      WHERE user_id = p_user_id;
      
    ELSE
      v_credits_used := 1;
  END CASE;
  
  -- Record usage in ghost_usage table
  INSERT INTO ghost_usage (
    user_id,
    model_id,
    modality,
    input_tokens,
    output_tokens,
    credits_used,
    was_free_tier,
    duration_seconds,
    resolution
  ) VALUES (
    p_user_id,
    p_model_id,
    p_service_type,
    p_input_tokens,
    p_output_tokens,
    v_credits_used,
    v_was_free_tier,
    p_duration_seconds,
    p_resolution
  );
  
  RETURN jsonb_build_object(
    'success', TRUE,
    'credits_used', v_credits_used,
    'was_free_tier', v_was_free_tier
  );
END;
$$;