-- Fix overly permissive RLS policies on system tables
-- These tables should only allow inserts from service_role

-- 1. Fix healthcare_usage - restrict to service_role only
DROP POLICY IF EXISTS "System inserts healthcare usage" ON public.healthcare_usage;
CREATE POLICY "Service role inserts healthcare usage" ON public.healthcare_usage
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 2. Fix healthcare_audit_log - restrict to service_role only
DROP POLICY IF EXISTS "System inserts audit logs" ON public.healthcare_audit_log;
CREATE POLICY "Service role inserts audit logs" ON public.healthcare_audit_log
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 3. Fix agent_task_logs - add TO service_role clause
DROP POLICY IF EXISTS "Service role insert logs" ON public.agent_task_logs;
CREATE POLICY "Service role insert logs" ON public.agent_task_logs
  FOR INSERT TO service_role
  WITH CHECK (true);

-- 4. Fix ghost_usage - restrict to service_role only
DROP POLICY IF EXISTS "System can insert ghost usage" ON public.ghost_usage;
CREATE POLICY "Service role inserts ghost usage" ON public.ghost_usage
  FOR INSERT TO service_role
  WITH CHECK (true);