-- supabase/migrations/20260112000007_model_registry.sql
-- SwissBrain Model Registry - AI Model Definitions

-- ============================================================================
-- Model Registry Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS ai_models (
  id VARCHAR(100) PRIMARY KEY,
  provider VARCHAR(50) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  model_type VARCHAR(20) DEFAULT 'chat' CHECK (model_type IN ('chat', 'completion', 'embedding', 'image', 'audio')),
  context_window INTEGER NOT NULL,
  max_output_tokens INTEGER,
  input_price_per_1k DECIMAL(10, 6) NOT NULL,
  output_price_per_1k DECIMAL(10, 6) NOT NULL,
  supports_vision BOOLEAN DEFAULT FALSE,
  supports_functions BOOLEAN DEFAULT FALSE,
  supports_streaming BOOLEAN DEFAULT TRUE,
  rate_limit_rpm INTEGER DEFAULT 60,
  rate_limit_tpm INTEGER DEFAULT 100000,
  is_available BOOLEAN DEFAULT TRUE,
  is_default BOOLEAN DEFAULT FALSE,
  tier_required VARCHAR(20) DEFAULT 'free' CHECK (tier_required IN ('free', 'pro', 'enterprise')),
  capabilities JSONB DEFAULT '[]',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Model Health Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS model_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id VARCHAR(100) REFERENCES ai_models(id) ON DELETE CASCADE,
  status VARCHAR(20) DEFAULT 'healthy' CHECK (status IN ('healthy', 'degraded', 'unhealthy')),
  latency_ms INTEGER,
  error_rate DECIMAL(5, 4) DEFAULT 0,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  failure_count INTEGER DEFAULT 0,
  checked_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider);
CREATE INDEX IF NOT EXISTS idx_ai_models_type ON ai_models(model_type);
CREATE INDEX IF NOT EXISTS idx_ai_models_available ON ai_models(is_available);
CREATE INDEX IF NOT EXISTS idx_model_health_model ON model_health(model_id);
CREATE INDEX IF NOT EXISTS idx_model_health_checked ON model_health(checked_at DESC);

-- ============================================================================
-- Seed Default Models
-- ============================================================================

INSERT INTO ai_models (id, provider, display_name, description, context_window, max_output_tokens, input_price_per_1k, output_price_per_1k, supports_vision, supports_functions, rate_limit_rpm, is_default, tier_required, capabilities) VALUES
-- Google
('gemini-2.0-flash', 'google', 'Gemini 2.0 Flash', 'Fast, efficient model for most tasks', 1000000, 8192, 0.0001, 0.0004, TRUE, TRUE, 50, TRUE, 'free', '["chat", "code", "analysis", "vision"]'),
('gemini-2.0-pro', 'google', 'Gemini 2.0 Pro', 'Advanced reasoning and analysis', 1000000, 8192, 0.00025, 0.001, TRUE, TRUE, 30, FALSE, 'pro', '["chat", "code", "analysis", "vision", "research"]'),
-- OpenAI
('gpt-4o', 'openai', 'GPT-4o', 'Most capable OpenAI model', 128000, 4096, 0.005, 0.015, TRUE, TRUE, 60, FALSE, 'pro', '["chat", "code", "analysis", "vision"]'),
('gpt-4o-mini', 'openai', 'GPT-4o Mini', 'Fast and affordable', 128000, 4096, 0.00015, 0.0006, TRUE, TRUE, 100, FALSE, 'free', '["chat", "code"]'),
-- Anthropic
('claude-3-5-sonnet', 'anthropic', 'Claude 3.5 Sonnet', 'Balanced performance and speed', 200000, 8192, 0.003, 0.015, TRUE, TRUE, 50, FALSE, 'pro', '["chat", "code", "analysis", "vision"]'),
('claude-3-5-haiku', 'anthropic', 'Claude 3.5 Haiku', 'Fast responses', 200000, 8192, 0.00025, 0.00125, TRUE, TRUE, 100, FALSE, 'free', '["chat", "code"]'),
-- DeepSeek
('deepseek-chat', 'deepseek', 'DeepSeek Chat', 'Cost-effective alternative', 64000, 4096, 0.00014, 0.00028, FALSE, TRUE, 60, FALSE, 'free', '["chat", "code"]'),
('deepseek-reasoner', 'deepseek', 'DeepSeek Reasoner', 'Advanced reasoning', 64000, 4096, 0.00055, 0.00219, FALSE, TRUE, 30, FALSE, 'pro', '["chat", "code", "analysis"]'),
-- xAI
('grok-2', 'xai', 'Grok 2', 'Real-time knowledge', 128000, 4096, 0.002, 0.01, TRUE, TRUE, 30, FALSE, 'pro', '["chat", "analysis"]')
ON CONFLICT (id) DO UPDATE SET
  input_price_per_1k = EXCLUDED.input_price_per_1k,
  output_price_per_1k = EXCLUDED.output_price_per_1k,
  updated_at = NOW();

-- ============================================================================
-- Function to Get Best Available Model
-- ============================================================================

CREATE OR REPLACE FUNCTION get_best_model(
  p_capability VARCHAR DEFAULT 'chat',
  p_user_tier VARCHAR DEFAULT 'free',
  p_prefer_provider VARCHAR DEFAULT NULL
)
RETURNS TABLE (
  model_id VARCHAR,
  provider VARCHAR,
  display_name VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    m.id,
    m.provider,
    m.display_name
  FROM ai_models m
  LEFT JOIN model_health h ON h.model_id = m.id
  WHERE m.is_available = TRUE
    AND m.capabilities ? p_capability
    AND (
      p_user_tier = 'enterprise'
      OR (p_user_tier = 'pro' AND m.tier_required IN ('free', 'pro'))
      OR (p_user_tier = 'free' AND m.tier_required = 'free')
    )
    AND (h.status IS NULL OR h.status != 'unhealthy')
  ORDER BY
    CASE WHEN p_prefer_provider IS NOT NULL AND m.provider = p_prefer_provider THEN 0 ELSE 1 END,
    m.is_default DESC,
    COALESCE(h.latency_ms, 1000) ASC,
    m.input_price_per_1k ASC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
