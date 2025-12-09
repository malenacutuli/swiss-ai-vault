import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { localChatStorage, LocalConversation, LocalMessage } from '@/lib/storage/local-chat-storage';

interface CreateConversationParams {
  id: string;
  encrypted_title: string;
  title_nonce: string;
  model_id: string;
  key_hash: string;
  retention_days?: number | null;
}

interface SaveMessageParams {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  encrypted_content: string;
  nonce: string;
  sequence_number: number;
}

export interface StorageConversation {
  id: string;
  encrypted_title: string | null;
  title_nonce: string;
  model_id: string;
  created_at: string | null;
  updated_at: string | null;
  last_message_at: string | null;
  is_zero_trace: boolean;
}

export interface StorageMessage {
  id: string;
  conversation_id: string;
  role: string;
  ciphertext: string;
  nonce: string;
  sequence_number: number;
  created_at: string | null;
}

interface StorageMode {
  isZeroTrace: boolean;
  isLoading: boolean;
  
  // Conversation operations (route to correct backend)
  createConversation: (data: CreateConversationParams) => Promise<string>;
  loadConversations: () => Promise<StorageConversation[]>;
  deleteConversation: (id: string) => Promise<void>;
  updateConversationTitle: (id: string, encryptedTitle: string, nonce: string) => Promise<void>;
  
  // Message operations
  saveMessage: (msg: SaveMessageParams) => Promise<string>;
  loadMessages: (conversationId: string) => Promise<StorageMessage[]>;
  getNextSequenceNumber: (conversationId: string) => Promise<number>;
  
  // Export (only available in ZeroTrace mode)
  exportConversation: (conversationId: string, wrappedKey: { ciphertext: string; nonce: string }) => Promise<Blob | null>;
  importConversation: (file: File) => Promise<string | null>;
  
  // Toggle mode (for testing/settings)
  refreshMode: () => Promise<void>;
}

export function useStorageMode(): StorageMode {
  const [isZeroTrace, setIsZeroTrace] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load user's zero_retention_mode setting
  const loadSetting = useCallback(async () => {
    console.log('[useStorageMode] Loading zero_retention_mode setting...');
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('[useStorageMode] No user found, defaulting to server mode');
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_settings')
        .select('zero_retention_mode')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('[useStorageMode] Error loading setting:', error);
      }

      const zeroTrace = data?.zero_retention_mode ?? false;
      console.log('[useStorageMode] zero_retention_mode =', zeroTrace);
      setIsZeroTrace(zeroTrace);
      
      // Initialize local storage if in zero trace mode
      if (zeroTrace) {
        await localChatStorage.init();
        console.log('[useStorageMode] LocalChatStorage initialized');
      }
    } catch (err) {
      console.error('[useStorageMode] Failed to load setting:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSetting();

    // Subscribe to setting changes
    const setupSubscription = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel('user-settings-changes')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'user_settings',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('[useStorageMode] Settings changed:', payload.new);
            const newZeroTrace = (payload.new as any).zero_retention_mode ?? false;
            setIsZeroTrace(newZeroTrace);
            
            if (newZeroTrace) {
              localChatStorage.init();
            }
          }
        )
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    };

    setupSubscription();
  }, [loadSetting]);

  // ============ CONVERSATION OPERATIONS ============

  const createConversation = useCallback(async (data: CreateConversationParams): Promise<string> => {
    console.log('[useStorageMode] createConversation, isZeroTrace =', isZeroTrace);
    
    if (isZeroTrace) {
      // Store locally only
      const localConv: LocalConversation = {
        id: data.id,
        encrypted_title: data.encrypted_title,
        title_nonce: data.title_nonce,
        model_id: data.model_id,
        retention_days: data.retention_days ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        message_count: 0
      };
      
      await localChatStorage.createConversation(localConv);
      console.log('[useStorageMode] Conversation created in IndexedDB:', data.id);
      return data.id;
    } else {
      // Store on server
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No authenticated user');

      const { error } = await supabase
        .from('encrypted_conversations')
        .insert({
          id: data.id,
          user_id: user.id,
          encrypted_title: data.encrypted_title,
          title_nonce: data.title_nonce,
          model_id: data.model_id,
          key_hash: data.key_hash,
          zero_retention: false
        });

      if (error) throw error;
      console.log('[useStorageMode] Conversation created on server:', data.id);
      return data.id;
    }
  }, [isZeroTrace]);

  const loadConversations = useCallback(async (): Promise<StorageConversation[]> => {
    console.log('[useStorageMode] loadConversations, isZeroTrace =', isZeroTrace);
    
    if (isZeroTrace) {
      // Load from IndexedDB
      const localConvs = await localChatStorage.listConversations();
      return localConvs.map(conv => ({
        id: conv.id,
        encrypted_title: conv.encrypted_title,
        title_nonce: conv.title_nonce,
        model_id: conv.model_id,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        last_message_at: conv.updated_at,
        is_zero_trace: true
      }));
    } else {
      // Load from server
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('encrypted_conversations')
        .select('*')
        .eq('user_id', user.id)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      return (data || []).map(conv => ({
        id: conv.id,
        encrypted_title: conv.encrypted_title,
        title_nonce: conv.title_nonce,
        model_id: conv.model_id,
        created_at: conv.created_at,
        updated_at: conv.updated_at,
        last_message_at: conv.last_message_at,
        is_zero_trace: conv.zero_retention ?? false
      }));
    }
  }, [isZeroTrace]);

  const deleteConversation = useCallback(async (id: string): Promise<void> => {
    console.log('[useStorageMode] deleteConversation:', id, 'isZeroTrace =', isZeroTrace);
    
    if (isZeroTrace) {
      await localChatStorage.deleteConversation(id);
      console.log('[useStorageMode] Conversation deleted from IndexedDB');
    } else {
      const { error } = await supabase
        .from('encrypted_conversations')
        .delete()
        .eq('id', id);

      if (error) throw error;
      console.log('[useStorageMode] Conversation deleted from server');
    }
  }, [isZeroTrace]);

  const updateConversationTitle = useCallback(async (
    id: string, 
    encryptedTitle: string, 
    nonce: string
  ): Promise<void> => {
    console.log('[useStorageMode] updateConversationTitle:', id);
    
    if (isZeroTrace) {
      await localChatStorage.updateConversation(id, {
        encrypted_title: encryptedTitle,
        title_nonce: nonce,
        updated_at: new Date().toISOString()
      });
    } else {
      const { error } = await supabase
        .from('encrypted_conversations')
        .update({
          encrypted_title: encryptedTitle,
          title_nonce: nonce,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
    }
  }, [isZeroTrace]);

  // ============ MESSAGE OPERATIONS ============

  const saveMessage = useCallback(async (msg: SaveMessageParams): Promise<string> => {
    console.log('[useStorageMode] saveMessage, isZeroTrace =', isZeroTrace);
    
    if (isZeroTrace) {
      // Store locally only
      const localMsg: LocalMessage = {
        id: msg.id,
        conversation_id: msg.conversation_id,
        role: msg.role,
        encrypted_content: msg.encrypted_content,
        nonce: msg.nonce,
        sequence_number: msg.sequence_number,
        created_at: new Date().toISOString()
      };
      
      await localChatStorage.addMessage(localMsg);
      console.log('[useStorageMode] Message saved to IndexedDB');
      return msg.id;
    } else {
      // Store on server
      const { error } = await supabase
        .from('encrypted_messages')
        .insert({
          id: msg.id,
          conversation_id: msg.conversation_id,
          role: msg.role,
          ciphertext: msg.encrypted_content,
          nonce: msg.nonce,
          sequence_number: msg.sequence_number
        });

      if (error) throw error;
      console.log('[useStorageMode] Message saved to server');
      return msg.id;
    }
  }, [isZeroTrace]);

  const loadMessages = useCallback(async (conversationId: string): Promise<StorageMessage[]> => {
    console.log('[useStorageMode] loadMessages for:', conversationId);
    
    if (isZeroTrace) {
      const localMsgs = await localChatStorage.getMessages(conversationId);
      return localMsgs.map(msg => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        role: msg.role,
        ciphertext: msg.encrypted_content,
        nonce: msg.nonce,
        sequence_number: msg.sequence_number,
        created_at: msg.created_at
      }));
    } else {
      const { data, error } = await supabase
        .from('encrypted_messages')
        .select('*')
        .eq('conversation_id', conversationId)
        .order('sequence_number', { ascending: true });

      if (error) throw error;
      return (data || []).map(msg => ({
        id: msg.id,
        conversation_id: msg.conversation_id,
        role: msg.role,
        ciphertext: msg.ciphertext,
        nonce: msg.nonce,
        sequence_number: msg.sequence_number,
        created_at: msg.created_at
      }));
    }
  }, [isZeroTrace]);

  const getNextSequenceNumber = useCallback(async (conversationId: string): Promise<number> => {
    if (isZeroTrace) {
      return await localChatStorage.getNextSequenceNumber(conversationId);
    } else {
      const { data, error } = await supabase
        .rpc('get_next_sequence_number', { p_conversation_id: conversationId });

      if (error) throw error;
      return data ?? 1;
    }
  }, [isZeroTrace]);

  // ============ EXPORT/IMPORT (ZeroTrace only) ============

  const exportConversation = useCallback(async (
    conversationId: string,
    wrappedKey: { ciphertext: string; nonce: string }
  ): Promise<Blob | null> => {
    if (!isZeroTrace) {
      console.warn('[useStorageMode] Export only available in ZeroTrace mode');
      return null;
    }

    try {
      const exportData = await localChatStorage.exportConversation(conversationId, wrappedKey);
      const json = JSON.stringify(exportData, null, 2);
      return new Blob([json], { type: 'application/json' });
    } catch (err) {
      console.error('[useStorageMode] Export failed:', err);
      return null;
    }
  }, [isZeroTrace]);

  const importConversation = useCallback(async (file: File): Promise<string | null> => {
    if (!isZeroTrace) {
      console.warn('[useStorageMode] Import only available in ZeroTrace mode');
      return null;
    }

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      // Validate structure
      if (data.version !== '1.0' || !data.conversation || !data.messages) {
        throw new Error('Invalid export file format');
      }

      const newId = await localChatStorage.importConversation(data);
      console.log('[useStorageMode] Conversation imported:', newId);
      return newId;
    } catch (err) {
      console.error('[useStorageMode] Import failed:', err);
      return null;
    }
  }, [isZeroTrace]);

  const refreshMode = useCallback(async (): Promise<void> => {
    setIsLoading(true);
    await loadSetting();
  }, [loadSetting]);

  return {
    isZeroTrace,
    isLoading,
    createConversation,
    loadConversations,
    deleteConversation,
    updateConversationTitle,
    saveMessage,
    loadMessages,
    getNextSequenceNumber,
    exportConversation,
    importConversation,
    refreshMode
  };
}
