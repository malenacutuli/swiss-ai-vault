/**
 * useEncryptedChat Hook
 * Comprehensive hook for managing encrypted chat conversations.
 * Handles loading, decryption, sending messages, and real-time updates.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useEncryptionContext } from '@/contexts/EncryptionContext';
import * as conversationService from '@/services/encrypted-conversations';
import type { 
  DecryptedConversation, 
  DecryptedMessage, 
  EncryptedMessage 
} from '@/types/encryption';
import { supabase } from '@/integrations/supabase/client';

interface UseEncryptedChatReturn {
  // State
  conversations: DecryptedConversation[];
  currentConversation: DecryptedConversation | null;
  messages: DecryptedMessage[];
  isLoading: boolean;
  isSending: boolean;
  isEncrypting: boolean;
  
  // Actions
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  createConversation: (title?: string, modelId?: string) => Promise<string>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  updateConversationTitle: (id: string, newTitle: string) => Promise<void>;
  clearCurrentConversation: () => void;
  
  // Encryption state
  needsUnlock: boolean;
}

export function useEncryptedChat(): UseEncryptedChatReturn {
  const [conversations, setConversations] = useState<DecryptedConversation[]>([]);
  const [currentConversation, setCurrentConversation] = useState<DecryptedConversation | null>(null);
  const [messages, setMessages] = useState<DecryptedMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [isEncrypting, setIsEncrypting] = useState(false);
  
  const { toast } = useToast();
  const encryption = useEncryptionContext();
  const subscriptionRef = useRef<ReturnType<typeof conversationService.subscribeToMessages> | null>(null);
  const messagesRef = useRef<DecryptedMessage[]>([]);
  
  // Keep messages ref in sync
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  
  // Check if we need to unlock vault
  const needsUnlock = encryption.isInitialized && !encryption.isUnlocked;
  
  // Load all conversations
  const loadConversations = useCallback(async () => {
    if (!encryption.isUnlocked) return;
    
    setIsLoading(true);
    try {
      const encryptedConversations = await conversationService.getEncryptedConversations();
      
      // Decrypt titles
      const decrypted = await Promise.all(
        encryptedConversations.map(async (conv) => {
          let title = 'New Chat';
          
          if (conv.encryptedTitle && conv.titleNonce) {
            try {
              // Load conversation key first
              const keyData = await conversationService.getConversationKeyFromDB(conv.id);
              if (keyData) {
                await encryption.loadConversationKey(conv.id, {
                  ciphertext: keyData.wrappedKey,
                  nonce: keyData.nonce
                });
                
                title = await encryption.decryptMessage(conv.id, {
                  ciphertext: conv.encryptedTitle,
                  nonce: conv.titleNonce
                });
              }
            } catch (e) {
              console.error('Failed to decrypt conversation title:', e);
            }
          }
          
          return {
            id: conv.id,
            userId: conv.userId,
            organizationId: conv.organizationId,
            title,
            modelId: conv.modelId,
            isEncrypted: conv.isEncrypted,
            zeroRetention: conv.zeroRetention,
            keyVersion: conv.keyVersion,
            createdAt: conv.createdAt,
            updatedAt: conv.updatedAt,
            lastMessageAt: conv.lastMessageAt
          } as DecryptedConversation;
        })
      );
      
      setConversations(decrypted);
    } catch (error) {
      console.error('Failed to load conversations:', error);
      toast({
        title: 'Failed to load conversations',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [encryption, toast]);
  
  // Select and load a conversation
  const selectConversation = useCallback(async (id: string) => {
    if (!encryption.isUnlocked) return;
    
    setIsLoading(true);
    try {
      // Get conversation
      const conv = await conversationService.getEncryptedConversation(id);
      if (!conv) throw new Error('Conversation not found');
      
      // Load key
      const keyData = await conversationService.getConversationKeyFromDB(id);
      if (keyData) {
        await encryption.loadConversationKey(id, {
          ciphertext: keyData.wrappedKey,
          nonce: keyData.nonce
        });
      }
      
      // Decrypt title
      let title = 'New Chat';
      if (conv.encryptedTitle && conv.titleNonce) {
        try {
          title = await encryption.decryptMessage(id, {
            ciphertext: conv.encryptedTitle,
            nonce: conv.titleNonce
          });
        } catch (e) {
          console.error('Failed to decrypt title:', e);
        }
      }
      
      const decryptedConv: DecryptedConversation = {
        id: conv.id,
        userId: conv.userId,
        organizationId: conv.organizationId,
        title,
        modelId: conv.modelId,
        isEncrypted: conv.isEncrypted,
        zeroRetention: conv.zeroRetention,
        retentionMode: conv.retentionMode,
        keyVersion: conv.keyVersion,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        lastMessageAt: conv.lastMessageAt
      };
      
      setCurrentConversation(decryptedConv);
      
      // Load and decrypt messages
      const encryptedMessages = await conversationService.getEncryptedMessages(id);
      const decryptedMessages = await encryption.decryptMessages(
        id,
        encryptedMessages.map(m => ({
          id: m.id,
          ciphertext: m.ciphertext,
          nonce: m.nonce
        }))
      );
      
      const finalMessages = encryptedMessages.map((m, i) => ({
        id: m.id,
        conversationId: m.conversationId,
        content: decryptedMessages[i].content,
        role: m.role,
        sequenceNumber: m.sequenceNumber,
        tokenCount: m.tokenCount,
        hasAttachments: m.hasAttachments,
        createdAt: m.createdAt
      })) as DecryptedMessage[];
      
      setMessages(finalMessages);
      
      // Subscribe to new messages
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
      
      subscriptionRef.current = conversationService.subscribeToMessages(
        id,
        async (newMessage: EncryptedMessage) => {
          // Only process if we didn't send it
          const exists = messagesRef.current.some(m => m.id === newMessage.id);
          if (exists) return;
          
          try {
            const content = await encryption.decryptMessage(id, {
              ciphertext: newMessage.ciphertext,
              nonce: newMessage.nonce
            });
            
            const decryptedMessage: DecryptedMessage = {
              id: newMessage.id,
              conversationId: newMessage.conversationId,
              content,
              role: newMessage.role,
              sequenceNumber: newMessage.sequenceNumber,
              tokenCount: newMessage.tokenCount,
              hasAttachments: newMessage.hasAttachments,
              createdAt: newMessage.createdAt
            };
            
            setMessages(prev => [...prev, decryptedMessage]);
          } catch (e) {
            console.error('Failed to decrypt incoming message:', e);
          }
        }
      );
      
    } catch (error) {
      console.error('Failed to load conversation:', error);
      toast({
        title: 'Failed to load conversation',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [encryption, toast]);
  
  // Create new conversation
  const createConversation = useCallback(async (
    title: string = 'New Chat',
    modelId: string = 'claude-3-5-sonnet-20241022'
  ): Promise<string> => {
    if (!encryption.isUnlocked) throw new Error('Vault is locked');
    
    setIsLoading(true);
    try {
      // Create encryption key for conversation
      const { keyHash, wrappedKey } = await encryption.createConversationKey('temp');
      
      // Create conversation in DB first to get the ID
      const conv = await conversationService.createEncryptedConversation({
        encryptedTitle: '',
        titleNonce: '',
        keyHash,
        modelId
      });
      
      // Store wrapped key with actual conversation ID
      await conversationService.storeConversationKeyInDB({
        conversationId: conv.id,
        wrappedKey: wrappedKey.ciphertext,
        nonce: wrappedKey.nonce
      });
      
      // Load the key with the correct conversation ID
      await encryption.loadConversationKey(conv.id, wrappedKey);
      
      // Now encrypt the title with the correct key
      const encryptedTitle = await encryption.encryptMessage(conv.id, title);
      
      // Update with encrypted title
      await conversationService.updateEncryptedConversation(conv.id, {
        encryptedTitle: encryptedTitle.ciphertext,
        titleNonce: encryptedTitle.nonce
      });
      
      // Add to local state
      const decryptedConv: DecryptedConversation = {
        id: conv.id,
        userId: conv.userId,
        organizationId: conv.organizationId,
        title,
        modelId: conv.modelId,
        isEncrypted: conv.isEncrypted,
        zeroRetention: conv.zeroRetention,
        retentionMode: conv.retentionMode,
        keyVersion: conv.keyVersion,
        createdAt: conv.createdAt,
        updatedAt: conv.updatedAt,
        lastMessageAt: conv.lastMessageAt
      };
      
      setConversations(prev => [decryptedConv, ...prev]);
      setCurrentConversation(decryptedConv);
      setMessages([]);
      
      return conv.id;
    } finally {
      setIsLoading(false);
    }
  }, [encryption]);
  
  // Send message
  const sendMessage = useCallback(async (content: string) => {
    if (!currentConversation || !encryption.isUnlocked) return;
    
    setIsEncrypting(true);
    try {
      // Encrypt user message
      const encrypted = await encryption.encryptMessage(currentConversation.id, content);
      
      setIsEncrypting(false);
      setIsSending(true);
      
      // Insert user message
      const userMessage = await conversationService.insertEncryptedMessage({
        conversationId: currentConversation.id,
        ciphertext: encrypted.ciphertext,
        nonce: encrypted.nonce,
        role: 'user'
      });
      
      // Add to local state
      const decryptedUserMessage: DecryptedMessage = {
        id: userMessage.id,
        conversationId: userMessage.conversationId,
        content,
        role: userMessage.role,
        sequenceNumber: userMessage.sequenceNumber,
        tokenCount: userMessage.tokenCount,
        hasAttachments: userMessage.hasAttachments,
        createdAt: userMessage.createdAt
      };
      
      setMessages(prev => [...prev, decryptedUserMessage]);
      
      // Prepare messages for API
      const apiMessages = [...messagesRef.current, decryptedUserMessage].map(m => ({
        role: m.role,
        content: m.content
      }));
      
      // Call LLM API
      const { data, error } = await supabase.functions.invoke('chat-completions', {
        body: {
          messages: apiMessages,
          model: currentConversation.modelId,
          zero_retention: currentConversation.zeroRetention
        }
      });
      
      if (error) throw error;
      
      const assistantContent = data.choices?.[0]?.message?.content || 'No response';
      
      // Encrypt assistant response
      const encryptedResponse = await encryption.encryptMessage(
        currentConversation.id, 
        assistantContent
      );
      
      // Insert assistant message
      const assistantMessage = await conversationService.insertEncryptedMessage({
        conversationId: currentConversation.id,
        ciphertext: encryptedResponse.ciphertext,
        nonce: encryptedResponse.nonce,
        role: 'assistant',
        tokenCount: data.usage?.completion_tokens
      });
      
      const decryptedAssistantMessage: DecryptedMessage = {
        id: assistantMessage.id,
        conversationId: assistantMessage.conversationId,
        content: assistantContent,
        role: assistantMessage.role,
        sequenceNumber: assistantMessage.sequenceNumber,
        tokenCount: assistantMessage.tokenCount,
        hasAttachments: assistantMessage.hasAttachments,
        createdAt: assistantMessage.createdAt
      };
      
      setMessages(prev => [...prev, decryptedAssistantMessage]);
      
    } catch (error) {
      console.error('Failed to send message:', error);
      toast({
        title: 'Failed to send message',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive'
      });
    } finally {
      setIsSending(false);
      setIsEncrypting(false);
    }
  }, [currentConversation, encryption, toast]);
  
  // Delete conversation
  const deleteConversation = useCallback(async (id: string) => {
    try {
      await conversationService.deleteEncryptedConversation(id);
      setConversations(prev => prev.filter(c => c.id !== id));
      
      if (currentConversation?.id === id) {
        setCurrentConversation(null);
        setMessages([]);
      }
      
      toast({ title: 'Conversation deleted' });
    } catch (error) {
      console.error('Failed to delete conversation:', error);
      toast({
        title: 'Failed to delete conversation',
        variant: 'destructive'
      });
    }
  }, [currentConversation, toast]);
  
  // Update conversation title
  const updateConversationTitle = useCallback(async (id: string, newTitle: string) => {
    if (!encryption.isUnlocked) return;
    
    try {
      const encrypted = await encryption.encryptMessage(id, newTitle);
      
      await conversationService.updateEncryptedConversation(id, {
        encryptedTitle: encrypted.ciphertext,
        titleNonce: encrypted.nonce
      });
      
      setConversations(prev => 
        prev.map(c => c.id === id ? { ...c, title: newTitle } : c)
      );
      
      if (currentConversation?.id === id) {
        setCurrentConversation(prev => prev ? { ...prev, title: newTitle } : null);
      }
    } catch (error) {
      console.error('Failed to update title:', error);
      toast({
        title: 'Failed to update title',
        variant: 'destructive'
      });
    }
  }, [currentConversation, encryption, toast]);
  
  // Clear current conversation
  const clearCurrentConversation = useCallback(() => {
    setCurrentConversation(null);
    setMessages([]);
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
  }, []);
  
  // Load conversations on unlock
  useEffect(() => {
    if (encryption.isUnlocked) {
      loadConversations();
    }
  }, [encryption.isUnlocked, loadConversations]);
  
  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
      }
    };
  }, []);
  
  return {
    conversations,
    currentConversation,
    messages,
    isLoading,
    isSending,
    isEncrypting,
    needsUnlock,
    loadConversations,
    selectConversation,
    createConversation,
    deleteConversation,
    sendMessage,
    updateConversationTitle,
    clearCurrentConversation
  };
}
