-- Drop existing policies with recursion issues
DROP POLICY IF EXISTS "view_own_vault_chat_conversations" ON vault_chat_conversations;
DROP POLICY IF EXISTS "view_vault_chat_messages_of_accessible_conversations" ON vault_chat_messages;
DROP POLICY IF EXISTS "view_vault_chat_shared_conversations" ON vault_chat_shared_conversations;
DROP POLICY IF EXISTS "manage_own_shared_conversations" ON vault_chat_shared_conversations;

-- Recreate conversation policies without recursion
CREATE POLICY "view_own_conversations" ON vault_chat_conversations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "view_shared_conversations" ON vault_chat_conversations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vault_chat_shared_conversations 
      WHERE vault_chat_shared_conversations.conversation_id = vault_chat_conversations.id 
      AND vault_chat_shared_conversations.shared_with_user_id = auth.uid()
    )
  );

-- Messages: simple check against conversation ownership
CREATE POLICY "view_own_messages" ON vault_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vault_chat_conversations 
      WHERE vault_chat_conversations.id = vault_chat_messages.conversation_id 
      AND vault_chat_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "view_shared_messages" ON vault_chat_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM vault_chat_shared_conversations 
      WHERE vault_chat_shared_conversations.conversation_id = vault_chat_messages.conversation_id 
      AND vault_chat_shared_conversations.shared_with_user_id = auth.uid()
    )
  );

-- Shared conversations: separate policies to avoid recursion
CREATE POLICY "view_own_shared_conversations" ON vault_chat_shared_conversations
  FOR SELECT USING (shared_with_user_id = auth.uid() OR shared_by_user_id = auth.uid());

CREATE POLICY "manage_own_shared_conversations" ON vault_chat_shared_conversations
  FOR ALL USING (shared_by_user_id = auth.uid());