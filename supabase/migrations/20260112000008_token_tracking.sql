-- Token Tracking with Usage Limits and Cost Analytics
-- Tracks token usage per request, calculates costs, enforces tier-based limits

-- Token usage tracking table (per request)
CREATE TABLE IF NOT EXISTS token_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  model_id VARCHAR(100) NOT NULL REFERENCES ai_models(id),
  run_id UUID,
  prompt_tokens INTEGER NOT NULL,
  completion_tokens INTEGER NOT NULL,
  total_tokens INTEGER NOT NULL,
  cost_usd DECIMAL(10, 6) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Indexes
  CONSTRAINT token_usage_tokens_positive CHECK (
    prompt_tokens >= 0 AND
    completion_tokens >= 0 AND
    total_tokens >= 0
  )
);

CREATE INDEX IF NOT EXISTS idx_token_usage_user_created ON token_usage(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_run ON token_usage(run_id);

-- Daily aggregated usage (materialized for performance)
CREATE TABLE IF NOT EXISTS token_usage_daily (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_tokens BIGINT NOT NULL DEFAULT 0,
  total_cost_usd DECIMAL(10, 4) NOT NULL DEFAULT 0,
  request_count INTEGER NOT NULL DEFAULT 0,
  models_used JSONB DEFAULT '[]',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE(user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_token_usage_daily_user_date ON token_usage_daily(user_id, date DESC);

-- Usage limits per tier
CREATE TABLE IF NOT EXISTS usage_limits (
  tier VARCHAR(20) PRIMARY KEY CHECK (tier IN ('free', 'pro', 'enterprise')),
  daily_token_limit BIGINT NOT NULL,
  monthly_token_limit BIGINT,
  rate_limit_per_minute INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default limits
INSERT INTO usage_limits (tier, daily_token_limit, monthly_token_limit, rate_limit_per_minute)
VALUES
  ('free', 100000, 2000000, 10),
  ('pro', 5000000, 100000000, 100),
  ('enterprise', 999999999, NULL, 1000)
ON CONFLICT (tier) DO NOTHING;

-- Function: Record token usage with automatic cost calculation
CREATE OR REPLACE FUNCTION record_token_usage(
  p_user_id UUID,
  p_model_id VARCHAR(100),
  p_run_id UUID,
  p_prompt_tokens INTEGER,
  p_completion_tokens INTEGER
) RETURNS UUID AS $$
DECLARE
  v_total_tokens INTEGER;
  v_cost_usd DECIMAL(10, 6);
  v_input_price DECIMAL(10, 6);
  v_output_price DECIMAL(10, 6);
  v_usage_id UUID;
  v_date DATE;
  v_models_array JSONB;
BEGIN
  -- Get model pricing
  SELECT input_price_per_1k, output_price_per_1k
  INTO v_input_price, v_output_price
  FROM ai_models
  WHERE id = p_model_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Model not found: %', p_model_id;
  END IF;

  -- Calculate cost
  v_total_tokens := p_prompt_tokens + p_completion_tokens;
  v_cost_usd := (p_prompt_tokens::DECIMAL / 1000 * v_input_price) +
                (p_completion_tokens::DECIMAL / 1000 * v_output_price);

  -- Insert token usage record
  INSERT INTO token_usage (
    user_id, model_id, run_id,
    prompt_tokens, completion_tokens, total_tokens, cost_usd
  ) VALUES (
    p_user_id, p_model_id, p_run_id,
    p_prompt_tokens, p_completion_tokens, v_total_tokens, v_cost_usd
  ) RETURNING id INTO v_usage_id;

  -- Update daily aggregate
  v_date := CURRENT_DATE;

  -- Get current models array or initialize
  SELECT models_used INTO v_models_array
  FROM token_usage_daily
  WHERE user_id = p_user_id AND date = v_date;

  IF v_models_array IS NULL THEN
    v_models_array := '[]'::JSONB;
  END IF;

  -- Add model if not already in array
  IF NOT v_models_array ? p_model_id THEN
    v_models_array := v_models_array || jsonb_build_array(p_model_id);
  END IF;

  INSERT INTO token_usage_daily (user_id, date, total_tokens, total_cost_usd, request_count, models_used)
  VALUES (p_user_id, v_date, v_total_tokens, v_cost_usd, 1, v_models_array)
  ON CONFLICT (user_id, date) DO UPDATE SET
    total_tokens = token_usage_daily.total_tokens + v_total_tokens,
    total_cost_usd = token_usage_daily.total_cost_usd + v_cost_usd,
    request_count = token_usage_daily.request_count + 1,
    models_used = EXCLUDED.models_used,
    updated_at = NOW();

  RETURN v_usage_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Check if user is within usage limits
CREATE OR REPLACE FUNCTION check_usage_limit(
  p_user_id UUID,
  p_tier VARCHAR(20)
) RETURNS JSONB AS $$
DECLARE
  v_daily_limit BIGINT;
  v_monthly_limit BIGINT;
  v_daily_used BIGINT;
  v_monthly_used BIGINT;
  v_result JSONB;
BEGIN
  -- Get tier limits
  SELECT daily_token_limit, monthly_token_limit
  INTO v_daily_limit, v_monthly_limit
  FROM usage_limits
  WHERE tier = p_tier;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Unknown tier: %', p_tier;
  END IF;

  -- Get daily usage
  SELECT COALESCE(total_tokens, 0) INTO v_daily_used
  FROM token_usage_daily
  WHERE user_id = p_user_id AND date = CURRENT_DATE;

  -- Get monthly usage
  SELECT COALESCE(SUM(total_tokens), 0) INTO v_monthly_used
  FROM token_usage_daily
  WHERE user_id = p_user_id
    AND date >= DATE_TRUNC('month', CURRENT_DATE)
    AND date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month';

  -- Build result
  v_result := jsonb_build_object(
    'within_limits', (v_daily_used < v_daily_limit) AND
                     (v_monthly_limit IS NULL OR v_monthly_used < v_monthly_limit),
    'daily_used', v_daily_used,
    'daily_limit', v_daily_limit,
    'daily_remaining', GREATEST(0, v_daily_limit - v_daily_used),
    'monthly_used', v_monthly_used,
    'monthly_limit', v_monthly_limit,
    'monthly_remaining', CASE
      WHEN v_monthly_limit IS NULL THEN NULL
      ELSE GREATEST(0, v_monthly_limit - v_monthly_used)
    END
  );

  RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Get usage summary with breakdown
CREATE OR REPLACE FUNCTION get_usage_summary(
  p_user_id UUID,
  p_start_date TIMESTAMPTZ DEFAULT NOW() - INTERVAL '30 days',
  p_end_date TIMESTAMPTZ DEFAULT NOW()
) RETURNS JSONB AS $$
DECLARE
  v_summary JSONB;
  v_by_model JSONB;
  v_by_day JSONB;
BEGIN
  -- Overall summary
  SELECT jsonb_build_object(
    'total_tokens', COALESCE(SUM(total_tokens), 0),
    'total_cost_usd', COALESCE(SUM(cost_usd), 0),
    'request_count', COUNT(*),
    'avg_tokens_per_request', COALESCE(AVG(total_tokens), 0),
    'date_range', jsonb_build_object(
      'start', p_start_date,
      'end', p_end_date
    )
  ) INTO v_summary
  FROM token_usage
  WHERE user_id = p_user_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;

  -- Usage by model
  SELECT jsonb_agg(
    jsonb_build_object(
      'model_id', model_id,
      'total_tokens', total_tokens,
      'total_cost_usd', total_cost_usd,
      'request_count', request_count
    ) ORDER BY total_tokens DESC
  ) INTO v_by_model
  FROM (
    SELECT
      model_id,
      SUM(total_tokens) as total_tokens,
      SUM(cost_usd) as total_cost_usd,
      COUNT(*) as request_count
    FROM token_usage
    WHERE user_id = p_user_id
      AND created_at >= p_start_date
      AND created_at <= p_end_date
    GROUP BY model_id
  ) model_summary;

  -- Usage by day
  SELECT jsonb_agg(
    jsonb_build_object(
      'date', date,
      'total_tokens', total_tokens,
      'total_cost_usd', total_cost_usd,
      'request_count', request_count
    ) ORDER BY date DESC
  ) INTO v_by_day
  FROM token_usage_daily
  WHERE user_id = p_user_id
    AND date >= p_start_date::DATE
    AND date <= p_end_date::DATE;

  -- Combine results
  RETURN jsonb_build_object(
    'summary', v_summary,
    'by_model', COALESCE(v_by_model, '[]'::JSONB),
    'by_day', COALESCE(v_by_day, '[]'::JSONB)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies
ALTER TABLE token_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE token_usage_daily ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_limits ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY token_usage_select_own ON token_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY token_usage_daily_select_own ON token_usage_daily
  FOR SELECT USING (auth.uid() = user_id);

-- Everyone can view usage limits
CREATE POLICY usage_limits_select_all ON usage_limits
  FOR SELECT USING (true);

-- Service role can insert/update (via functions)
CREATE POLICY token_usage_service_all ON token_usage
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY token_usage_daily_service_all ON token_usage_daily
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');
