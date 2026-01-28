-- Fix overly permissive INSERT policies on system/audit tables
-- These should only allow service_role to insert, not any authenticated user

-- Fix healthcare_usage table
DROP POLICY IF EXISTS "System inserts healthcare usage" ON public.healthcare_usage;
DROP POLICY IF EXISTS "Service role inserts healthcare usage" ON public.healthcare_usage;
CREATE POLICY "Service role inserts healthcare usage"
ON public.healthcare_usage
FOR INSERT
TO service_role
WITH CHECK (true);

-- Fix healthcare_audit_log table
DROP POLICY IF EXISTS "System inserts audit logs" ON public.healthcare_audit_log;
DROP POLICY IF EXISTS "Service role inserts audit logs" ON public.healthcare_audit_log;
CREATE POLICY "Service role inserts audit logs"
ON public.healthcare_audit_log
FOR INSERT
TO service_role
WITH CHECK (true);

-- Fix agent_task_logs table
DROP POLICY IF EXISTS "Service role insert logs" ON public.agent_task_logs;
CREATE POLICY "Service role insert logs"
ON public.agent_task_logs
FOR INSERT
TO service_role
WITH CHECK (true);

-- Fix ghost_usage table
DROP POLICY IF EXISTS "System can insert ghost usage" ON public.ghost_usage;
DROP POLICY IF EXISTS "Service role inserts ghost usage" ON public.ghost_usage;
CREATE POLICY "Service role inserts ghost usage"
ON public.ghost_usage
FOR INSERT
TO service_role
WITH CHECK (true);