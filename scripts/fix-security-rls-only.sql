-- Fix RLS Issues Only (skip views for now)
-- Run this in Supabase SQL Editor

-- Enable RLS on all 6 tables with service_role policies

ALTER TABLE public.email_rate_limits ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_email_rate_limits" ON public.email_rate_limits;
CREATE POLICY "service_role_all_email_rate_limits"
  ON public.email_rate_limits FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.ai_models ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_read_ai_models" ON public.ai_models;
CREATE POLICY "anyone_read_ai_models"
  ON public.ai_models FOR SELECT TO authenticated, anon
  USING (true);
DROP POLICY IF EXISTS "service_role_all_ai_models" ON public.ai_models;
CREATE POLICY "service_role_all_ai_models"
  ON public.ai_models FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.model_health ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_read_model_health" ON public.model_health;
CREATE POLICY "anyone_read_model_health"
  ON public.model_health FOR SELECT TO authenticated, anon
  USING (true);
DROP POLICY IF EXISTS "service_role_all_model_health" ON public.model_health;
CREATE POLICY "service_role_all_model_health"
  ON public.model_health FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.response_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_response_cache" ON public.response_cache;
CREATE POLICY "service_role_all_response_cache"
  ON public.response_cache FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.cache_stats ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anyone_read_cache_stats" ON public.cache_stats;
CREATE POLICY "anyone_read_cache_stats"
  ON public.cache_stats FOR SELECT TO authenticated, anon
  USING (true);
DROP POLICY IF EXISTS "service_role_all_cache_stats" ON public.cache_stats;
CREATE POLICY "service_role_all_cache_stats"
  ON public.cache_stats FOR ALL TO service_role
  USING (true) WITH CHECK (true);

ALTER TABLE public.audit_actions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "service_role_all_audit_actions" ON public.audit_actions;
CREATE POLICY "service_role_all_audit_actions"
  ON public.audit_actions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Verify
SELECT tablename, rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('email_rate_limits', 'ai_models', 'model_health', 'response_cache', 'cache_stats', 'audit_actions')
ORDER BY tablename;
