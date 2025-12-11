-- ============================================
-- ENCRYPTED DEEP RESEARCH SCHEMA
-- ============================================

-- Research queries table with encryption support
CREATE TABLE IF NOT EXISTS public.research_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES encrypted_conversations(id) ON DELETE SET NULL,
  
  -- Query (encrypted when ZeroTrace is ON)
  query_encrypted TEXT,
  query_plaintext TEXT,
  query_nonce TEXT,
  is_encrypted BOOLEAN DEFAULT false,
  
  -- Response (always encrypted for Pro+ users)
  response_encrypted TEXT,
  response_nonce TEXT,
  
  -- Model and mode
  model TEXT NOT NULL DEFAULT 'sonar-reasoning-pro',
  mode TEXT NOT NULL DEFAULT 'privacy-enhanced',
  
  -- Citations (stored as encrypted JSON when ZeroTrace ON)
  citations_encrypted TEXT,
  citations_nonce TEXT,
  citations_plaintext JSONB,
  
  -- Usage metrics (not encrypted - no PII)
  search_queries_count INTEGER DEFAULT 0,
  reasoning_tokens INTEGER DEFAULT 0,
  input_tokens INTEGER DEFAULT 0,
  output_tokens INTEGER DEFAULT 0,
  total_cost DECIMAL(10,6) DEFAULT 0,
  
  -- Timing
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Status
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_research_queries_user_id ON research_queries(user_id);
CREATE INDEX IF NOT EXISTS idx_research_queries_conversation ON research_queries(conversation_id);
CREATE INDEX IF NOT EXISTS idx_research_queries_created ON research_queries(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_research_queries_status ON research_queries(status) WHERE status = 'processing';

-- RLS Policies
ALTER TABLE research_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own research queries"
  ON research_queries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create research queries"
  ON research_queries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own research queries"
  ON research_queries FOR UPDATE
  USING (auth.uid() = user_id);

-- Research quotas per subscription tier
CREATE TABLE IF NOT EXISTS public.research_quotas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier TEXT UNIQUE NOT NULL,
  monthly_queries INTEGER NOT NULL,
  max_tokens_per_query INTEGER DEFAULT 32000,
  models_allowed TEXT[] DEFAULT ARRAY['sonar'],
  deep_research_enabled BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default quotas
INSERT INTO research_quotas (tier, monthly_queries, models_allowed, deep_research_enabled) VALUES
  ('free', 3, ARRAY['sonar'], false),
  ('pro', 50, ARRAY['sonar', 'sonar-pro', 'sonar-reasoning-pro'], true),
  ('team', 200, ARRAY['sonar', 'sonar-pro', 'sonar-reasoning-pro', 'sonar-deep-research'], true),
  ('enterprise', -1, ARRAY['sonar', 'sonar-pro', 'sonar-reasoning-pro', 'sonar-deep-research'], true)
ON CONFLICT (tier) DO UPDATE SET
  monthly_queries = EXCLUDED.monthly_queries,
  models_allowed = EXCLUDED.models_allowed,
  deep_research_enabled = EXCLUDED.deep_research_enabled,
  updated_at = NOW();

-- Function to get user's research quota usage
CREATE OR REPLACE FUNCTION get_research_quota()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_tier TEXT;
  quota_limit INTEGER;
  used_count INTEGER;
  result JSON;
BEGIN
  -- Get user's subscription tier from billing_customers
  SELECT COALESCE(bc.tier, 'free') INTO user_tier
  FROM billing_customers bc
  WHERE bc.user_id = auth.uid()
  AND bc.subscription_status = 'active'
  ORDER BY bc.created_at DESC
  LIMIT 1;
  
  IF user_tier IS NULL THEN
    user_tier := 'free';
  END IF;
  
  -- Get quota limit
  SELECT monthly_queries INTO quota_limit
  FROM research_quotas
  WHERE tier = user_tier;
  
  -- Get usage this month
  SELECT COUNT(*) INTO used_count
  FROM research_queries
  WHERE user_id = auth.uid()
  AND created_at >= date_trunc('month', CURRENT_TIMESTAMP)
  AND status = 'completed';
  
  result := json_build_object(
    'tier', user_tier,
    'limit', quota_limit,
    'used', used_count,
    'remaining', CASE WHEN quota_limit = -1 THEN -1 ELSE GREATEST(0, quota_limit - used_count) END
  );
  
  RETURN result;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_research_quota() TO authenticated;

-- Add research_enabled column to user settings if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_settings' AND column_name = 'deep_research_enabled'
  ) THEN
    ALTER TABLE user_settings ADD COLUMN deep_research_enabled BOOLEAN DEFAULT true;
  END IF;
END $$;