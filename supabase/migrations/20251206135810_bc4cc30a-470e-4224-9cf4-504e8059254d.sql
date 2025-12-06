-- Add missing columns to existing audit_logs table
ALTER TABLE public.audit_logs 
ADD COLUMN IF NOT EXISTS old_values JSONB,
ADD COLUMN IF NOT EXISTS new_values JSONB,
ADD COLUMN IF NOT EXISTS user_agent TEXT;

-- Make table immutable (prevent updates and deletes)
CREATE OR REPLACE RULE audit_logs_readonly AS ON UPDATE TO public.audit_logs DO INSTEAD NOTHING;
CREATE OR REPLACE RULE audit_logs_nodelete AS ON DELETE TO public.audit_logs DO INSTEAD NOTHING;

-- Add indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Add RLS policy for users to view their own audit logs
CREATE POLICY "Users can view own audit logs" ON public.audit_logs
  FOR SELECT USING (user_id = auth.uid());