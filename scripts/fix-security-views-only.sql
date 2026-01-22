-- Fix SECURITY DEFINER Views → SECURITY INVOKER
-- Run this in Supabase SQL Editor

-- 1. Fix connector_stats view
DROP VIEW IF EXISTS public.connector_stats;
CREATE VIEW public.connector_stats
WITH (security_invoker = true)
AS
SELECT user_id,
    provider,
    count(*) AS total_calls,
    count(*) FILTER (WHERE success = true) AS successful_calls,
    count(*) FILTER (WHERE success = false) AS failed_calls,
    max(created_at) AS last_used_at
FROM public.connector_usage_logs
WHERE created_at > (now() - '30 days'::interval)
GROUP BY user_id, provider;

-- 2. Fix latest_health_status view
DROP VIEW IF EXISTS public.latest_health_status;
CREATE VIEW public.latest_health_status
WITH (security_invoker = true)
AS
SELECT overall_status,
    checks,
    "timestamp"
FROM public.health_metrics
ORDER BY "timestamp" DESC
LIMIT 1;

-- 3. Fix user_connectors view
DROP VIEW IF EXISTS public.user_connectors;
CREATE VIEW public.user_connectors
WITH (security_invoker = true)
AS
SELECT id,
    user_id,
    provider,
    is_active,
    created_at
FROM public.connector_credentials;

-- Verify views are created
SELECT viewname FROM pg_views WHERE schemaname = 'public'
AND viewname IN ('connector_stats', 'latest_health_status', 'user_connectors');
