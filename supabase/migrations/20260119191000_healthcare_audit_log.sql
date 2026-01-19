-- Healthcare Audit Log Table
-- Tracks all healthcare AI interactions for compliance

CREATE TABLE IF NOT EXISTS public.healthcare_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    task_type TEXT,
    model_used TEXT,
    tool_calls_count INTEGER DEFAULT 0,
    ip_address TEXT,
    user_agent TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_healthcare_audit_user_id ON public.healthcare_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_audit_created_at ON public.healthcare_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_healthcare_audit_action ON public.healthcare_audit_log(action);

-- RLS policies
ALTER TABLE public.healthcare_audit_log ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users can view own healthcare audit logs"
    ON public.healthcare_audit_log
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can insert (edge function)
CREATE POLICY "Service role can insert healthcare audit logs"
    ON public.healthcare_audit_log
    FOR INSERT
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.healthcare_audit_log TO authenticated;
GRANT INSERT ON public.healthcare_audit_log TO service_role;
