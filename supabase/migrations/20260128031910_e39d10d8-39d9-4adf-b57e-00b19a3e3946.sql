-- =====================================================
-- Platform Owner Analytics & User Monitoring System
-- =====================================================

-- 1. Create platform_analytics_events table
CREATE TABLE public.platform_analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    anonymous_id TEXT,
    session_id UUID,
    event_type TEXT NOT NULL,
    event_name TEXT,
    page_path TEXT,
    feature_category TEXT,
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    country_code TEXT,
    region TEXT,
    city TEXT,
    user_agent TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Create user_sessions table
CREATE TABLE public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    anonymous_id TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    ended_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    page_count INTEGER DEFAULT 0,
    feature_count INTEGER DEFAULT 0,
    event_count INTEGER DEFAULT 0,
    entry_page TEXT,
    exit_page TEXT,
    ip_address INET,
    country_code TEXT,
    region TEXT,
    city TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    is_converted BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    last_activity_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create user_signups table
CREATE TABLE public.user_signups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    email TEXT NOT NULL,
    full_name TEXT,
    signup_method TEXT DEFAULT 'email',
    ip_address INET,
    country_code TEXT,
    region TEXT,
    city TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_medium TEXT,
    utm_campaign TEXT,
    landing_page TEXT,
    pages_before_signup INTEGER DEFAULT 0,
    time_to_signup_seconds INTEGER DEFAULT 0,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    user_agent TEXT,
    notification_sent BOOLEAN DEFAULT false,
    tier_assigned TEXT DEFAULT 'ghost_free',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. Create user_cost_tracking table
CREATE TABLE public.user_cost_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    feature TEXT NOT NULL,
    provider TEXT,
    model TEXT,
    input_tokens INTEGER DEFAULT 0,
    output_tokens INTEGER DEFAULT 0,
    total_tokens INTEGER DEFAULT 0,
    estimated_cost_usd NUMERIC(10,6) DEFAULT 0,
    requests_count INTEGER DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Create indexes for performance
CREATE INDEX idx_analytics_events_user_id ON public.platform_analytics_events(user_id);
CREATE INDEX idx_analytics_events_session_id ON public.platform_analytics_events(session_id);
CREATE INDEX idx_analytics_events_created_at ON public.platform_analytics_events(created_at DESC);
CREATE INDEX idx_analytics_events_event_type ON public.platform_analytics_events(event_type);
CREATE INDEX idx_analytics_events_feature ON public.platform_analytics_events(feature_category);

CREATE INDEX idx_user_sessions_user_id ON public.user_sessions(user_id);
CREATE INDEX idx_user_sessions_started_at ON public.user_sessions(started_at DESC);
CREATE INDEX idx_user_sessions_is_active ON public.user_sessions(is_active);
CREATE INDEX idx_user_sessions_anonymous_id ON public.user_sessions(anonymous_id);

CREATE INDEX idx_user_signups_user_id ON public.user_signups(user_id);
CREATE INDEX idx_user_signups_created_at ON public.user_signups(created_at DESC);
CREATE INDEX idx_user_signups_email ON public.user_signups(email);

CREATE INDEX idx_user_cost_tracking_user_id ON public.user_cost_tracking(user_id);
CREATE INDEX idx_user_cost_tracking_date ON public.user_cost_tracking(date DESC);
CREATE INDEX idx_user_cost_tracking_user_date ON public.user_cost_tracking(user_id, date);

-- 6. Enable RLS on all tables
ALTER TABLE public.platform_analytics_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_cost_tracking ENABLE ROW LEVEL SECURITY;

-- 7. Create admin-only read policies using existing has_role function
CREATE POLICY "Admins can view all analytics events"
ON public.platform_analytics_events FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert analytics events"
ON public.platform_analytics_events FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY "Service role can manage analytics events"
ON public.platform_analytics_events FOR ALL
TO service_role
USING (true);

CREATE POLICY "Admins can view all sessions"
ON public.user_sessions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage sessions"
ON public.user_sessions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage sessions"
ON public.user_sessions FOR ALL
TO service_role
USING (true);

CREATE POLICY "Admins can view all signups"
ON public.user_signups FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Service role can manage signups"
ON public.user_signups FOR ALL
TO service_role
USING (true);

CREATE POLICY "Admins can view all cost tracking"
ON public.user_cost_tracking FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own cost tracking"
ON public.user_cost_tracking FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage cost tracking"
ON public.user_cost_tracking FOR ALL
TO service_role
USING (true);

-- 8. Create function to get platform analytics summary
CREATE OR REPLACE FUNCTION public.get_platform_analytics_summary(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Only allow admins
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;

    SELECT jsonb_build_object(
        'total_signups', (SELECT COUNT(*) FROM user_signups WHERE created_at >= now() - (p_days || ' days')::interval),
        'signups_today', (SELECT COUNT(*) FROM user_signups WHERE created_at >= CURRENT_DATE),
        'signups_this_week', (SELECT COUNT(*) FROM user_signups WHERE created_at >= date_trunc('week', now())),
        'signups_this_month', (SELECT COUNT(*) FROM user_signups WHERE created_at >= date_trunc('month', now())),
        'active_sessions', (SELECT COUNT(*) FROM user_sessions WHERE is_active = true AND last_activity_at >= now() - interval '15 minutes'),
        'total_sessions_today', (SELECT COUNT(*) FROM user_sessions WHERE started_at >= CURRENT_DATE),
        'avg_session_duration', (SELECT COALESCE(AVG(duration_seconds), 0) FROM user_sessions WHERE started_at >= now() - (p_days || ' days')::interval),
        'total_events', (SELECT COUNT(*) FROM platform_analytics_events WHERE created_at >= now() - (p_days || ' days')::interval),
        'events_today', (SELECT COUNT(*) FROM platform_analytics_events WHERE created_at >= CURRENT_DATE),
        'unique_users_today', (SELECT COUNT(DISTINCT user_id) FROM platform_analytics_events WHERE created_at >= CURRENT_DATE AND user_id IS NOT NULL),
        'total_cost_today', (SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM user_cost_tracking WHERE date = CURRENT_DATE),
        'total_cost_this_month', (SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM user_cost_tracking WHERE date >= date_trunc('month', now())::date)
    ) INTO result;

    RETURN result;
END;
$$;

-- 9. Create function to get recent signups with full details
CREATE OR REPLACE FUNCTION public.get_recent_signups(p_limit INTEGER DEFAULT 50)
RETURNS TABLE (
    id UUID,
    user_id UUID,
    email TEXT,
    full_name TEXT,
    signup_method TEXT,
    country_code TEXT,
    city TEXT,
    referrer TEXT,
    utm_source TEXT,
    utm_campaign TEXT,
    device_type TEXT,
    browser TEXT,
    tier_assigned TEXT,
    created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow admins
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;

    RETURN QUERY
    SELECT 
        s.id,
        s.user_id,
        s.email,
        s.full_name,
        s.signup_method,
        s.country_code,
        s.city,
        s.referrer,
        s.utm_source,
        s.utm_campaign,
        s.device_type,
        s.browser,
        s.tier_assigned,
        s.created_at
    FROM user_signups s
    ORDER BY s.created_at DESC
    LIMIT p_limit;
END;
$$;

-- 10. Create function to get user activity details
CREATE OR REPLACE FUNCTION public.get_user_activity_details(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    -- Only allow admins
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;

    SELECT jsonb_build_object(
        'total_sessions', (SELECT COUNT(*) FROM user_sessions WHERE user_id = p_user_id),
        'total_events', (SELECT COUNT(*) FROM platform_analytics_events WHERE user_id = p_user_id),
        'total_page_views', (SELECT COUNT(*) FROM platform_analytics_events WHERE user_id = p_user_id AND event_type = 'page_view'),
        'total_feature_uses', (SELECT COUNT(*) FROM platform_analytics_events WHERE user_id = p_user_id AND event_type = 'feature_use'),
        'total_cost', (SELECT COALESCE(SUM(estimated_cost_usd), 0) FROM user_cost_tracking WHERE user_id = p_user_id),
        'total_tokens', (SELECT COALESCE(SUM(total_tokens), 0) FROM user_cost_tracking WHERE user_id = p_user_id),
        'first_seen', (SELECT MIN(created_at) FROM platform_analytics_events WHERE user_id = p_user_id),
        'last_seen', (SELECT MAX(created_at) FROM platform_analytics_events WHERE user_id = p_user_id),
        'avg_session_duration', (SELECT COALESCE(AVG(duration_seconds), 0) FROM user_sessions WHERE user_id = p_user_id),
        'feature_breakdown', (
            SELECT jsonb_object_agg(feature_category, cnt)
            FROM (
                SELECT feature_category, COUNT(*) as cnt
                FROM platform_analytics_events
                WHERE user_id = p_user_id AND feature_category IS NOT NULL
                GROUP BY feature_category
            ) sub
        ),
        'recent_sessions', (
            SELECT jsonb_agg(jsonb_build_object(
                'id', id,
                'started_at', started_at,
                'duration_seconds', duration_seconds,
                'page_count', page_count,
                'entry_page', entry_page
            ) ORDER BY started_at DESC)
            FROM (
                SELECT id, started_at, duration_seconds, page_count, entry_page
                FROM user_sessions
                WHERE user_id = p_user_id
                ORDER BY started_at DESC
                LIMIT 10
            ) sub
        )
    ) INTO result;

    RETURN result;
END;
$$;

-- 11. Create function to get feature usage stats
CREATE OR REPLACE FUNCTION public.get_feature_usage_stats(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    feature_category TEXT,
    total_uses BIGINT,
    unique_users BIGINT,
    avg_uses_per_user NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow admins
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;

    RETURN QUERY
    SELECT 
        e.feature_category,
        COUNT(*) as total_uses,
        COUNT(DISTINCT e.user_id) as unique_users,
        ROUND(COUNT(*)::numeric / NULLIF(COUNT(DISTINCT e.user_id), 0), 2) as avg_uses_per_user
    FROM platform_analytics_events e
    WHERE e.feature_category IS NOT NULL
      AND e.created_at >= now() - (p_days || ' days')::interval
    GROUP BY e.feature_category
    ORDER BY total_uses DESC;
END;
$$;

-- 12. Create function to get cost breakdown by user
CREATE OR REPLACE FUNCTION public.get_user_cost_breakdown(p_days INTEGER DEFAULT 30)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    total_cost NUMERIC,
    total_tokens BIGINT,
    total_requests BIGINT,
    top_feature TEXT,
    top_model TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow admins
    IF NOT public.has_role(auth.uid(), 'admin') THEN
        RAISE EXCEPTION 'Access denied: Admin role required';
    END IF;

    RETURN QUERY
    WITH user_costs AS (
        SELECT 
            c.user_id,
            SUM(c.estimated_cost_usd) as total_cost,
            SUM(c.total_tokens) as total_tokens,
            SUM(c.requests_count) as total_requests
        FROM user_cost_tracking c
        WHERE c.date >= (CURRENT_DATE - p_days)
        GROUP BY c.user_id
    ),
    top_features AS (
        SELECT DISTINCT ON (c.user_id)
            c.user_id,
            c.feature as top_feature
        FROM user_cost_tracking c
        WHERE c.date >= (CURRENT_DATE - p_days)
        GROUP BY c.user_id, c.feature
        ORDER BY c.user_id, SUM(c.estimated_cost_usd) DESC
    ),
    top_models AS (
        SELECT DISTINCT ON (c.user_id)
            c.user_id,
            c.model as top_model
        FROM user_cost_tracking c
        WHERE c.date >= (CURRENT_DATE - p_days)
        GROUP BY c.user_id, c.model
        ORDER BY c.user_id, SUM(c.estimated_cost_usd) DESC
    )
    SELECT 
        uc.user_id,
        COALESCE(s.email, u.email) as email,
        uc.total_cost,
        uc.total_tokens,
        uc.total_requests,
        tf.top_feature,
        tm.top_model
    FROM user_costs uc
    LEFT JOIN user_signups s ON s.user_id = uc.user_id
    LEFT JOIN auth.users u ON u.id = uc.user_id
    LEFT JOIN top_features tf ON tf.user_id = uc.user_id
    LEFT JOIN top_models tm ON tm.user_id = uc.user_id
    ORDER BY uc.total_cost DESC;
END;
$$;

-- 13. Create function to track cost (called from edge functions)
CREATE OR REPLACE FUNCTION public.track_user_cost(
    p_user_id UUID,
    p_feature TEXT,
    p_provider TEXT,
    p_model TEXT,
    p_input_tokens INTEGER,
    p_output_tokens INTEGER,
    p_cost_usd NUMERIC
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO user_cost_tracking (
        user_id, date, feature, provider, model,
        input_tokens, output_tokens, total_tokens,
        estimated_cost_usd, requests_count
    )
    VALUES (
        p_user_id, CURRENT_DATE, p_feature, p_provider, p_model,
        p_input_tokens, p_output_tokens, p_input_tokens + p_output_tokens,
        p_cost_usd, 1
    )
    ON CONFLICT (user_id, date, feature, provider, model) 
    DO UPDATE SET
        input_tokens = user_cost_tracking.input_tokens + EXCLUDED.input_tokens,
        output_tokens = user_cost_tracking.output_tokens + EXCLUDED.output_tokens,
        total_tokens = user_cost_tracking.total_tokens + EXCLUDED.total_tokens,
        estimated_cost_usd = user_cost_tracking.estimated_cost_usd + EXCLUDED.estimated_cost_usd,
        requests_count = user_cost_tracking.requests_count + 1,
        updated_at = now();
END;
$$;

-- 14. Add unique constraint for cost tracking upsert
ALTER TABLE public.user_cost_tracking 
ADD CONSTRAINT user_cost_tracking_unique_key 
UNIQUE (user_id, date, feature, provider, model);

-- 15. Create trigger function to record signups
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Insert signup record
    INSERT INTO user_signups (
        user_id,
        email,
        full_name,
        signup_method,
        tier_assigned
    )
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
        CASE 
            WHEN NEW.raw_app_meta_data->>'provider' IS NOT NULL THEN NEW.raw_app_meta_data->>'provider'
            ELSE 'email'
        END,
        'ghost_free'
    );

    -- Call edge function to send notification (using pg_net if available)
    -- This will be handled by the edge function directly
    
    RETURN NEW;
END;
$$;

-- 16. Create trigger on auth.users for new signups
DROP TRIGGER IF EXISTS on_auth_user_created_signup ON auth.users;
CREATE TRIGGER on_auth_user_created_signup
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_signup();