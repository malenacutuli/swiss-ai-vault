-- ============================================
-- ZEROTRACE SCHEMA MIGRATION
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- 1. Encrypted Conversations
-- ============================================
CREATE TABLE encrypted_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  
  -- Encrypted metadata (title, etc.)
  encrypted_title TEXT,
  title_nonce TEXT NOT NULL,
  
  -- Key management
  key_version INTEGER DEFAULT 1,
  key_hash TEXT NOT NULL,
  
  -- Settings
  model_id TEXT NOT NULL DEFAULT 'claude-3-5-sonnet-20241022',
  is_encrypted BOOLEAN DEFAULT true,
  zero_retention BOOLEAN DEFAULT false,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_message_at TIMESTAMPTZ,
  
  CONSTRAINT encrypted_conversations_key_hash_check CHECK (length(key_hash) = 64)
);

CREATE INDEX idx_enc_conv_user ON encrypted_conversations(user_id);
CREATE INDEX idx_enc_conv_org ON encrypted_conversations(organization_id);
CREATE INDEX idx_enc_conv_updated ON encrypted_conversations(updated_at DESC);

-- ============================================
-- 2. Conversation Keys (wrapped CEKs)
-- ============================================
CREATE TABLE conversation_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES encrypted_conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  
  wrapped_key TEXT NOT NULL,
  wrapping_nonce TEXT NOT NULL,
  
  key_version INTEGER DEFAULT 1,
  algorithm TEXT DEFAULT 'AES-256-GCM',
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  rotated_at TIMESTAMPTZ,
  
  UNIQUE(conversation_id, user_id, key_version)
);

CREATE INDEX idx_conv_keys_conv ON conversation_keys(conversation_id);
CREATE INDEX idx_conv_keys_user ON conversation_keys(user_id);

-- ============================================
-- 3. Encrypted Messages
-- ============================================
CREATE TABLE encrypted_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID NOT NULL REFERENCES encrypted_conversations(id) ON DELETE CASCADE,
  
  ciphertext TEXT NOT NULL,
  nonce TEXT NOT NULL,
  
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  sequence_number INTEGER NOT NULL,
  
  token_count INTEGER,
  has_attachments BOOLEAN DEFAULT false,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(conversation_id, sequence_number)
);

CREATE INDEX idx_enc_msg_conv ON encrypted_messages(conversation_id);
CREATE INDEX idx_enc_msg_conv_seq ON encrypted_messages(conversation_id, sequence_number);

-- ============================================
-- 4. Encrypted Documents (for RAG)
-- ============================================
CREATE TABLE encrypted_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES encrypted_conversations(id) ON DELETE SET NULL,
  
  encrypted_filename TEXT NOT NULL,
  filename_nonce TEXT NOT NULL,
  
  file_type TEXT NOT NULL,
  file_size BIGINT,
  chunk_count INTEGER DEFAULT 0,
  
  key_version INTEGER DEFAULT 1,
  
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'ready', 'error')),
  error_message TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_enc_docs_user ON encrypted_documents(user_id);
CREATE INDEX idx_enc_docs_conv ON encrypted_documents(conversation_id);

-- ============================================
-- 5. Encrypted Document Chunks (for RAG)
-- ============================================
CREATE TABLE encrypted_document_chunks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES encrypted_documents(id) ON DELETE CASCADE,
  
  encrypted_content TEXT NOT NULL,
  content_nonce TEXT NOT NULL,
  
  chunk_index INTEGER NOT NULL,
  
  encrypted_embedding TEXT,
  embedding_nonce TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(document_id, chunk_index)
);

CREATE INDEX idx_enc_chunks_doc ON encrypted_document_chunks(document_id);

-- ============================================
-- 6. User Encryption Settings
-- ============================================
CREATE TABLE user_encryption_settings (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  
  kdf_salt TEXT NOT NULL,
  kdf_iterations INTEGER DEFAULT 100000,
  kdf_memory INTEGER DEFAULT 65536,
  
  key_verification_hash TEXT,
  
  zero_retention_default BOOLEAN DEFAULT false,
  auto_lock_minutes INTEGER DEFAULT 15,
  
  recovery_key_hash TEXT,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- 7. RLS Policies
-- ============================================

ALTER TABLE encrypted_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE encrypted_document_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_encryption_settings ENABLE ROW LEVEL SECURITY;

-- Conversations policies
CREATE POLICY "Users can view own encrypted conversations"
  ON encrypted_conversations FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own encrypted conversations"
  ON encrypted_conversations FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own encrypted conversations"
  ON encrypted_conversations FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own encrypted conversations"
  ON encrypted_conversations FOR DELETE
  USING (user_id = auth.uid());

-- Conversation Keys policies
CREATE POLICY "Users can view own conversation keys"
  ON conversation_keys FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own conversation keys"
  ON conversation_keys FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Messages policies
CREATE POLICY "Users can view messages in own conversations"
  ON encrypted_messages FOR SELECT
  USING (
    conversation_id IN (
      SELECT id FROM encrypted_conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert messages in own conversations"
  ON encrypted_messages FOR INSERT
  WITH CHECK (
    conversation_id IN (
      SELECT id FROM encrypted_conversations WHERE user_id = auth.uid()
    )
  );

-- Documents policies
CREATE POLICY "Users can manage own encrypted documents"
  ON encrypted_documents FOR ALL
  USING (user_id = auth.uid());

-- Document Chunks policies
CREATE POLICY "Users can view chunks of own documents"
  ON encrypted_document_chunks FOR SELECT
  USING (
    document_id IN (
      SELECT id FROM encrypted_documents WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert chunks for own documents"
  ON encrypted_document_chunks FOR INSERT
  WITH CHECK (
    document_id IN (
      SELECT id FROM encrypted_documents WHERE user_id = auth.uid()
    )
  );

-- Encryption Settings policies
CREATE POLICY "Users can manage own encryption settings"
  ON user_encryption_settings FOR ALL
  USING (user_id = auth.uid());

-- ============================================
-- 8. Functions
-- ============================================

CREATE OR REPLACE FUNCTION get_next_sequence_number(p_conversation_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_next INTEGER;
BEGIN
  SELECT COALESCE(MAX(sequence_number), 0) + 1 INTO v_next
  FROM encrypted_messages
  WHERE conversation_id = p_conversation_id;
  RETURN v_next;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION update_encrypted_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE encrypted_conversations
  SET last_message_at = NOW(), updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_update_enc_conv_timestamp
  AFTER INSERT ON encrypted_messages
  FOR EACH ROW
  EXECUTE FUNCTION update_encrypted_conversation_timestamp();