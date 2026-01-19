-- Healthcare Usage Tracking
CREATE TABLE IF NOT EXISTS public.healthcare_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  task_type TEXT NOT NULL,
  query_length INTEGER,
  response_length INTEGER,
  tool_calls INTEGER DEFAULT 0,
  model_used TEXT,
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Healthcare Audit Log (HIPAA Compliance)
CREATE TABLE IF NOT EXISTS public.healthcare_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  task_type TEXT,
  model_used TEXT,
  tool_calls_count INTEGER,
  conversation_id TEXT,
  ip_address TEXT,
  user_agent TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Prevent audit log modifications (HIPAA requirement) using validation trigger
CREATE OR REPLACE FUNCTION prevent_healthcare_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Healthcare audit log is immutable';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS healthcare_audit_immutable ON public.healthcare_audit_log;
CREATE TRIGGER healthcare_audit_immutable
  BEFORE UPDATE OR DELETE ON public.healthcare_audit_log
  FOR EACH ROW EXECUTE FUNCTION prevent_healthcare_audit_modification();

-- Healthcare Conversations (Encrypted)
CREATE TABLE IF NOT EXISTS public.healthcare_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT,
  task_type TEXT DEFAULT 'general_query',
  retention_mode TEXT DEFAULT 'forever',
  message_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Healthcare Messages (Encrypted)
CREATE TABLE IF NOT EXISTS public.healthcare_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.healthcare_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  encrypted_content TEXT NOT NULL,
  model_used TEXT,
  tool_calls JSONB DEFAULT '[]',
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.healthcare_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.healthcare_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.healthcare_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.healthcare_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users view own healthcare usage" ON public.healthcare_usage
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System inserts healthcare usage" ON public.healthcare_usage
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users view own audit logs" ON public.healthcare_audit_log
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System inserts audit logs" ON public.healthcare_audit_log
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Users manage own health conversations" ON public.healthcare_conversations
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users manage own health messages" ON public.healthcare_messages
  FOR ALL USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_health_usage_user ON public.healthcare_usage(user_id, created_at DESC);
CREATE INDEX idx_health_audit_user ON public.healthcare_audit_log(user_id, created_at DESC);
CREATE INDEX idx_health_conv_user ON public.healthcare_conversations(user_id, updated_at DESC);
CREATE INDEX idx_health_msg_conv ON public.healthcare_messages(conversation_id, created_at);