-- Chat conversations table
CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  model_id TEXT NOT NULL,
  system_prompt TEXT,
  -- Encryption metadata (key is NEVER stored in database)
  encryption_key_hash TEXT NOT NULL,
  is_encrypted BOOLEAN DEFAULT true,
  -- Conversation metadata
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  -- Sharing and collaboration
  is_shared BOOLEAN DEFAULT false,
  share_token TEXT UNIQUE,
  -- Soft delete
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat messages table (content is encrypted)
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  -- Encrypted content (stored as base64 encrypted string)
  encrypted_content TEXT NOT NULL,
  -- Metadata (NOT encrypted, for indexing)
  token_count INTEGER,
  model_used TEXT,
  finish_reason TEXT,
  -- Attachments reference
  has_attachments BOOLEAN DEFAULT false,
  -- Usage tracking
  credits_used DECIMAL(10, 4),
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat attachments table
CREATE TABLE chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES chat_messages(id) ON DELETE CASCADE,
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  storage_path TEXT NOT NULL,
  -- Encrypted preview/content for RAG
  encrypted_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat shared conversations (for team collaboration)
CREATE TABLE chat_shared_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES chat_conversations(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  shared_by_user_id UUID REFERENCES auth.users(id),
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'comment', 'edit')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, shared_with_user_id)
);

-- Chat integration credentials (encrypted OAuth tokens)
CREATE TABLE chat_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  integration_type TEXT NOT NULL,
  integration_name TEXT NOT NULL,
  -- Encrypted OAuth tokens
  encrypted_access_token TEXT NOT NULL,
  encrypted_refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  -- Integration-specific metadata
  metadata JSONB DEFAULT '{}'::JSONB,
  is_active BOOLEAN DEFAULT true,
  last_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, integration_type, integration_name)
);

-- Chat integration data (cached data from integrations)
CREATE TABLE chat_integration_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID REFERENCES chat_integrations(id) ON DELETE CASCADE NOT NULL,
  data_type TEXT NOT NULL,
  external_id TEXT NOT NULL,
  title TEXT,
  encrypted_content TEXT,
  snippet TEXT,
  metadata JSONB DEFAULT '{}'::JSONB,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(integration_id, data_type, external_id)
);

-- Indexes for performance
CREATE INDEX idx_chat_conv_org ON chat_conversations(organization_id);
CREATE INDEX idx_chat_conv_user ON chat_conversations(user_id);
CREATE INDEX idx_chat_conv_created ON chat_conversations(created_at DESC);
CREATE INDEX idx_chat_conv_deleted ON chat_conversations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_chat_messages_conv ON chat_messages(conversation_id);
CREATE INDEX idx_chat_messages_created ON chat_messages(created_at);
CREATE INDEX idx_chat_attachments_msg ON chat_attachments(message_id);
CREATE INDEX idx_chat_attachments_conv ON chat_attachments(conversation_id);
CREATE INDEX idx_chat_integrations_user ON chat_integrations(user_id);
CREATE INDEX idx_chat_integrations_org ON chat_integrations(organization_id);
CREATE INDEX idx_chat_integration_data_type ON chat_integration_data(data_type);
CREATE INDEX idx_chat_integration_data_int ON chat_integration_data(integration_id);

-- Enable realtime for chat tables
ALTER TABLE chat_conversations REPLICA IDENTITY FULL;
ALTER TABLE chat_messages REPLICA IDENTITY FULL;
ALTER TABLE chat_shared_conversations REPLICA IDENTITY FULL;

-- RLS Policies for chat_conversations
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_own_conversations" ON chat_conversations
  FOR SELECT USING (
    user_id = auth.uid() OR
    id IN (
      SELECT conversation_id FROM chat_shared_conversations
      WHERE shared_with_user_id = auth.uid()
    )
  );

CREATE POLICY "create_own_conversations" ON chat_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own_conversations" ON chat_conversations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "delete_own_conversations" ON chat_conversations
  FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for chat_messages
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_messages_of_accessible_conversations" ON chat_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM chat_conversations
      WHERE user_id = auth.uid() OR
      id IN (
        SELECT conversation_id FROM chat_shared_conversations
        WHERE shared_with_user_id = auth.uid()
      )
    )
  );

CREATE POLICY "insert_messages_into_own_conversations" ON chat_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM chat_conversations
      WHERE user_id = auth.uid()
    )
  );

-- RLS for chat_attachments
ALTER TABLE chat_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_own_attachments" ON chat_attachments
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM chat_conversations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "insert_own_attachments" ON chat_attachments
  FOR INSERT WITH CHECK (
    conversation_id IN (
      SELECT id FROM chat_conversations
      WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "delete_own_attachments" ON chat_attachments
  FOR DELETE USING (
    conversation_id IN (
      SELECT id FROM chat_conversations
      WHERE user_id = auth.uid()
    )
  );

-- RLS for chat_shared_conversations
ALTER TABLE chat_shared_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_shared_conversations" ON chat_shared_conversations
  FOR SELECT USING (
    shared_with_user_id = auth.uid() OR
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "manage_own_shared_conversations" ON chat_shared_conversations
  FOR ALL USING (
    conversation_id IN (
      SELECT id FROM chat_conversations WHERE user_id = auth.uid()
    )
  );

-- RLS for chat_integrations
ALTER TABLE chat_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "manage_own_integrations" ON chat_integrations
  FOR ALL USING (user_id = auth.uid());

-- RLS for chat_integration_data
ALTER TABLE chat_integration_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view_own_integration_data" ON chat_integration_data
  FOR SELECT USING (
    integration_id IN (
      SELECT id FROM chat_integrations WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "manage_own_integration_data" ON chat_integration_data
  FOR ALL USING (
    integration_id IN (
      SELECT id FROM chat_integrations WHERE user_id = auth.uid()
    )
  );

-- Function to update conversation stats
CREATE OR REPLACE FUNCTION update_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE chat_conversations
  SET 
    message_count = (
      SELECT COUNT(*) FROM chat_messages 
      WHERE conversation_id = NEW.conversation_id
    ),
    last_message_at = NOW(),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_conversation_stats_trigger
AFTER INSERT ON chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_conversation_stats();

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_chat_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_chat_conversations_updated_at
BEFORE UPDATE ON chat_conversations
FOR EACH ROW
EXECUTE FUNCTION update_chat_updated_at();

CREATE TRIGGER update_chat_integrations_updated_at
BEFORE UPDATE ON chat_integrations
FOR EACH ROW
EXECUTE FUNCTION update_chat_updated_at();