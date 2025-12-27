
-- Get or create today's usage record
CREATE OR REPLACE FUNCTION get_ghost_usage(p_user_id UUID)
RETURNS ghost_usage AS $$
DECLARE
  v_usage ghost_usage;
BEGIN
  -- Try to get existing record for today
  SELECT * INTO v_usage
  FROM ghost_usage
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE
  ORDER BY created_at DESC
  LIMIT 1;
  
  -- Create if doesn't exist
  IF NOT FOUND THEN
    INSERT INTO ghost_usage (user_id, usage_date, prompts_used, images_generated, videos_generated, files_uploaded, web_searches)
    VALUES (p_user_id, CURRENT_DATE, 0, 0, 0, 0, 0)
    RETURNING * INTO v_usage;
  END IF;
  
  RETURN v_usage;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Increment usage counter
CREATE OR REPLACE FUNCTION increment_ghost_usage(
  p_user_id UUID,
  p_type TEXT  -- 'prompt', 'image', 'video', 'file', 'search'
)
RETURNS JSON AS $$
DECLARE
  v_usage ghost_usage;
  v_sub ghost_subscriptions;
  v_limit INTEGER;
  v_current INTEGER;
BEGIN
  -- Get subscription tier
  SELECT * INTO v_sub FROM ghost_subscriptions WHERE user_id = p_user_id;
  
  -- Get or create usage record
  SELECT * INTO v_usage FROM get_ghost_usage(p_user_id);
  
  -- Determine limit based on tier and type
  CASE p_type
    WHEN 'prompt' THEN
      v_current := COALESCE(v_usage.prompts_used, 0);
      v_limit := CASE WHEN v_sub.tier = 'pro' THEN 999999 ELSE 15 END;
    WHEN 'image' THEN
      v_current := COALESCE(v_usage.images_generated, 0);
      v_limit := CASE WHEN v_sub.tier = 'pro' THEN 50 ELSE 3 END;
    WHEN 'video' THEN
      v_current := COALESCE(v_usage.videos_generated, 0);
      v_limit := CASE WHEN v_sub.tier = 'pro' THEN 20 ELSE 3 END;
    WHEN 'file' THEN
      v_current := COALESCE(v_usage.files_uploaded, 0);
      v_limit := CASE WHEN v_sub.tier = 'pro' THEN 50 ELSE 5 END;
    WHEN 'search' THEN
      v_current := COALESCE(v_usage.web_searches, 0);
      v_limit := CASE WHEN v_sub.tier = 'pro' THEN 999999 ELSE 5 END;
    ELSE
      RETURN json_build_object('error', 'Invalid usage type');
  END CASE;
  
  -- Check limit
  IF v_current >= v_limit THEN
    RETURN json_build_object(
      'allowed', false,
      'current', v_current,
      'limit', v_limit,
      'type', p_type,
      'resets_at', (CURRENT_DATE + INTERVAL '1 day')::TEXT
    );
  END IF;
  
  -- Increment counter in the usage record
  UPDATE ghost_usage
  SET 
    prompts_used = CASE WHEN p_type = 'prompt' THEN COALESCE(prompts_used, 0) + 1 ELSE prompts_used END,
    images_generated = CASE WHEN p_type = 'image' THEN COALESCE(images_generated, 0) + 1 ELSE images_generated END,
    videos_generated = CASE WHEN p_type = 'video' THEN COALESCE(videos_generated, 0) + 1 ELSE videos_generated END,
    files_uploaded = CASE WHEN p_type = 'file' THEN COALESCE(files_uploaded, 0) + 1 ELSE files_uploaded END,
    web_searches = CASE WHEN p_type = 'search' THEN COALESCE(web_searches, 0) + 1 ELSE web_searches END
  WHERE id = v_usage.id
  RETURNING * INTO v_usage;
  
  RETURN json_build_object(
    'allowed', true,
    'current', v_current + 1,
    'limit', v_limit,
    'remaining', v_limit - v_current - 1,
    'type', p_type
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update trigger to create subscription on signup
CREATE OR REPLACE FUNCTION create_ghost_subscription_on_signup()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO ghost_subscriptions (user_id, tier, plan)
  VALUES (NEW.id, 'free', 'free')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created_ghost ON auth.users;
CREATE TRIGGER on_auth_user_created_ghost
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_ghost_subscription_on_signup();
