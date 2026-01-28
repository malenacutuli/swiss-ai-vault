-- Fix chat_messages and chat_conversations security
-- Tighten policies to use authenticated role and add explicit restrictions

-- =====================================================
-- 1. Fix chat_conversations policies - use authenticated role
-- =====================================================
DROP POLICY IF EXISTS "view_own_conversations" ON public.chat_conversations;
CREATE POLICY "view_own_conversations"
ON public.chat_conversations
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid() 
  OR id IN (
    SELECT conversation_id FROM chat_shared_conversations 
    WHERE shared_with_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "create_own_conversations" ON public.chat_conversations;
CREATE POLICY "create_own_conversations"
ON public.chat_conversations
FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "update_own_conversations" ON public.chat_conversations;
CREATE POLICY "update_own_conversations"
ON public.chat_conversations
FOR UPDATE
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "delete_own_conversations" ON public.chat_conversations;
CREATE POLICY "delete_own_conversations"
ON public.chat_conversations
FOR DELETE
TO authenticated
USING (user_id = auth.uid());

-- =====================================================
-- 2. Fix chat_messages policies - use authenticated role
-- =====================================================
DROP POLICY IF EXISTS "view_messages_of_accessible_conversations" ON public.chat_messages;
CREATE POLICY "view_messages_of_accessible_conversations"
ON public.chat_messages
FOR SELECT
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM chat_conversations 
    WHERE user_id = auth.uid()
  )
  OR conversation_id IN (
    SELECT conversation_id FROM chat_shared_conversations 
    WHERE shared_with_user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "insert_messages_into_own_conversations" ON public.chat_messages;
CREATE POLICY "insert_messages_into_own_conversations"
ON public.chat_messages
FOR INSERT
TO authenticated
WITH CHECK (
  conversation_id IN (
    SELECT id FROM chat_conversations 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "delete_messages_from_own_conversations" ON public.chat_messages;
CREATE POLICY "delete_messages_from_own_conversations"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM chat_conversations 
    WHERE user_id = auth.uid()
  )
);

-- =====================================================
-- 3. Fix chat_shared_conversations policies
-- =====================================================
DROP POLICY IF EXISTS "manage_own_shared_conversations" ON public.chat_shared_conversations;
CREATE POLICY "owners_can_manage_shares"
ON public.chat_shared_conversations
FOR ALL
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM chat_conversations 
    WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  conversation_id IN (
    SELECT id FROM chat_conversations 
    WHERE user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "view_shared_conversations" ON public.chat_shared_conversations;
CREATE POLICY "view_shared_conversations"
ON public.chat_shared_conversations
FOR SELECT
TO authenticated
USING (
  shared_with_user_id = auth.uid()
  OR conversation_id IN (
    SELECT id FROM chat_conversations 
    WHERE user_id = auth.uid()
  )
);