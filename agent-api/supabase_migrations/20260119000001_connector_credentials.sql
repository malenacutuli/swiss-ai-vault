-- ============================================================================
-- Connector Credentials Table
-- Stores OAuth tokens for external service connections (GitHub, Slack, Google)
-- ============================================================================

-- Create connector_credentials table
CREATE TABLE IF NOT EXISTS public.connector_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- User reference
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

    -- Provider info
    provider TEXT NOT NULL,  -- 'github', 'slack', 'google_drive'

    -- OAuth tokens (encrypted)
    access_token_encrypted TEXT NOT NULL,
    refresh_token_encrypted TEXT,

    -- Token metadata
    expires_at TIMESTAMPTZ,
    scopes TEXT[],  -- Array of granted scopes

    -- Provider account info
    provider_account_id TEXT,
    provider_account_name TEXT,
    provider_account_email TEXT,

    -- Status
    is_active BOOLEAN NOT NULL DEFAULT true,

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ,

    -- Ensure one active connection per user per provider
    CONSTRAINT unique_active_user_provider UNIQUE (user_id, provider)
);

-- Create indexes for common queries
CREATE INDEX IF NOT EXISTS idx_connector_credentials_user_id
    ON public.connector_credentials(user_id);

CREATE INDEX IF NOT EXISTS idx_connector_credentials_provider
    ON public.connector_credentials(provider);

CREATE INDEX IF NOT EXISTS idx_connector_credentials_user_provider_active
    ON public.connector_credentials(user_id, provider, is_active);

-- Enable Row Level Security
ALTER TABLE public.connector_credentials ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Users can view their own credentials (but not the tokens)
CREATE POLICY "Users can view own credentials"
    ON public.connector_credentials
    FOR SELECT
    USING (auth.uid() = user_id);

-- Users can insert their own credentials
CREATE POLICY "Users can insert own credentials"
    ON public.connector_credentials
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own credentials
CREATE POLICY "Users can update own credentials"
    ON public.connector_credentials
    FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete (disconnect) their own credentials
CREATE POLICY "Users can delete own credentials"
    ON public.connector_credentials
    FOR DELETE
    USING (auth.uid() = user_id);

-- Service role can access all (for backend operations)
CREATE POLICY "Service role has full access"
    ON public.connector_credentials
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Trigger for updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_connector_credentials_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_connector_credentials_updated_at
    ON public.connector_credentials;

CREATE TRIGGER trigger_update_connector_credentials_updated_at
    BEFORE UPDATE ON public.connector_credentials
    FOR EACH ROW
    EXECUTE FUNCTION update_connector_credentials_updated_at();

-- ============================================================================
-- Comments
-- ============================================================================

COMMENT ON TABLE public.connector_credentials IS 'OAuth credentials for external service connections';
COMMENT ON COLUMN public.connector_credentials.provider IS 'Service provider: github, slack, google_drive';
COMMENT ON COLUMN public.connector_credentials.access_token_encrypted IS 'Encrypted OAuth access token';
COMMENT ON COLUMN public.connector_credentials.refresh_token_encrypted IS 'Encrypted OAuth refresh token (if available)';
COMMENT ON COLUMN public.connector_credentials.scopes IS 'Array of granted OAuth scopes';
COMMENT ON COLUMN public.connector_credentials.is_active IS 'Whether this connection is active (soft delete)';
