-- Browser session persistence table
CREATE TABLE IF NOT EXISTS public.agent_browser_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT UNIQUE NOT NULL,
  user_id UUID NOT NULL,
  task_id UUID REFERENCES public.agent_tasks(id) ON DELETE SET NULL,
  storage_state JSONB NOT NULL DEFAULT '{}',
  cookies JSONB DEFAULT '[]',
  local_storage JSONB DEFAULT '{}',
  session_storage JSONB DEFAULT '{}',
  current_url TEXT,
  viewport_width INTEGER DEFAULT 1920,
  viewport_height INTEGER DEFAULT 1080,
  user_agent TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '24 hours')
);

CREATE INDEX IF NOT EXISTS idx_browser_sessions_session ON public.agent_browser_sessions(session_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_user ON public.agent_browser_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_task ON public.agent_browser_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_browser_sessions_active ON public.agent_browser_sessions(is_active, expires_at);

-- Enable RLS
ALTER TABLE public.agent_browser_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own browser sessions"
  ON public.agent_browser_sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own browser sessions"
  ON public.agent_browser_sessions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own browser sessions"
  ON public.agent_browser_sessions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own browser sessions"
  ON public.agent_browser_sessions FOR DELETE
  USING (auth.uid() = user_id);

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION public.update_browser_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS update_browser_sessions_updated_at ON public.agent_browser_sessions;
CREATE TRIGGER update_browser_sessions_updated_at
  BEFORE UPDATE ON public.agent_browser_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_browser_sessions_updated_at();

-- Cleanup function for expired sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_browser_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM public.agent_browser_sessions
  WHERE expires_at < NOW() OR (is_active = FALSE AND updated_at < NOW() - INTERVAL '1 hour');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;