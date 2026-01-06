-- Add rate_limit column to existing api_keys table
ALTER TABLE public.api_keys 
ADD COLUMN IF NOT EXISTS rate_limit INTEGER DEFAULT 100;

-- Create index for faster key lookups
CREATE INDEX IF NOT EXISTS idx_api_keys_prefix ON public.api_keys(key_prefix);
CREATE INDEX IF NOT EXISTS idx_api_keys_user ON public.api_keys(user_id);

-- Table to track API key usage for rate limiting
CREATE TABLE IF NOT EXISTS public.api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  api_key_id UUID NOT NULL REFERENCES public.api_keys(id) ON DELETE CASCADE,
  endpoint TEXT,
  request_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_key_usage_key ON public.api_key_usage(api_key_id);
CREATE INDEX IF NOT EXISTS idx_api_key_usage_window ON public.api_key_usage(api_key_id, window_start);

-- Enable RLS
ALTER TABLE public.api_key_usage ENABLE ROW LEVEL SECURITY;

-- RLS for api_key_usage (service role only for writes, user can view their own)
CREATE POLICY "Users can view their own API key usage"
ON public.api_key_usage FOR SELECT
TO authenticated
USING (
  api_key_id IN (SELECT id FROM public.api_keys WHERE user_id = auth.uid())
);

-- Function to validate API key and check rate limits
CREATE OR REPLACE FUNCTION public.validate_api_key(p_key_prefix TEXT, p_key_hash TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key_record RECORD;
  v_usage_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  -- Find the API key
  SELECT * INTO v_key_record
  FROM public.api_keys
  WHERE key_prefix = p_key_prefix
    AND key_hash = p_key_hash;
  
  IF v_key_record IS NULL THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'invalid_key',
      'message', 'API key not found'
    );
  END IF;
  
  -- Check if expired
  IF v_key_record.expires_at IS NOT NULL AND v_key_record.expires_at < NOW() THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'key_expired',
      'message', 'API key has expired'
    );
  END IF;
  
  -- Check rate limit (per minute window)
  v_window_start := date_trunc('minute', NOW());
  
  SELECT COALESCE(SUM(request_count), 0) INTO v_usage_count
  FROM public.api_key_usage
  WHERE api_key_id = v_key_record.id
    AND window_start >= v_window_start;
  
  IF v_usage_count >= COALESCE(v_key_record.rate_limit, 100) THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error', 'rate_limit_exceeded',
      'message', 'Rate limit exceeded',
      'limit', v_key_record.rate_limit,
      'used', v_usage_count,
      'reset_at', (v_window_start + INTERVAL '1 minute')::TEXT
    );
  END IF;
  
  -- Update last_used_at
  UPDATE public.api_keys SET last_used_at = NOW() WHERE id = v_key_record.id;
  
  -- Increment usage counter
  INSERT INTO public.api_key_usage (api_key_id, window_start, request_count)
  VALUES (v_key_record.id, v_window_start, 1)
  ON CONFLICT (api_key_id, window_start) DO UPDATE SET
    request_count = api_key_usage.request_count + 1;
  
  RETURN jsonb_build_object(
    'valid', true,
    'user_id', v_key_record.user_id,
    'permissions', v_key_record.permissions,
    'remaining', COALESCE(v_key_record.rate_limit, 100) - v_usage_count - 1
  );
END;
$$;

-- Add unique constraint for rate limit tracking
ALTER TABLE public.api_key_usage 
DROP CONSTRAINT IF EXISTS api_key_usage_key_window_unique;

ALTER TABLE public.api_key_usage 
ADD CONSTRAINT api_key_usage_key_window_unique 
UNIQUE (api_key_id, window_start);

-- Function to create a new API key (returns the raw key only once)
CREATE OR REPLACE FUNCTION public.create_api_key(
  p_name TEXT,
  p_permissions JSONB DEFAULT '[]',
  p_rate_limit INTEGER DEFAULT 100,
  p_expires_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_raw_key TEXT;
  v_key_prefix TEXT;
  v_key_hash TEXT;
  v_key_id UUID;
BEGIN
  -- Generate a secure random key (32 bytes = 64 hex chars)
  v_raw_key := 'sk_' || encode(gen_random_bytes(32), 'hex');
  v_key_prefix := substring(v_raw_key, 1, 8);
  v_key_hash := encode(sha256(v_raw_key::bytea), 'hex');
  
  -- Insert the key
  INSERT INTO public.api_keys (user_id, name, key_hash, key_prefix, permissions, rate_limit, expires_at)
  VALUES (auth.uid(), p_name, v_key_hash, v_key_prefix, p_permissions, p_rate_limit, p_expires_at)
  RETURNING id INTO v_key_id;
  
  -- Return the raw key (only shown once)
  RETURN jsonb_build_object(
    'id', v_key_id,
    'key', v_raw_key,
    'prefix', v_key_prefix,
    'name', p_name,
    'message', 'Store this key securely. It will not be shown again.'
  );
END;
$$;

-- Function to revoke an API key
CREATE OR REPLACE FUNCTION public.revoke_api_key(p_key_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.api_keys
  WHERE id = p_key_id AND user_id = auth.uid();
  
  RETURN FOUND;
END;
$$;

-- Function to list user's API keys (without exposing hashes)
CREATE OR REPLACE FUNCTION public.list_api_keys()
RETURNS TABLE(
  id UUID,
  name TEXT,
  key_prefix TEXT,
  permissions JSONB,
  rate_limit INTEGER,
  last_used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    id,
    name::TEXT,
    key_prefix::TEXT,
    permissions,
    rate_limit,
    last_used_at,
    expires_at,
    created_at
  FROM public.api_keys
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC
$$;

-- Cleanup old usage records (run periodically)
CREATE OR REPLACE FUNCTION public.cleanup_api_key_usage()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM public.api_key_usage
  WHERE window_start < NOW() - INTERVAL '1 hour';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;