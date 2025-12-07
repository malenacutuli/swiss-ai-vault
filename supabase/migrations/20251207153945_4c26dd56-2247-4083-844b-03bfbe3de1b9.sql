-- Drop all existing vault_chat policies to start fresh
DROP POLICY IF EXISTS "view_own_conversations" ON vault_chat_conversations;
DROP POLICY IF EXISTS "view_shared_conversations" ON vault_chat_conversations;
DROP POLICY IF EXISTS "insert_own_conversations" ON vault_chat_conversations;
DROP POLICY IF EXISTS "update_own_conversations" ON vault_chat_conversations;
DROP POLICY IF EXISTS "delete_own_conversations" ON vault_chat_conversations;
DROP POLICY IF EXISTS "view_own_messages" ON vault_chat_messages;
DROP POLICY IF EXISTS "view_shared_messages" ON vault_chat_messages;
DROP POLICY IF EXISTS "insert_own_messages" ON vault_chat_messages;
DROP POLICY IF EXISTS "view_own_shared_conversations" ON vault_chat_shared_conversations;
DROP POLICY IF EXISTS "manage_own_shared_conversations" ON vault_chat_shared_conversations;

-- Create simple non-recursive policies for vault_chat_conversations
CREATE POLICY "users_select_own_vault_conversations" ON vault_chat_conversations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_vault_conversations" ON vault_chat_conversations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_vault_conversations" ON vault_chat_conversations
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "users_delete_own_vault_conversations" ON vault_chat_conversations
  FOR DELETE USING (user_id = auth.uid());

-- Create simple policy for vault_chat_messages (using security definer function)
CREATE OR REPLACE FUNCTION public.user_owns_vault_conversation(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM vault_chat_conversations
    WHERE id = p_conversation_id AND user_id = auth.uid()
  )
$$;

CREATE POLICY "users_select_own_vault_messages" ON vault_chat_messages
  FOR SELECT USING (public.user_owns_vault_conversation(conversation_id));

CREATE POLICY "users_insert_own_vault_messages" ON vault_chat_messages
  FOR INSERT WITH CHECK (public.user_owns_vault_conversation(conversation_id));

CREATE POLICY "users_update_own_vault_messages" ON vault_chat_messages
  FOR UPDATE USING (public.user_owns_vault_conversation(conversation_id));

CREATE POLICY "users_delete_own_vault_messages" ON vault_chat_messages
  FOR DELETE USING (public.user_owns_vault_conversation(conversation_id));

-- Simple policies for vault_chat_shared_conversations
CREATE POLICY "users_select_vault_shared" ON vault_chat_shared_conversations
  FOR SELECT USING (shared_with_user_id = auth.uid() OR shared_by_user_id = auth.uid());

CREATE POLICY "users_manage_vault_shared" ON vault_chat_shared_conversations
  FOR ALL USING (shared_by_user_id = auth.uid());