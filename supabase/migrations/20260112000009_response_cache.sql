-- Response cache for AI completions
CREATE TABLE IF NOT EXISTS response_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key VARCHAR(64) NOT NULL UNIQUE,
  model_id VARCHAR(100) NOT NULL,
  prompt_hash VARCHAR(64) NOT NULL,
  system_hash VARCHAR(64),
  messages_hash VARCHAR(64) NOT NULL,
  temperature DECIMAL(3, 2),
  response_content TEXT NOT NULL,
  response_metadata JSONB DEFAULT '{}',
  token_usage JSONB DEFAULT '{}',
  hit_count INTEGER DEFAULT 0,
  last_hit_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_response_cache_key ON response_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_response_cache_expires ON response_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_response_cache_model ON response_cache(model_id);
CREATE INDEX IF NOT EXISTS idx_response_cache_prompt ON response_cache(prompt_hash);

-- Cache statistics
CREATE TABLE IF NOT EXISTS cache_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  model_id VARCHAR(100),
  hits INTEGER DEFAULT 0,
  misses INTEGER DEFAULT 0,
  tokens_saved BIGINT DEFAULT 0,
  cost_saved_usd DECIMAL(12, 6) DEFAULT 0,
  UNIQUE(date, model_id)
);

CREATE INDEX IF NOT EXISTS idx_cache_stats_date ON cache_stats(date DESC);

-- Function to get cached response
CREATE OR REPLACE FUNCTION get_cached_response(p_cache_key VARCHAR)
RETURNS JSONB AS $$
DECLARE
  v_cache RECORD;
BEGIN
  SELECT * INTO v_cache
  FROM response_cache
  WHERE cache_key = p_cache_key
    AND expires_at > NOW();

  IF v_cache.id IS NULL THEN
    -- Cache miss
    INSERT INTO cache_stats (date, model_id, misses)
    VALUES (CURRENT_DATE, NULL, 1)
    ON CONFLICT (date, model_id) DO UPDATE SET misses = cache_stats.misses + 1;

    RETURN NULL;
  END IF;

  -- Cache hit - update stats
  UPDATE response_cache
  SET hit_count = hit_count + 1, last_hit_at = NOW()
  WHERE id = v_cache.id;

  INSERT INTO cache_stats (date, model_id, hits, tokens_saved, cost_saved_usd)
  VALUES (
    CURRENT_DATE,
    v_cache.model_id,
    1,
    (v_cache.token_usage->>'total_tokens')::BIGINT,
    COALESCE((v_cache.response_metadata->>'estimated_cost')::DECIMAL, 0)
  )
  ON CONFLICT (date, model_id) DO UPDATE SET
    hits = cache_stats.hits + 1,
    tokens_saved = cache_stats.tokens_saved + (v_cache.token_usage->>'total_tokens')::BIGINT,
    cost_saved_usd = cache_stats.cost_saved_usd + COALESCE((v_cache.response_metadata->>'estimated_cost')::DECIMAL, 0);

  RETURN jsonb_build_object(
    'content', v_cache.response_content,
    'model_id', v_cache.model_id,
    'token_usage', v_cache.token_usage,
    'metadata', v_cache.response_metadata,
    'cached', TRUE,
    'cache_age_seconds', EXTRACT(EPOCH FROM (NOW() - v_cache.created_at))::INTEGER
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to store cached response
CREATE OR REPLACE FUNCTION store_cached_response(
  p_cache_key VARCHAR,
  p_model_id VARCHAR,
  p_prompt_hash VARCHAR,
  p_system_hash VARCHAR,
  p_messages_hash VARCHAR,
  p_temperature DECIMAL,
  p_response_content TEXT,
  p_response_metadata JSONB,
  p_token_usage JSONB,
  p_ttl_hours INTEGER DEFAULT 24
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO response_cache (
    cache_key, model_id, prompt_hash, system_hash, messages_hash,
    temperature, response_content, response_metadata, token_usage, expires_at
  )
  VALUES (
    p_cache_key, p_model_id, p_prompt_hash, p_system_hash, p_messages_hash,
    p_temperature, p_response_content, p_response_metadata, p_token_usage,
    NOW() + (p_ttl_hours || ' hours')::INTERVAL
  )
  ON CONFLICT (cache_key) DO UPDATE SET
    response_content = EXCLUDED.response_content,
    response_metadata = EXCLUDED.response_metadata,
    token_usage = EXCLUDED.token_usage,
    expires_at = EXCLUDED.expires_at,
    hit_count = 0
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cleanup expired cache
CREATE OR REPLACE FUNCTION cleanup_expired_cache()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM response_cache WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Get cache statistics
CREATE OR REPLACE FUNCTION get_cache_stats(p_days INTEGER DEFAULT 7)
RETURNS JSONB AS $$
BEGIN
  RETURN (
    SELECT jsonb_build_object(
      'total_hits', COALESCE(SUM(hits), 0),
      'total_misses', COALESCE(SUM(misses), 0),
      'hit_rate', CASE WHEN SUM(hits) + SUM(misses) > 0
        THEN ROUND(SUM(hits)::DECIMAL / (SUM(hits) + SUM(misses)) * 100, 2)
        ELSE 0 END,
      'tokens_saved', COALESCE(SUM(tokens_saved), 0),
      'cost_saved_usd', COALESCE(SUM(cost_saved_usd), 0),
      'by_day', (
        SELECT jsonb_agg(jsonb_build_object(
          'date', date,
          'hits', hits,
          'misses', misses,
          'tokens_saved', tokens_saved,
          'cost_saved_usd', cost_saved_usd
        ) ORDER BY date DESC)
        FROM cache_stats
        WHERE date >= CURRENT_DATE - p_days
      )
    )
    FROM cache_stats
    WHERE date >= CURRENT_DATE - p_days
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
