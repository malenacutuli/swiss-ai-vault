-- Create connector_credentials table for OAuth integrations
CREATE TABLE IF NOT EXISTS connector_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Connector info
    provider TEXT NOT NULL, -- 'google', 'github', 'slack', 'microsoft', 'figma'
    provider_account_id TEXT,
    provider_account_name TEXT,
    provider_account_email TEXT,

    -- OAuth tokens (encrypted)
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,
    token_type TEXT DEFAULT 'Bearer',

    -- Token metadata
    expires_at TIMESTAMPTZ,
    scopes TEXT[],

    -- Status
    is_active BOOLEAN DEFAULT true,
    last_used_at TIMESTAMPTZ,
    last_error TEXT,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Unique constraint per user per provider
    UNIQUE(user_id, provider)
);

-- Enable RLS
ALTER TABLE connector_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credentials"
    ON connector_credentials FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credentials"
    ON connector_credentials FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credentials"
    ON connector_credentials FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own credentials"
    ON connector_credentials FOR DELETE
    USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_connector_credentials_user_id ON connector_credentials(user_id);
CREATE INDEX IF NOT EXISTS idx_connector_credentials_provider ON connector_credentials(provider);

COMMENT ON TABLE connector_credentials IS 'OAuth connector credentials for external integrations';
