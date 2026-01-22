-- Fix Security Linter Issues for Direct Project
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/ghmmdochvlrnwbruyrqk/sql

-- =====================================================
-- PART 1: Fix SECURITY DEFINER Views → SECURITY INVOKER
-- =====================================================

-- 1.1 Fix connector_stats view
DROP VIEW IF EXISTS public.connector_stats;
CREATE VIEW public.connector_stats
WITH (security_invoker = true)
AS
SELECT user_id,
    provider,
    count(*) AS total_calls,
    count(*) FILTER (WHERE (success = true)) AS successful_calls,
    count(*) FILTER (WHERE (success = false)) AS failed_calls,
    max(created_at) AS last_used_at
FROM connector_usage_logs
WHERE (created_at > (now() - '30 days'::interval))
GROUP BY user_id, provider;

-- 1.2 Fix latest_health_status view
DROP VIEW IF EXISTS public.latest_health_status;
CREATE VIEW public.latest_health_status
WITH (security_invoker = true)
AS
SELECT overall_status,
    checks,
    "timestamp"
FROM health_metrics
ORDER BY "timestamp" DESC
LIMIT 1;

-- 1.3 Fix user_connectors view
DROP VIEW IF EXISTS public.user_connectors;
CREATE VIEW public.user_connectors
WITH (security_invoker = true)
AS
SELECT id,
    user_id,
    provider,
    is_active,
    created_at
FROM connector_credentials;

-- =====================================================
-- PART 2: Enable RLS on Public Tables + Add Policies
-- =====================================================

-- 2.1 email_rate_limits - System table, service role only
ALTER TABLE public.email_rate_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "service_role_all_email_rate_limits" ON public.email_rate_limits;
CREATE POLICY "service_role_all_email_rate_limits"
  ON public.email_rate_limits
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2.2 ai_models - Read-only for authenticated users
ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_ai_models" ON public.ai_models;
CREATE POLICY "authenticated_read_ai_models"
  ON public.ai_models
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "service_role_all_ai_models" ON public.ai_models;
CREATE POLICY "service_role_all_ai_models"
  ON public.ai_models
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2.3 model_health - Read-only for authenticated users
ALTER TABLE public.model_health ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_model_health" ON public.model_health;
CREATE POLICY "authenticated_read_model_health"
  ON public.model_health
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "service_role_all_model_health" ON public.model_health;
CREATE POLICY "service_role_all_model_health"
  ON public.model_health
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2.4 response_cache - Users access own cache only
ALTER TABLE public.response_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_response_cache" ON public.response_cache;
CREATE POLICY "users_own_response_cache"
  ON public.response_cache
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_all_response_cache" ON public.response_cache;
CREATE POLICY "service_role_all_response_cache"
  ON public.response_cache
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2.5 cache_stats - Read-only for authenticated
ALTER TABLE public.cache_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_cache_stats" ON public.cache_stats;
CREATE POLICY "authenticated_read_cache_stats"
  ON public.cache_stats
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "service_role_all_cache_stats" ON public.cache_stats;
CREATE POLICY "service_role_all_cache_stats"
  ON public.cache_stats
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 2.6 audit_actions - Users read own audit logs only
ALTER TABLE public.audit_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_read_own_audit_actions" ON public.audit_actions;
CREATE POLICY "users_read_own_audit_actions"
  ON public.audit_actions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "service_role_all_audit_actions" ON public.audit_actions;
CREATE POLICY "service_role_all_audit_actions"
  ON public.audit_actions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check RLS is enabled on all tables
SELECT
  tablename,
  rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'email_rate_limits',
    'ai_models',
    'model_health',
    'response_cache',
    'cache_stats',
    'audit_actions'
  )
ORDER BY tablename;

-- Check policies exist
SELECT
  tablename,
  policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'email_rate_limits',
    'ai_models',
    'model_health',
    'response_cache',
    'cache_stats',
    'audit_actions'
  )
ORDER BY tablename, policyname;
