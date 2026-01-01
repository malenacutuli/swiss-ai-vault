/**
 * EncryptionContext
 * Provides a single, shared encryption state across the entire application.
 * This ensures all components see the same isUnlocked/isInitialized state.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { useToast } from '@/hooks/use-toast';
import * as crypto from '@/lib/crypto/zerotrace-crypto';
import * as vault from '@/lib/crypto/key-vault';

interface EncryptionContextValue {
  // State
  isInitialized: boolean;
  isUnlocked: boolean;
  isLoading: boolean;
  
  // Setup & Auth
  setupEncryption: (password: string) => Promise<boolean>;
  unlockVault: (password: string) => Promise<boolean>;
  lockVault: () => void;
  clearVault: () => Promise<void>;
  
  // Message Operations
  encryptMessage: (conversationId: string, plaintext: string) => Promise<crypto.EncryptedData>;
  decryptMessage: (conversationId: string, encrypted: crypto.EncryptedData) => Promise<string>;
  
  // Conversation Key Management
  createConversationKey: (conversationId: string) => Promise<{ keyHash: string; wrappedKey: crypto.EncryptedData }>;
  loadConversationKey: (conversationId: string, wrappedKey: crypto.EncryptedData) => Promise<boolean>;
  
  // Bulk Operations
  decryptMessages: (conversationId: string, messages: Array<{ id: string; ciphertext: string; nonce: string }>) => Promise<Array<{ id: string; content: string }>>;
  
  // Title Operations
  encryptTitle: (conversationId: string, title: string) => Promise<crypto.EncryptedData>;
  decryptTitle: (conversationId: string, encrypted: crypto.EncryptedData) => Promise<string>;
}

const EncryptionContext = createContext<EncryptionContextValue | null>(null);

export function EncryptionProvider({ children }: { children: React.ReactNode }) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();
  
  // Check vault state on mount
  useEffect(() => {
    const checkVault = async () => {
      try {
        const initialized = await vault.isVaultInitialized();
        setIsInitialized(initialized);
        setIsUnlocked(vault.isVaultUnlocked());
      } catch (error) {
        console.error('Failed to check vault:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkVault();
    
    // Listen for vault lock events
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // Optionally lock on tab hide (configurable)
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);
  
  // Setup encryption with password
  const setupEncryption = useCallback(async (password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      if (password.length < 8) {
        toast({
          title: 'Password too short',
          description: 'Please use at least 8 characters',
          variant: 'destructive'
        });
        return false;
      }
      
      await vault.setupEncryption(password);
      setIsInitialized(true);
      setIsUnlocked(true);
      
      toast({
        title: 'Encryption enabled',
        description: 'Your messages will now be encrypted end-to-end'
      });
      
      return true;
    } catch (error) {
      console.error('Setup encryption failed:', error);
      toast({
        title: 'Setup failed',
        description: 'Could not initialize encryption',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  // Unlock vault
  const unlockVaultFn = useCallback(async (password: string): Promise<boolean> => {
    setIsLoading(true);
    try {
      const success = await vault.unlockVault(password);
      setIsUnlocked(success);
      
      if (!success) {
        toast({
          title: 'Wrong password',
          description: 'Please try again',
          variant: 'destructive'
        });
      }
      
      return success;
    } catch (error) {
      console.error('Unlock failed:', error);
      toast({
        title: 'Unlock failed',
        description: 'Could not unlock vault',
        variant: 'destructive'
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [toast]);
  
  // Lock vault
  const lockVaultFn = useCallback(() => {
    vault.lockVault();
    setIsUnlocked(false);
  }, []);
  
  // Clear vault (for password reset)
  const clearVaultFn = useCallback(async () => {
    try {
      await vault.clearVault();
      setIsInitialized(false);
      setIsUnlocked(false);
    } catch (error) {
      console.error('Clear vault failed:', error);
      throw error;
    }
  }, []);
  
  // Get or create conversation key helper
  const getConversationKey = useCallback(async (conversationId: string): Promise<CryptoKey> => {
    if (!isUnlocked) {
      throw new Error('Vault is locked');
    }
    
    const masterKey = vault.getMasterKey();
    
    const unwrap = async (wrapped: crypto.EncryptedData) => {
      return crypto.unwrapKey(wrapped, masterKey);
    };
    
    const conversationKey = await vault.getConversationKey(conversationId, unwrap);
    
    if (!conversationKey) {
      throw new Error('Conversation key not found');
    }
    
    return conversationKey;
  }, [isUnlocked]);
  
  // Create new conversation key
  const createConversationKey = useCallback(async (
    conversationId: string
  ): Promise<{ keyHash: string; wrappedKey: crypto.EncryptedData }> => {
    if (!isUnlocked) {
      throw new Error('Vault is locked');
    }
    
    const masterKey = vault.getMasterKey();
    const conversationKey = await crypto.generateConversationKey();
    
    // Wrap the key with master key
    const wrappedKey = await crypto.wrapKey(conversationKey, masterKey);
    
    // Generate hash for server-side verification
    const keyHash = await crypto.hashKey(conversationKey);
    
    // Store wrapped key locally
    await vault.storeConversationKey(conversationId, wrappedKey.ciphertext, wrappedKey.nonce);
    
    // Cache the unwrapped key for immediate use
    vault.cacheConversationKey(conversationId, conversationKey);
    
    return { keyHash, wrappedKey };
  }, [isUnlocked]);
  
  // Load existing conversation key
  const loadConversationKey = useCallback(async (
    conversationId: string,
    wrappedKey: crypto.EncryptedData
  ): Promise<boolean> => {
    if (!isUnlocked) {
      throw new Error('Vault is locked');
    }
    
    try {
      const masterKey = vault.getMasterKey();
      
      // First, store the wrapped key if not already stored
      await vault.storeConversationKey(conversationId, wrappedKey.ciphertext, wrappedKey.nonce);
      
      const unwrap = async (wrapped: crypto.EncryptedData) => {
        return crypto.unwrapKey(wrapped, masterKey);
      };
      
      const key = await vault.getConversationKey(conversationId, unwrap);
      return key !== null;
    } catch (error) {
      console.error('Failed to load conversation key:', error);
      return false;
    }
  }, [isUnlocked]);
  
  // Encrypt a message
  const encryptMessage = useCallback(async (
    conversationId: string,
    plaintext: string
  ): Promise<crypto.EncryptedData> => {
    const conversationKey = await getConversationKey(conversationId);
    return crypto.encrypt(plaintext, conversationKey);
  }, [getConversationKey]);
  
  // Decrypt a message
  const decryptMessage = useCallback(async (
    conversationId: string,
    encrypted: crypto.EncryptedData
  ): Promise<string> => {
    const conversationKey = await getConversationKey(conversationId);
    return crypto.decrypt(encrypted, conversationKey);
  }, [getConversationKey]);
  
  // Encrypt title
  const encryptTitle = useCallback(async (
    conversationId: string,
    title: string
  ): Promise<crypto.EncryptedData> => {
    const conversationKey = await getConversationKey(conversationId);
    return crypto.encrypt(title, conversationKey);
  }, [getConversationKey]);
  
  // Decrypt title
  const decryptTitle = useCallback(async (
    conversationId: string,
    encrypted: crypto.EncryptedData
  ): Promise<string> => {
    const conversationKey = await getConversationKey(conversationId);
    return crypto.decrypt(encrypted, conversationKey);
  }, [getConversationKey]);
  
  // Decrypt multiple messages (optimized)
  const decryptMessages = useCallback(async (
    conversationId: string,
    messages: Array<{ id: string; ciphertext: string; nonce: string }>
  ): Promise<Array<{ id: string; content: string }>> => {
    const conversationKey = await getConversationKey(conversationId);
    
    // Decrypt all messages in parallel
    const decrypted = await Promise.all(
      messages.map(async (msg) => {
        try {
          const content = await crypto.decrypt(
            { ciphertext: msg.ciphertext, nonce: msg.nonce },
            conversationKey
          );
          return { id: msg.id, content };
        } catch (error) {
          console.error(`Failed to decrypt message ${msg.id}:`, error);
          return { id: msg.id, content: '[Decryption failed]' };
        }
      })
    );
    
    return decrypted;
  }, [getConversationKey]);
  
  const value = useMemo<EncryptionContextValue>(() => ({
    isInitialized,
    isUnlocked,
    isLoading,
    setupEncryption,
    unlockVault: unlockVaultFn,
    lockVault: lockVaultFn,
    clearVault: clearVaultFn,
    encryptMessage,
    decryptMessage,
    createConversationKey,
    loadConversationKey,
    decryptMessages,
    encryptTitle,
    decryptTitle
  }), [
    isInitialized,
    isUnlocked,
    isLoading,
    setupEncryption,
    unlockVaultFn,
    lockVaultFn,
    clearVaultFn,
    encryptMessage,
    decryptMessage,
    createConversationKey,
    loadConversationKey,
    decryptMessages,
    encryptTitle,
    decryptTitle
  ]);
  
  return (
    <EncryptionContext.Provider value={value}>
      {children}
    </EncryptionContext.Provider>
  );
}

export function useEncryptionContext(): EncryptionContextValue {
  const context = useContext(EncryptionContext);
  if (!context) {
    throw new Error('useEncryptionContext must be used within an EncryptionProvider');
  }
  return context;
}
