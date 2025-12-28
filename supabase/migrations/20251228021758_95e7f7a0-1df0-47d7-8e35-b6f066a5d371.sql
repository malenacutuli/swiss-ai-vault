
-- Drop the old constraint
ALTER TABLE ghost_subscriptions DROP CONSTRAINT ghost_subscriptions_plan_check;

-- Add new constraint with swissvault_pro
ALTER TABLE ghost_subscriptions ADD CONSTRAINT ghost_subscriptions_plan_check 
CHECK (plan = ANY (ARRAY['ghost_free', 'ghost_pro', 'ghost_enterprise', 'swissvault_pro']));

-- Update get_ghost_tier function to grant swissvault_pro to admins
CREATE OR REPLACE FUNCTION public.get_ghost_tier(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tier TEXT;
  v_features JSONB;
  v_is_admin BOOLEAN;
BEGIN
  -- Check if user is admin
  SELECT has_role(p_user_id, 'admin') INTO v_is_admin;
  
  -- If admin, automatically grant swissvault_pro
  IF v_is_admin THEN
    v_tier := 'swissvault_pro';
  ELSE
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
  END IF;
  
  -- Get features from subscription_tiers
  SELECT features_json INTO v_features 
  FROM subscription_tiers WHERE name = v_tier;
  
  -- Default features based on tier
  IF v_features IS NULL THEN
    IF v_tier = 'swissvault_pro' THEN
      v_features := '{
        "prompts_per_day": -1,
        "images_per_day": 100,
        "videos_per_day": 50,
        "files_per_day": 100,
        "searches_per_day": -1,
        "commercial_models": true,
        "priority_support": true
      }'::JSONB;
    ELSE
      v_features := '{
        "prompts_per_day": 15,
        "images_per_day": 3,
        "videos_per_day": 3,
        "files_per_day": 5,
        "searches_per_day": 5
      }'::JSONB;
    END IF;
  END IF;
  
  RETURN jsonb_build_object(
    'tier', v_tier,
    'features', v_features
  );
END;
$function$;
