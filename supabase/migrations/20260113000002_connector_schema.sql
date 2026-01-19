-- =============================================
-- CONNECTOR SCHEMA
-- OAuth credentials and connector configurations
-- =============================================

-- Drop existing tables if they exist (from failed migrations)
DROP TABLE IF EXISTS connector_usage_log CASCADE;
DROP TABLE IF EXISTS connector_credentials CASCADE;
DROP TABLE IF EXISTS connector_definitions CASCADE;

-- =============================================
-- CONNECTOR DEFINITIONS TABLE
-- Available connectors and their configurations
-- =============================================

CREATE TABLE connector_definitions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  icon_url TEXT,
  category TEXT NOT NULL,

  -- Auth configuration
  auth_methods TEXT[] NOT NULL DEFAULT '{"oauth2"}',
  oauth_config JSONB,

  -- Scopes
  required_scopes TEXT[] DEFAULT '{}',
  optional_scopes TEXT[] DEFAULT '{}',

  -- Features
  webhook_support BOOLEAN DEFAULT FALSE,

  -- Rate limiting
  rate_limit_requests INTEGER,
  rate_limit_window_seconds INTEGER,

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_beta BOOLEAN DEFAULT FALSE,

  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default connector definitions
INSERT INTO connector_definitions (id, name, description, icon_url, category, oauth_config, required_scopes, optional_scopes, webhook_support, rate_limit_requests, rate_limit_window_seconds)
VALUES
  ('google_gmail', 'Gmail', 'Send and receive emails via Gmail', '/connectors/gmail.svg', 'communication',
   '{"authorization_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "revoke_url": "https://oauth2.googleapis.com/revoke", "scope_separator": " ", "pkce_required": true}',
   ARRAY['https://www.googleapis.com/auth/gmail.readonly', 'https://www.googleapis.com/auth/gmail.send'],
   ARRAY['https://www.googleapis.com/auth/gmail.modify'],
   TRUE, 250, 1 ),

  ('google_calendar', 'Google Calendar', 'Manage calendar events', '/connectors/gcal.svg', 'calendar',
   '{"authorization_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "revoke_url": "https://oauth2.googleapis.com/revoke", "scope_separator": " ", "pkce_required": true}',
   ARRAY['https://www.googleapis.com/auth/calendar.readonly', 'https://www.googleapis.com/auth/calendar.events'],
   ARRAY[]::TEXT[],
   TRUE, 100, 1 ),

  ('google_drive', 'Google Drive', 'Access and manage files in Google Drive', '/connectors/gdrive.svg', 'storage',
   '{"authorization_url": "https://accounts.google.com/o/oauth2/v2/auth", "token_url": "https://oauth2.googleapis.com/token", "revoke_url": "https://oauth2.googleapis.com/revoke", "scope_separator": " ", "pkce_required": true}',
   ARRAY['https://www.googleapis.com/auth/drive.readonly'],
   ARRAY['https://www.googleapis.com/auth/drive.file'],
   TRUE, 100, 1 ),

  ('github', 'GitHub', 'Access repositories, issues, and pull requests', '/connectors/github.svg', 'development',
   '{"authorization_url": "https://github.com/login/oauth/authorize", "token_url": "https://github.com/login/oauth/access_token", "scope_separator": " ", "pkce_required": false}',
   ARRAY['repo', 'read:user'],
   ARRAY['write:repo_hook', 'delete_repo'],
   TRUE, 5000, 3600 ),

  ('slack', 'Slack', 'Send messages and manage Slack workspace', '/connectors/slack.svg', 'communication',
   '{"authorization_url": "https://slack.com/oauth/v2/authorize", "token_url": "https://slack.com/api/oauth.v2.access", "revoke_url": "https://slack.com/api/auth.revoke", "scope_separator": ",", "pkce_required": false}',
   ARRAY['chat:write', 'channels:read'],
   ARRAY['files:write', 'users:read'],
   TRUE, 50, 60 ),

  ('notion', 'Notion', 'Access and update Notion pages and databases', '/connectors/notion.svg', 'productivity',
   '{"authorization_url": "https://api.notion.com/v1/oauth/authorize", "token_url": "https://api.notion.com/v1/oauth/token", "scope_separator": " ", "pkce_required": false}',
   ARRAY[]::TEXT[],
   ARRAY[]::TEXT[],
   FALSE, 3, 1 ),

  ('microsoft_onedrive', 'OneDrive', 'Access and manage files in OneDrive', '/connectors/onedrive.svg', 'storage',
   '{"authorization_url": "https://login.microsoftonline.com/common/oauth2/v2.0/authorize", "token_url": "https://login.microsoftonline.com/common/oauth2/v2.0/token", "scope_separator": " ", "pkce_required": true}',
   ARRAY['Files.Read', 'Files.ReadWrite', 'offline_access'],
   ARRAY['User.Read'],
   TRUE, 10000, 600 ),

  ('figma', 'Figma', 'Access Figma designs and components', '/connectors/figma.svg', 'design',
   '{"authorization_url": "https://www.figma.com/oauth", "token_url": "https://www.figma.com/api/oauth/token", "scope_separator": ",", "pkce_required": false}',
   ARRAY['file_read'],
   ARRAY['file_write'],
   TRUE, 120, 60 ),

  ('stripe', 'Stripe', 'Process payments and manage subscriptions', '/connectors/stripe.svg', 'payment',
   NULL,
   ARRAY[]::TEXT[],
   ARRAY[]::TEXT[],
   TRUE, 100, 1)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  oauth_config = EXCLUDED.oauth_config,
  required_scopes = EXCLUDED.required_scopes,
  optional_scopes = EXCLUDED.optional_scopes,
  updated_at = NOW();

-- =============================================
-- USER CONNECTOR CREDENTIALS TABLE
-- Encrypted OAuth tokens per user
-- =============================================

CREATE TABLE connector_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_id TEXT NOT NULL REFERENCES connector_definitions(id),

  -- Encrypted tokens (use pgcrypto)
  access_token_encrypted BYTEA NOT NULL,
  refresh_token_encrypted BYTEA,

  -- Token metadata (not encrypted)
  token_type TEXT DEFAULT 'Bearer',
  expires_at TIMESTAMPTZ,
  scopes TEXT[] DEFAULT '{}',

  -- Provider-specific data
  provider_user_id TEXT,
  provider_email TEXT,
  provider_data JSONB DEFAULT '{}',

  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ,
  last_refreshed_at TIMESTAMPTZ,

  -- Error tracking
  consecutive_failures INTEGER DEFAULT 0,
  last_error TEXT,
  last_error_at TIMESTAMPTZ,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint
  UNIQUE(user_id, connector_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connector_credentials_user_id ON connector_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_connector_credentials_connector_id ON connector_credentials(connector_id);
CREATE INDEX IF NOT EXISTS idx_connector_credentials_expires_at ON connector_credentials(expires_at);

-- =============================================
-- CONNECTOR USAGE LOG TABLE
-- Track connector API calls for rate limiting and billing
-- =============================================

CREATE TABLE connector_usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  credential_id UUID NOT NULL REFERENCES connector_credentials(id) ON DELETE CASCADE,
  connector_id TEXT NOT NULL,

  -- Request details
  action TEXT NOT NULL,
  request_method TEXT,
  request_path TEXT,

  -- Response
  response_status INTEGER,
  response_time_ms INTEGER,

  -- Error tracking
  error_message TEXT,

  -- Timing
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connector_usage_user_id ON connector_usage_log(user_id);
CREATE INDEX IF NOT EXISTS idx_connector_usage_connector_id ON connector_usage_log(connector_id);
CREATE INDEX IF NOT EXISTS idx_connector_usage_created_at ON connector_usage_log(created_at DESC);

-- Partitioning for usage log (keep last 90 days)
-- Note: Implement partition management separately

-- =============================================
-- RLS POLICIES
-- =============================================

ALTER TABLE connector_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE connector_usage_log ENABLE ROW LEVEL SECURITY;

-- connector_definitions - public read
CREATE POLICY "Anyone can view active connectors"
  ON connector_definitions FOR SELECT
  USING (is_active = TRUE);

-- connector_credentials - user only
CREATE POLICY "Users can view own credentials"
  ON connector_credentials FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own credentials"
  ON connector_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
  ON connector_credentials FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
  ON connector_credentials FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to credentials"
  ON connector_credentials FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- connector_usage_log - user only
CREATE POLICY "Users can view own usage"
  ON connector_usage_log FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role has full access to usage"
  ON connector_usage_log FOR ALL
  USING (auth.jwt() ->> 'role' = 'service_role');

-- =============================================
-- ENCRYPTION FUNCTIONS
-- =============================================

-- Function to encrypt token
CREATE OR REPLACE FUNCTION encrypt_token(token TEXT, encryption_key TEXT)
RETURNS BYTEA AS $$
BEGIN
  RETURN pgp_sym_encrypt(token, encryption_key);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to decrypt token
CREATE OR REPLACE FUNCTION decrypt_token(encrypted_token BYTEA, encryption_key TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN pgp_sym_decrypt(encrypted_token, encryption_key);
EXCEPTION
  WHEN OTHERS THEN
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================
-- TOKEN REFRESH FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION refresh_expiring_tokens()
RETURNS INTEGER AS $$
DECLARE
  refreshed_count INTEGER := 0;
BEGIN
  -- This function is called by a scheduled job
  -- Actual refresh logic is in the Edge Function
  -- This just marks tokens that need refresh

  UPDATE connector_credentials
  SET updated_at = NOW()
  WHERE expires_at < NOW() + INTERVAL '5 minutes'
    AND refresh_token_encrypted IS NOT NULL
    AND is_active = TRUE;

  GET DIAGNOSTICS refreshed_count = ROW_COUNT;
  RETURN refreshed_count;
END;
$$ LANGUAGE plpgsql;
