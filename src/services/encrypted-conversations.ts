/**
 * Encrypted Conversations Service
 * Handles all Supabase operations for encrypted conversations.
 * Note: Decryption happens client-side in hooks, not here.
 */

import { supabase } from '@/integrations/supabase/client';
import type { EncryptedConversation, EncryptedMessage, ConversationKey } from '@/types/encryption';

/**
 * Create a new encrypted conversation
 */
export async function createEncryptedConversation(params: {
  encryptedTitle: string;
  titleNonce: string;
  keyHash: string;
  modelId?: string;
  zeroRetention?: boolean;
}): Promise<EncryptedConversation> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('encrypted_conversations')
    .insert({
      user_id: user.id,
      encrypted_title: params.encryptedTitle,
      title_nonce: params.titleNonce,
      key_hash: params.keyHash,
      model_id: params.modelId || 'claude-3-5-sonnet-20241022',
      zero_retention: params.zeroRetention || false,
      is_encrypted: true
    })
    .select()
    .single();
  
  if (error) throw error;
  return mapConversation(data);
}

/**
 * Get user's encrypted conversations
 */
export async function getEncryptedConversations(): Promise<EncryptedConversation[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('encrypted_conversations')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });
  
  if (error) throw error;
  return (data || []).map(mapConversation);
}

/**
 * Get single conversation
 */
export async function getEncryptedConversation(id: string): Promise<EncryptedConversation | null> {
  const { data, error } = await supabase
    .from('encrypted_conversations')
    .select('*')
    .eq('id', id)
    .single();
  
  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  
  return mapConversation(data);
}

/**
 * Update conversation
 */
export async function updateEncryptedConversation(
  id: string,
  updates: Partial<{
    encryptedTitle: string;
    titleNonce: string;
    modelId: string;
    zeroRetention: boolean;
  }>
): Promise<void> {
  const updateData: Record<string, any> = {
    updated_at: new Date().toISOString()
  };
  
  if (updates.encryptedTitle !== undefined) {
    updateData.encrypted_title = updates.encryptedTitle;
  }
  if (updates.titleNonce !== undefined) {
    updateData.title_nonce = updates.titleNonce;
  }
  if (updates.modelId !== undefined) {
    updateData.model_id = updates.modelId;
  }
  if (updates.zeroRetention !== undefined) {
    updateData.zero_retention = updates.zeroRetention;
  }
  
  const { error } = await supabase
    .from('encrypted_conversations')
    .update(updateData)
    .eq('id', id);
  
  if (error) throw error;
}

/**
 * Delete conversation
 */
export async function deleteEncryptedConversation(id: string): Promise<void> {
  const { error } = await supabase
    .from('encrypted_conversations')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

// ==========================================
// Conversation Keys
// ==========================================

/**
 * Store wrapped conversation key
 */
export async function storeConversationKeyInDB(params: {
  conversationId: string;
  wrappedKey: string;
  nonce: string;
  keyVersion?: number;
}): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { error } = await supabase
    .from('conversation_keys')
    .upsert({
      conversation_id: params.conversationId,
      user_id: user.id,
      wrapped_key: params.wrappedKey,
      wrapping_nonce: params.nonce,
      key_version: params.keyVersion || 1
    }, {
      onConflict: 'conversation_id,user_id,key_version'
    });
  
  if (error) throw error;
}

/**
 * Get wrapped conversation key
 */
export async function getConversationKeyFromDB(conversationId: string): Promise<ConversationKey | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  
  const { data, error } = await supabase
    .from('conversation_keys')
    .select('*')
    .eq('conversation_id', conversationId)
    .eq('user_id', user.id)
    .order('key_version', { ascending: false })
    .limit(1)
    .maybeSingle();
  
  if (error) throw error;
  if (!data) return null;
  
  return {
    conversationId: data.conversation_id,
    wrappedKey: data.wrapped_key,
    nonce: data.wrapping_nonce,
    keyVersion: data.key_version,
    createdAt: data.created_at
  };
}

// ==========================================
// Messages
// ==========================================

/**
 * Insert encrypted message
 */
export async function insertEncryptedMessage(params: {
  conversationId: string;
  ciphertext: string;
  nonce: string;
  role: 'user' | 'assistant' | 'system';
  tokenCount?: number;
}): Promise<EncryptedMessage> {
  // Get next sequence number
  const { data: seqData } = await supabase.rpc('get_next_sequence_number', {
    p_conversation_id: params.conversationId
  });
  
  const { data, error } = await supabase
    .from('encrypted_messages')
    .insert({
      conversation_id: params.conversationId,
      ciphertext: params.ciphertext,
      nonce: params.nonce,
      role: params.role,
      sequence_number: seqData || 1,
      token_count: params.tokenCount
    })
    .select()
    .single();
  
  if (error) throw error;
  return mapMessage(data);
}

/**
 * Get messages for conversation
 */
export async function getEncryptedMessages(conversationId: string): Promise<EncryptedMessage[]> {
  const { data, error } = await supabase
    .from('encrypted_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('sequence_number', { ascending: true });
  
  if (error) throw error;
  return (data || []).map(mapMessage);
}

// ==========================================
// Real-time Subscriptions
// ==========================================

/**
 * Subscribe to new messages in a conversation
 */
export function subscribeToMessages(
  conversationId: string,
  onMessage: (message: EncryptedMessage) => void
) {
  return supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'encrypted_messages',
        filter: `conversation_id=eq.${conversationId}`
      },
      (payload) => {
        onMessage(mapMessage(payload.new));
      }
    )
    .subscribe();
}

/**
 * Subscribe to conversation updates
 */
export function subscribeToConversations(
  userId: string,
  onUpdate: (conversation: EncryptedConversation) => void,
  onDelete: (id: string) => void
) {
  return supabase
    .channel(`conversations:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'encrypted_conversations',
        filter: `user_id=eq.${userId}`
      },
      (payload) => {
        if (payload.eventType === 'DELETE') {
          onDelete((payload.old as any).id);
        } else {
          onUpdate(mapConversation(payload.new));
        }
      }
    )
    .subscribe();
}

// ==========================================
// Mappers
// ==========================================

function mapConversation(data: any): EncryptedConversation {
  return {
    id: data.id,
    userId: data.user_id,
    organizationId: data.organization_id,
    encryptedTitle: data.encrypted_title,
    titleNonce: data.title_nonce,
    keyVersion: data.key_version,
    keyHash: data.key_hash,
    modelId: data.model_id,
    isEncrypted: data.is_encrypted,
    zeroRetention: data.zero_retention,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    lastMessageAt: data.last_message_at
  };
}

function mapMessage(data: any): EncryptedMessage {
  return {
    id: data.id,
    conversationId: data.conversation_id,
    ciphertext: data.ciphertext,
    nonce: data.nonce,
    role: data.role,
    sequenceNumber: data.sequence_number,
    tokenCount: data.token_count,
    hasAttachments: data.has_attachments || false,
    createdAt: data.created_at
  };
}
