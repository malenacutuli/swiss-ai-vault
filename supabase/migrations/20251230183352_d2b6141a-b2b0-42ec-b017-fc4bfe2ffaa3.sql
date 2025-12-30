-- ============================================
-- PHASE 1: Create unified subscriptions table
-- ============================================
CREATE TABLE public.unified_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  org_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  
  -- Tier info
  tier TEXT NOT NULL DEFAULT 'ghost_free' 
    CHECK (tier IN ('ghost_free', 'ghost_pro', 'premium', 'enterprise')),
  billing_cycle TEXT DEFAULT 'monthly' 
    CHECK (billing_cycle IN ('monthly', 'yearly')),
  
  -- Stripe
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  stripe_price_id TEXT,
  
  -- Status
  status TEXT DEFAULT 'active' 
    CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  
  -- Seats (for Premium/Enterprise orgs)
  seats_purchased INTEGER DEFAULT 1,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- One subscription per user
  UNIQUE(user_id)
);

-- ============================================
-- PHASE 2: Create unified credits table
-- ============================================
CREATE TABLE public.unified_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  
  -- Monthly allowance (resets each billing period)
  monthly_allowance INTEGER DEFAULT 0,
  monthly_used INTEGER DEFAULT 0,
  allowance_resets_at TIMESTAMPTZ,
  
  -- Purchased credits (carry over forever)
  purchased_balance INTEGER DEFAULT 0,
  
  -- One-time grants (like Pro's 1000 video credits)
  grant_balance INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PHASE 3: Create unified daily usage tracking
-- ============================================
CREATE TABLE public.unified_daily_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  usage_date DATE DEFAULT CURRENT_DATE,
  
  -- Daily counters
  text_prompts INTEGER DEFAULT 0,
  image_requests INTEGER DEFAULT 0,
  video_requests INTEGER DEFAULT 0,
  deep_research INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id, usage_date)
);

-- ============================================
-- PHASE 4: Create tier limits configuration
-- ============================================
CREATE TABLE public.tier_limits (
  tier TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  price_monthly_cents INTEGER DEFAULT 0,
  price_yearly_cents INTEGER DEFAULT 0,
  
  -- Daily limits (NULL = unlimited)
  text_prompts_per_day INTEGER,
  images_per_day INTEGER,
  videos_per_day INTEGER,
  deep_research_per_day INTEGER,
  
  -- Feature flags
  can_backup_history BOOLEAN DEFAULT FALSE,
  can_access_new_models BOOLEAN DEFAULT FALSE,
  can_use_api BOOLEAN DEFAULT FALSE,
  can_train_models BOOLEAN DEFAULT FALSE,
  can_use_vault_chat BOOLEAN DEFAULT FALSE,
  can_use_vault_labs BOOLEAN DEFAULT FALSE,
  can_use_integrations BOOLEAN DEFAULT FALSE,
  
  -- One-time credit grant on subscription
  one_time_credit_grant INTEGER DEFAULT 0,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert tier configurations
INSERT INTO public.tier_limits (tier, display_name, price_monthly_cents, price_yearly_cents, text_prompts_per_day, images_per_day, videos_per_day, deep_research_per_day, can_backup_history, can_access_new_models, can_use_api, can_train_models, can_use_vault_chat, can_use_vault_labs, can_use_integrations, one_time_credit_grant) VALUES
  ('ghost_free', 'Ghost Free', 0, 0, 10, 2, 2, 0, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, FALSE, 0),
  ('ghost_pro', 'Ghost Pro', 1800, 15120, NULL, 1000, NULL, 0, TRUE, TRUE, TRUE, FALSE, FALSE, FALSE, FALSE, 1000),
  ('premium', 'Premium', 3000, 25200, NULL, 1000, NULL, 10, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 0),
  ('enterprise', 'Enterprise', 0, 0, NULL, NULL, NULL, NULL, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, TRUE, 0);

-- ============================================
-- PHASE 5: Add subscription_id to organizations
-- ============================================
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS subscription_id UUID REFERENCES public.unified_subscriptions(id) ON DELETE SET NULL;

-- ============================================
-- PHASE 6: Enable RLS on all new tables
-- ============================================
ALTER TABLE public.unified_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unified_daily_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tier_limits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PHASE 7: RLS Policies for unified_subscriptions
-- ============================================
CREATE POLICY "Users can view own subscription"
  ON public.unified_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own subscription"
  ON public.unified_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service role manages subscriptions"
  ON public.unified_subscriptions FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- PHASE 8: RLS Policies for unified_credits
-- ============================================
CREATE POLICY "Users can view own credits"
  ON public.unified_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own credits"
  ON public.unified_credits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages credits"
  ON public.unified_credits FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- PHASE 9: RLS Policies for unified_daily_usage
-- ============================================
CREATE POLICY "Users can view own daily usage"
  ON public.unified_daily_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily usage"
  ON public.unified_daily_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily usage"
  ON public.unified_daily_usage FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages daily usage"
  ON public.unified_daily_usage FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- PHASE 10: RLS Policies for tier_limits (public read)
-- ============================================
CREATE POLICY "Anyone can view tier limits"
  ON public.tier_limits FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage tier limits"
  ON public.tier_limits FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- ============================================
-- PHASE 11: Create trigger for subscription on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Create free subscription for new user
  INSERT INTO public.unified_subscriptions (user_id, tier, status)
  VALUES (NEW.id, 'ghost_free', 'active')
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create credits record for new user
  INSERT INTO public.unified_credits (user_id, monthly_allowance, allowance_resets_at)
  VALUES (NEW.id, 0, NOW() + INTERVAL '30 days')
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN NEW;
END;
$$;

-- Create trigger for new users
DROP TRIGGER IF EXISTS on_auth_user_created_subscription ON auth.users;
CREATE TRIGGER on_auth_user_created_subscription
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user_subscription();

-- ============================================
-- PHASE 12: Helper function to check usage limits
-- ============================================
CREATE OR REPLACE FUNCTION public.check_unified_usage(
  p_user_id UUID,
  p_usage_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_subscription unified_subscriptions;
  v_limits tier_limits;
  v_usage unified_daily_usage;
  v_limit INTEGER;
  v_current INTEGER;
BEGIN
  -- Get user's subscription
  SELECT * INTO v_subscription
  FROM unified_subscriptions
  WHERE user_id = p_user_id;
  
  IF v_subscription IS NULL THEN
    -- Create default subscription
    INSERT INTO unified_subscriptions (user_id, tier, status)
    VALUES (p_user_id, 'ghost_free', 'active')
    RETURNING * INTO v_subscription;
  END IF;
  
  -- Get tier limits
  SELECT * INTO v_limits
  FROM tier_limits
  WHERE tier = v_subscription.tier;
  
  -- Get or create today's usage
  INSERT INTO unified_daily_usage (user_id, usage_date)
  VALUES (p_user_id, CURRENT_DATE)
  ON CONFLICT (user_id, usage_date) DO NOTHING;
  
  SELECT * INTO v_usage
  FROM unified_daily_usage
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  
  -- Get limit and current usage based on type
  CASE p_usage_type
    WHEN 'text' THEN
      v_limit := v_limits.text_prompts_per_day;
      v_current := COALESCE(v_usage.text_prompts, 0);
    WHEN 'image' THEN
      v_limit := v_limits.images_per_day;
      v_current := COALESCE(v_usage.image_requests, 0);
    WHEN 'video' THEN
      v_limit := v_limits.videos_per_day;
      v_current := COALESCE(v_usage.video_requests, 0);
    WHEN 'research' THEN
      v_limit := v_limits.deep_research_per_day;
      v_current := COALESCE(v_usage.deep_research, 0);
    ELSE
      RETURN jsonb_build_object('error', 'Invalid usage type');
  END CASE;
  
  -- NULL limit means unlimited
  IF v_limit IS NULL THEN
    RETURN jsonb_build_object(
      'allowed', TRUE,
      'unlimited', TRUE,
      'tier', v_subscription.tier,
      'current', v_current
    );
  END IF;
  
  -- Check if under limit
  RETURN jsonb_build_object(
    'allowed', v_current < v_limit,
    'unlimited', FALSE,
    'tier', v_subscription.tier,
    'limit', v_limit,
    'current', v_current,
    'remaining', GREATEST(0, v_limit - v_current)
  );
END;
$$;

-- ============================================
-- PHASE 13: Function to increment usage
-- ============================================
CREATE OR REPLACE FUNCTION public.increment_unified_usage(
  p_user_id UUID,
  p_usage_type TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_check JSONB;
BEGIN
  -- First check if allowed
  v_check := check_unified_usage(p_user_id, p_usage_type);
  
  IF NOT (v_check->>'allowed')::BOOLEAN THEN
    RETURN v_check;
  END IF;
  
  -- Increment the counter
  INSERT INTO unified_daily_usage (user_id, usage_date, text_prompts, image_requests, video_requests, deep_research)
  VALUES (
    p_user_id,
    CURRENT_DATE,
    CASE WHEN p_usage_type = 'text' THEN 1 ELSE 0 END,
    CASE WHEN p_usage_type = 'image' THEN 1 ELSE 0 END,
    CASE WHEN p_usage_type = 'video' THEN 1 ELSE 0 END,
    CASE WHEN p_usage_type = 'research' THEN 1 ELSE 0 END
  )
  ON CONFLICT (user_id, usage_date) DO UPDATE SET
    text_prompts = unified_daily_usage.text_prompts + CASE WHEN p_usage_type = 'text' THEN 1 ELSE 0 END,
    image_requests = unified_daily_usage.image_requests + CASE WHEN p_usage_type = 'image' THEN 1 ELSE 0 END,
    video_requests = unified_daily_usage.video_requests + CASE WHEN p_usage_type = 'video' THEN 1 ELSE 0 END,
    deep_research = unified_daily_usage.deep_research + CASE WHEN p_usage_type = 'research' THEN 1 ELSE 0 END;
  
  -- Return updated check
  RETURN check_unified_usage(p_user_id, p_usage_type);
END;
$$;

-- ============================================
-- PHASE 14: Function to get user's full subscription status
-- ============================================
CREATE OR REPLACE FUNCTION public.get_subscription_status(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_subscription unified_subscriptions;
  v_credits unified_credits;
  v_limits tier_limits;
  v_usage unified_daily_usage;
BEGIN
  -- Get subscription
  SELECT * INTO v_subscription
  FROM unified_subscriptions
  WHERE user_id = p_user_id;
  
  IF v_subscription IS NULL THEN
    -- Create default subscription
    INSERT INTO unified_subscriptions (user_id, tier, status)
    VALUES (p_user_id, 'ghost_free', 'active')
    RETURNING * INTO v_subscription;
  END IF;
  
  -- Get credits
  SELECT * INTO v_credits
  FROM unified_credits
  WHERE user_id = p_user_id;
  
  IF v_credits IS NULL THEN
    INSERT INTO unified_credits (user_id)
    VALUES (p_user_id)
    RETURNING * INTO v_credits;
  END IF;
  
  -- Get tier limits
  SELECT * INTO v_limits
  FROM tier_limits
  WHERE tier = v_subscription.tier;
  
  -- Get today's usage
  SELECT * INTO v_usage
  FROM unified_daily_usage
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;
  
  RETURN jsonb_build_object(
    'subscription', jsonb_build_object(
      'tier', v_subscription.tier,
      'status', v_subscription.status,
      'billing_cycle', v_subscription.billing_cycle,
      'current_period_end', v_subscription.current_period_end,
      'seats_purchased', v_subscription.seats_purchased
    ),
    'credits', jsonb_build_object(
      'monthly_allowance', COALESCE(v_credits.monthly_allowance, 0),
      'monthly_used', COALESCE(v_credits.monthly_used, 0),
      'purchased_balance', COALESCE(v_credits.purchased_balance, 0),
      'grant_balance', COALESCE(v_credits.grant_balance, 0),
      'total_available', COALESCE(v_credits.monthly_allowance, 0) - COALESCE(v_credits.monthly_used, 0) + COALESCE(v_credits.purchased_balance, 0) + COALESCE(v_credits.grant_balance, 0)
    ),
    'limits', jsonb_build_object(
      'text_prompts_per_day', v_limits.text_prompts_per_day,
      'images_per_day', v_limits.images_per_day,
      'videos_per_day', v_limits.videos_per_day,
      'deep_research_per_day', v_limits.deep_research_per_day
    ),
    'features', jsonb_build_object(
      'can_backup_history', v_limits.can_backup_history,
      'can_access_new_models', v_limits.can_access_new_models,
      'can_use_api', v_limits.can_use_api,
      'can_train_models', v_limits.can_train_models,
      'can_use_vault_chat', v_limits.can_use_vault_chat,
      'can_use_vault_labs', v_limits.can_use_vault_labs,
      'can_use_integrations', v_limits.can_use_integrations
    ),
    'usage_today', jsonb_build_object(
      'text_prompts', COALESCE(v_usage.text_prompts, 0),
      'image_requests', COALESCE(v_usage.image_requests, 0),
      'video_requests', COALESCE(v_usage.video_requests, 0),
      'deep_research', COALESCE(v_usage.deep_research, 0)
    )
  );
END;
$$;