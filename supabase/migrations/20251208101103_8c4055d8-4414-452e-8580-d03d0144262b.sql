-- Add retention columns to encrypted_conversations
ALTER TABLE encrypted_conversations 
ADD COLUMN IF NOT EXISTS retention_mode TEXT DEFAULT 'forever'
  CHECK (retention_mode IN ('zerotrace', '1day', '1week', '90days', 'forever'));

ALTER TABLE encrypted_conversations 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Add expires_at to encrypted_messages for individual message expiry
ALTER TABLE encrypted_messages 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;

-- Create function to set message expiry based on retention mode
CREATE OR REPLACE FUNCTION set_message_expiry()
RETURNS TRIGGER AS $$
BEGIN
  -- Get retention mode from conversation
  SELECT 
    CASE retention_mode
      WHEN 'zerotrace' THEN NULL -- Don't store
      WHEN '1day' THEN NOW() + INTERVAL '1 day'
      WHEN '1week' THEN NOW() + INTERVAL '7 days'
      WHEN '90days' THEN NOW() + INTERVAL '90 days'
      WHEN 'forever' THEN NULL
    END INTO NEW.expires_at
  FROM encrypted_conversations
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for auto-setting expiry
DROP TRIGGER IF EXISTS trigger_set_message_expiry ON encrypted_messages;
CREATE TRIGGER trigger_set_message_expiry
  BEFORE INSERT ON encrypted_messages
  FOR EACH ROW
  EXECUTE FUNCTION set_message_expiry();

-- Create cleanup function for expired messages (run via cron)
CREATE OR REPLACE FUNCTION cleanup_expired_messages()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  DELETE FROM encrypted_messages 
  WHERE expires_at IS NOT NULL 
  AND expires_at < NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;