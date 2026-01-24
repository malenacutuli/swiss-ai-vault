-- Create connector_credentials table to persist OAuth integration status
CREATE TABLE public.connector_credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connector_id TEXT NOT NULL,
  access_token_encrypted TEXT NOT NULL,
  refresh_token_encrypted TEXT,
  token_expires_at TIMESTAMPTZ,
  scopes TEXT[],
  metadata JSONB DEFAULT '{}',
  connected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, connector_id)
);

-- Enable RLS
ALTER TABLE public.connector_credentials ENABLE ROW LEVEL SECURITY;

-- Users can only see their own credentials
CREATE POLICY "Users can view own connector credentials"
  ON public.connector_credentials FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own credentials  
CREATE POLICY "Users can insert own connector credentials"
  ON public.connector_credentials FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own credentials
CREATE POLICY "Users can update own connector credentials"
  ON public.connector_credentials FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own credentials
CREATE POLICY "Users can delete own connector credentials"
  ON public.connector_credentials FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_connector_credentials_updated_at
  BEFORE UPDATE ON public.connector_credentials
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();