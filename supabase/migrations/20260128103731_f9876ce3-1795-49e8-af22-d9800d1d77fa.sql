-- Block anonymous access to vault_chat_conversations table
-- This table contains conversation metadata that could reveal communication patterns

-- Revoke all permissions from anon role
REVOKE ALL ON public.vault_chat_conversations FROM anon;

-- Drop any overly permissive policies
DROP POLICY IF EXISTS "anon_read_vault_chat_conversations" ON public.vault_chat_conversations;
DROP POLICY IF EXISTS "public_read_vault_chat_conversations" ON public.vault_chat_conversations;

-- Create explicit deny policy for anon (belt and suspenders approach)
CREATE POLICY "Deny anonymous access to vault conversations"
ON public.vault_chat_conversations
FOR ALL
TO anon
USING (false)
WITH CHECK (false);