-- Vault Chat conversations
CREATE TABLE vault_chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT 'New Conversation',
  model_id TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  system_prompt TEXT,
  encryption_key_hash TEXT NOT NULL,
  is_encrypted BOOLEAN DEFAULT true,
  message_count INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  is_shared BOOLEAN DEFAULT false,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vault Chat messages (content is encrypted)
CREATE TABLE vault_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES vault_chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  encrypted_content TEXT NOT NULL,
  token_count INTEGER,
  model_used TEXT,
  finish_reason TEXT,
  credits_used DECIMAL(10, 4),
  latency_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Vault Chat shared conversations
CREATE TABLE vault_chat_shared_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES vault_chat_conversations(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL,
  shared_by_user_id UUID,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'comment', 'edit')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(conversation_id, shared_with_user_id)
);

-- Indexes
CREATE INDEX idx_vault_chat_conv_org ON vault_chat_conversations(organization_id);
CREATE INDEX idx_vault_chat_conv_user ON vault_chat_conversations(user_id);
CREATE INDEX idx_vault_chat_conv_created ON vault_chat_conversations(created_at DESC);
CREATE INDEX idx_vault_chat_conv_deleted ON vault_chat_conversations(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX idx_vault_chat_messages_conv ON vault_chat_messages(conversation_id);
CREATE INDEX idx_vault_chat_messages_created ON vault_chat_messages(created_at);

-- Realtime
ALTER TABLE vault_chat_conversations REPLICA IDENTITY FULL;
ALTER TABLE vault_chat_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE vault_chat_conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE vault_chat_messages;

-- RLS Policies
ALTER TABLE vault_chat_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE vault_chat_shared_conversations ENABLE ROW LEVEL SECURITY;

-- Conversations: View own or shared
CREATE POLICY "view_own_vault_chat_conversations" ON vault_chat_conversations
  FOR SELECT USING (
    user_id = auth.uid() OR
    id IN (SELECT conversation_id FROM vault_chat_shared_conversations WHERE shared_with_user_id = auth.uid())
  );

CREATE POLICY "create_own_vault_chat_conversations" ON vault_chat_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "update_own_vault_chat_conversations" ON vault_chat_conversations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "delete_own_vault_chat_conversations" ON vault_chat_conversations
  FOR DELETE USING (user_id = auth.uid());

-- Messages: View messages of accessible conversations
CREATE POLICY "view_vault_chat_messages_of_accessible_conversations" ON vault_chat_messages
  FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM vault_chat_conversations
      WHERE user_id = auth.uid() OR
      id IN (SELECT conversation_id FROM vault_chat_shared_conversations WHERE shared_with_user_id = auth.uid())
    )
  );

CREATE POLICY "insert_vault_chat_messages_into_own_conversations" ON vault_chat_messages
  FOR INSERT WITH CHECK (
    conversation_id IN (SELECT id FROM vault_chat_conversations WHERE user_id = auth.uid())
  );

-- Shared conversations: View if you're the sharer or sharee
CREATE POLICY "view_vault_chat_shared_conversations" ON vault_chat_shared_conversations
  FOR SELECT USING (
    shared_with_user_id = auth.uid() OR
    conversation_id IN (SELECT id FROM vault_chat_conversations WHERE user_id = auth.uid())
  );

CREATE POLICY "manage_vault_chat_shared_conversations" ON vault_chat_shared_conversations
  FOR ALL USING (
    conversation_id IN (SELECT id FROM vault_chat_conversations WHERE user_id = auth.uid())
  );

-- Trigger to update conversation stats
CREATE OR REPLACE FUNCTION update_vault_chat_conversation_stats()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE vault_chat_conversations
  SET 
    message_count = (SELECT COUNT(*) FROM vault_chat_messages WHERE conversation_id = NEW.conversation_id),
    last_message_at = NOW(),
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER update_vault_chat_conversation_stats_trigger
AFTER INSERT ON vault_chat_messages
FOR EACH ROW
EXECUTE FUNCTION update_vault_chat_conversation_stats();