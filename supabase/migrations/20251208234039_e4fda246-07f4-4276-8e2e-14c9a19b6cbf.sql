-- Add DELETE policy for chat_messages table
-- Users can delete messages from conversations they own
CREATE POLICY "delete_messages_from_own_conversations"
ON public.chat_messages
FOR DELETE
TO authenticated
USING (
  conversation_id IN (
    SELECT id FROM public.chat_conversations
    WHERE user_id = auth.uid()
  )
);