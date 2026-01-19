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
-- ============================================================================
-- Connector Views and Usage Tracking
-- ============================================================================

-- ============================================================================
-- Secure View (hides tokens)
-- ============================================================================

-- Create a view that exposes connector info without sensitive tokens
CREATE OR REPLACE VIEW public.user_connectors AS
SELECT
    id,
    user_id,
    provider,
    -- Don't expose tokens
    CASE WHEN access_token_encrypted IS NOT NULL THEN true ELSE false END as has_access_token,
    CASE WHEN refresh_token_encrypted IS NOT NULL THEN true ELSE false END as has_refresh_token,
    expires_at,
    CASE
        WHEN expires_at IS NULL THEN false
        WHEN expires_at < NOW() THEN true
        ELSE false
    END as is_expired,
    scopes,
    provider_account_id,
    provider_account_name,
    provider_account_email,
    is_active,
    created_at,
    updated_at,
    last_used_at
FROM public.connector_credentials;

-- Grant access to the view
GRANT SELECT ON public.user_connectors TO authenticated;

COMMENT ON VIEW public.user_connectors IS 'Safe view of connector credentials without exposing tokens';

-- ============================================================================
-- Connector Usage Log (for analytics and debugging)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.connector_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- References
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    credential_id UUID REFERENCES public.connector_credentials(id) ON DELETE SET NULL,

    -- Request info
    provider TEXT NOT NULL,
    operation TEXT NOT NULL,  -- e.g., 'list_issues', 'send_message'

    -- Response info
    success BOOLEAN NOT NULL,
    error_message TEXT,
    response_time_ms INTEGER,

    -- Metadata
    request_metadata JSONB,  -- Additional request context

    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for usage logs
CREATE INDEX IF NOT EXISTS idx_connector_usage_logs_user_id
    ON public.connector_usage_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_connector_usage_logs_provider
    ON public.connector_usage_logs(provider);

CREATE INDEX IF NOT EXISTS idx_connector_usage_logs_created_at
    ON public.connector_usage_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_connector_usage_logs_user_provider_time
    ON public.connector_usage_logs(user_id, provider, created_at DESC);

-- Enable RLS
ALTER TABLE public.connector_usage_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage logs
CREATE POLICY "Users can view own usage logs"
    ON public.connector_usage_logs
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role has full access
CREATE POLICY "Service role has full access to usage logs"
    ON public.connector_usage_logs
    FOR ALL
    USING (auth.jwt() ->> 'role' = 'service_role');

COMMENT ON TABLE public.connector_usage_logs IS 'Logs of connector API calls for analytics and debugging';

-- ============================================================================
-- Connector Stats View
-- ============================================================================

CREATE OR REPLACE VIEW public.connector_stats AS
SELECT
    user_id,
    provider,
    COUNT(*) as total_calls,
    COUNT(*) FILTER (WHERE success = true) as successful_calls,
    COUNT(*) FILTER (WHERE success = false) as failed_calls,
    ROUND(AVG(response_time_ms)::numeric, 2) as avg_response_time_ms,
    MAX(created_at) as last_used_at,
    MIN(created_at) as first_used_at
FROM public.connector_usage_logs
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY user_id, provider;

GRANT SELECT ON public.connector_stats TO authenticated;

COMMENT ON VIEW public.connector_stats IS 'Aggregated connector usage statistics per user';

-- ============================================================================
-- Function to log connector usage (called from backend)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.log_connector_usage(
    p_user_id UUID,
    p_credential_id UUID,
    p_provider TEXT,
    p_operation TEXT,
    p_success BOOLEAN,
    p_error_message TEXT DEFAULT NULL,
    p_response_time_ms INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_log_id UUID;
BEGIN
    INSERT INTO public.connector_usage_logs (
        user_id,
        credential_id,
        provider,
        operation,
        success,
        error_message,
        response_time_ms,
        request_metadata
    ) VALUES (
        p_user_id,
        p_credential_id,
        p_provider,
        p_operation,
        p_success,
        p_error_message,
        p_response_time_ms,
        p_metadata
    )
    RETURNING id INTO v_log_id;

    -- Update last_used_at on the credential
    IF p_credential_id IS NOT NULL THEN
        UPDATE public.connector_credentials
        SET last_used_at = NOW()
        WHERE id = p_credential_id;
    END IF;

    RETURN v_log_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.log_connector_usage IS 'Log a connector API call and update last_used_at';
