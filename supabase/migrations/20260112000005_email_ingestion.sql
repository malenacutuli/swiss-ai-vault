-- supabase/migrations/20260112000005_email_ingestion.sql
-- SwissBrain Email Ingestion - Email-to-Task Workflow

-- ============================================================================
-- Email Ingestion Tracking
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_ingestion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id VARCHAR(255) NOT NULL,
  idempotency_key VARCHAR(64) NOT NULL UNIQUE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_address VARCHAR(255) NOT NULL,
  to_addresses TEXT[] NOT NULL,
  cc_addresses TEXT[] DEFAULT '{}',
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  attachments_count INTEGER DEFAULT 0,
  run_id UUID REFERENCES agent_tasks(id),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message TEXT,
  received_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- Indexes for Performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_email_ingestion_user ON email_ingestion(user_id);
CREATE INDEX IF NOT EXISTS idx_email_ingestion_idempotency ON email_ingestion(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_email_ingestion_message ON email_ingestion(message_id);
CREATE INDEX IF NOT EXISTS idx_email_ingestion_status ON email_ingestion(status);

-- ============================================================================
-- Row Level Security (RLS)
-- ============================================================================

ALTER TABLE email_ingestion ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own email ingestions" ON email_ingestion
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access to email ingestion" ON email_ingestion
  FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- ============================================================================
-- Rate Limiting for Email Senders
-- ============================================================================

CREATE TABLE IF NOT EXISTS email_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_email VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_count INTEGER DEFAULT 1,
  window_start TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sender_email, user_id)
);

CREATE INDEX IF NOT EXISTS idx_email_rate_limits_sender ON email_rate_limits(sender_email);
CREATE INDEX IF NOT EXISTS idx_email_rate_limits_window ON email_rate_limits(window_start);

-- ============================================================================
-- Rate Limit Check Function
-- ============================================================================

CREATE OR REPLACE FUNCTION check_email_rate_limit(
  p_sender_email VARCHAR,
  p_user_id UUID,
  p_max_per_hour INTEGER DEFAULT 10
)
RETURNS BOOLEAN AS $$
DECLARE
  v_count INTEGER;
  v_window_start TIMESTAMPTZ;
BEGIN
  v_window_start := NOW() - INTERVAL '1 hour';

  SELECT email_count INTO v_count
  FROM email_rate_limits
  WHERE sender_email = p_sender_email
    AND user_id = p_user_id
    AND window_start > v_window_start;

  IF v_count IS NULL THEN
    -- New sender, create record
    INSERT INTO email_rate_limits (sender_email, user_id, email_count, window_start)
    VALUES (p_sender_email, p_user_id, 1, NOW())
    ON CONFLICT (sender_email, user_id)
    DO UPDATE SET email_count = 1, window_start = NOW();
    RETURN TRUE;
  ELSIF v_count >= p_max_per_hour THEN
    RETURN FALSE;
  ELSE
    -- Increment count
    UPDATE email_rate_limits
    SET email_count = email_count + 1
    WHERE sender_email = p_sender_email AND user_id = p_user_id;
    RETURN TRUE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
