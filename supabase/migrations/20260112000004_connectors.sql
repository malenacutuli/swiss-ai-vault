-- supabase/migrations/20260112000004_connectors.sql
-- SwissBrain Connector SDK - OAuth Integrations

-- ============================================================================
-- Connector Credentials with Encrypted Tokens
-- ============================================================================

CREATE TABLE IF NOT EXISTS connector_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_id VARCHAR(100) NOT NULL,
  auth_method VARCHAR(20) NOT NULL CHECK (auth_method IN ('oauth2', 'api_key', 'basic', 'bearer')),
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, connector_id)
);

-- ============================================================================
-- OAuth State for CSRF Protection
-- ============================================================================

CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token VARCHAR(255) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_id VARCHAR(100) NOT NULL,
  redirect_path TEXT,
  pkce_verifier TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Connector Webhook Subscriptions
-- ============================================================================

CREATE TABLE IF NOT EXISTS connector_webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_id VARCHAR(100) NOT NULL,
  webhook_id TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  expiration TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, connector_id, webhook_id)
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_connector_credentials_user ON connector_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_connector_credentials_connector ON connector_credentials(connector_id);
CREATE INDEX IF NOT EXISTS idx_oauth_states_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires ON oauth_states(expires_at);
CREATE INDEX IF NOT EXISTS idx_connector_webhooks_user ON connector_webhooks(user_id);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE connector_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE oauth_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_webhooks ENABLE ROW LEVEL SECURITY;

-- User can only access own credentials
DROP POLICY IF EXISTS "Users can view own credentials" ON connector_credentials;
CREATE POLICY "Users can view own credentials" ON connector_credentials
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own credentials" ON connector_credentials;
CREATE POLICY "Users can manage own credentials" ON connector_credentials
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own oauth states" ON oauth_states;
CREATE POLICY "Users can manage own oauth states" ON oauth_states
  FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can manage own webhooks" ON connector_webhooks;
CREATE POLICY "Users can manage own webhooks" ON connector_webhooks
  FOR ALL USING (auth.uid() = user_id);

-- Service role full access
DROP POLICY IF EXISTS "Service role full access to credentials" ON connector_credentials;
CREATE POLICY "Service role full access to credentials" ON connector_credentials
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to oauth states" ON oauth_states;
CREATE POLICY "Service role full access to oauth states" ON oauth_states
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

DROP POLICY IF EXISTS "Service role full access to webhooks" ON connector_webhooks;
CREATE POLICY "Service role full access to webhooks" ON connector_webhooks
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Cleanup Function for Expired OAuth States
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_oauth_states()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM oauth_states WHERE expires_at < NOW();
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
