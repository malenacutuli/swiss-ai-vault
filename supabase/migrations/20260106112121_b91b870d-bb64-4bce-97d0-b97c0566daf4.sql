-- Add missing columns to existing sso_configurations table
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_configurations' AND column_name = 'display_name') THEN
    ALTER TABLE public.sso_configurations ADD COLUMN display_name VARCHAR(255);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_configurations' AND column_name = 'issuer_url') THEN
    ALTER TABLE public.sso_configurations ADD COLUMN issuer_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_configurations' AND column_name = 'authorization_url') THEN
    ALTER TABLE public.sso_configurations ADD COLUMN authorization_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_configurations' AND column_name = 'token_url') THEN
    ALTER TABLE public.sso_configurations ADD COLUMN token_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_configurations' AND column_name = 'userinfo_url') THEN
    ALTER TABLE public.sso_configurations ADD COLUMN userinfo_url TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_configurations' AND column_name = 'scopes') THEN
    ALTER TABLE public.sso_configurations ADD COLUMN scopes TEXT[] DEFAULT ARRAY['openid', 'email', 'profile'];
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_configurations' AND column_name = 'attribute_mapping') THEN
    ALTER TABLE public.sso_configurations ADD COLUMN attribute_mapping JSONB DEFAULT '{"email": "email", "name": "name"}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_configurations' AND column_name = 'enforce_sso') THEN
    ALTER TABLE public.sso_configurations ADD COLUMN enforce_sso BOOLEAN DEFAULT false;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_configurations' AND column_name = 'auto_provision_users') THEN
    ALTER TABLE public.sso_configurations ADD COLUMN auto_provision_users BOOLEAN DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sso_configurations' AND column_name = 'domain_whitelist') THEN
    ALTER TABLE public.sso_configurations ADD COLUMN domain_whitelist TEXT[];
  END IF;
END $$;

-- Create SSO sessions table
CREATE TABLE IF NOT EXISTS public.sso_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sso_config_id UUID NOT NULL REFERENCES public.sso_configurations(id) ON DELETE CASCADE,
  state VARCHAR(255) NOT NULL UNIQUE,
  nonce VARCHAR(255),
  code_verifier VARCHAR(255),
  redirect_uri TEXT,
  original_url TEXT,
  status VARCHAR(20) DEFAULT 'pending',
  user_id UUID,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '10 minutes',
  completed_at TIMESTAMPTZ
);

-- Create SSO audit log
CREATE TABLE IF NOT EXISTS public.sso_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  sso_config_id UUID REFERENCES public.sso_configurations(id) ON DELETE SET NULL,
  event_type VARCHAR(50) NOT NULL,
  user_id UUID,
  email VARCHAR(255),
  ip_address VARCHAR(45),
  user_agent TEXT,
  success BOOLEAN DEFAULT false,
  error_message TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.sso_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sso_audit_logs ENABLE ROW LEVEL SECURITY;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sso_sessions_state ON public.sso_sessions(state);
CREATE INDEX IF NOT EXISTS idx_sso_audit_created ON public.sso_audit_logs(created_at DESC);

-- Function to log SSO events
CREATE OR REPLACE FUNCTION public.log_sso_event(
  p_org_id UUID,
  p_config_id UUID,
  p_event_type TEXT,
  p_user_id UUID DEFAULT NULL,
  p_email TEXT DEFAULT NULL,
  p_success BOOLEAN DEFAULT false,
  p_error TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO sso_audit_logs (
    organization_id, sso_config_id, event_type,
    user_id, email, success, error_message, metadata
  ) VALUES (
    p_org_id, p_config_id, p_event_type,
    p_user_id, p_email, p_success, p_error, p_metadata
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;