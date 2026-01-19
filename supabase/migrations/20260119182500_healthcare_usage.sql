-- Healthcare Usage Tracking Table
-- Tracks usage of healthcare AI features for billing and analytics

CREATE TABLE IF NOT EXISTS public.healthcare_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    task_type TEXT NOT NULL,
    query_length INTEGER NOT NULL DEFAULT 0,
    response_length INTEGER NOT NULL DEFAULT 0,
    tool_calls INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for user queries
CREATE INDEX IF NOT EXISTS idx_healthcare_usage_user_id ON public.healthcare_usage(user_id);
CREATE INDEX IF NOT EXISTS idx_healthcare_usage_created_at ON public.healthcare_usage(created_at);

-- RLS policies
ALTER TABLE public.healthcare_usage ENABLE ROW LEVEL SECURITY;

-- Users can view their own usage
CREATE POLICY "Users can view own healthcare usage"
    ON public.healthcare_usage
    FOR SELECT
    USING (auth.uid() = user_id);

-- Service role can insert (edge function uses service role)
CREATE POLICY "Service role can insert healthcare usage"
    ON public.healthcare_usage
    FOR INSERT
    WITH CHECK (true);

-- Grant permissions
GRANT SELECT ON public.healthcare_usage TO authenticated;
GRANT INSERT ON public.healthcare_usage TO service_role;
