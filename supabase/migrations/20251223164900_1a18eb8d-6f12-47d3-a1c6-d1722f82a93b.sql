-- Ghost Chat Schema - Zero-retention chat mode
-- Completely separate from VaultChat

-- 1. Create ghost_credits table
CREATE TABLE ghost_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  balance INTEGER DEFAULT 0,
  last_purchase TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ghost_credits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ghost credits" ON ghost_credits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own ghost credits" ON ghost_credits FOR UPDATE USING (auth.uid() = user_id);

-- 2. Create ghost_usage table (content-free logging only - NO prompts or responses)
CREATE TABLE ghost_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  model_id TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ghost_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ghost usage" ON ghost_usage FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System can insert ghost usage" ON ghost_usage FOR INSERT WITH CHECK (true);

-- 3. Create ghost_subscriptions table
CREATE TABLE ghost_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users NOT NULL,
  plan TEXT NOT NULL CHECK (plan IN ('ghost_free', 'ghost_pro', 'ghost_enterprise')),
  ghost_tokens_limit INTEGER NOT NULL DEFAULT 10000,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE ghost_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own ghost subscription" ON ghost_subscriptions FOR SELECT USING (auth.uid() = user_id);

-- 4. Create function to deduct ghost credits
CREATE OR REPLACE FUNCTION deduct_ghost_credits(p_user_id UUID, p_amount INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
  current_balance INTEGER;
BEGIN
  SELECT balance INTO current_balance FROM ghost_credits WHERE user_id = p_user_id FOR UPDATE;
  IF current_balance >= p_amount THEN
    UPDATE ghost_credits SET balance = balance - p_amount, updated_at = NOW() WHERE user_id = p_user_id;
    RETURN TRUE;
  ELSE
    RETURN FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create unique constraint on user_id for ghost_credits (one record per user)
CREATE UNIQUE INDEX ghost_credits_user_id_idx ON ghost_credits(user_id);

-- Create unique constraint on user_id for ghost_subscriptions (one active subscription per user)
CREATE UNIQUE INDEX ghost_subscriptions_user_id_idx ON ghost_subscriptions(user_id);

-- Create index on ghost_usage for user queries
CREATE INDEX ghost_usage_user_id_idx ON ghost_usage(user_id);
CREATE INDEX ghost_usage_created_at_idx ON ghost_usage(created_at);