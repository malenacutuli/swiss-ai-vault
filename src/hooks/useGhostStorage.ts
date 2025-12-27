import { useState, useEffect, useCallback, useRef } from 'react';
import { getGhostStorage, resetGhostStorage, GhostConversation } from '@/lib/ghost/ghost-storage';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Derive a stable encryption key from user ID using PBKDF2
 * This ensures the same key is always derived for the same user,
 * so conversations can be decrypted after page refresh.
 */
const deriveKeyFromUserId = async (userId: string): Promise<CryptoKey> => {
  // Create a stable salt from user ID
  const encoder = new TextEncoder();
  const salt = encoder.encode(`swissvault_ghost_${userId}_stable_salt_v1`);
  
  // Import user ID as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );
  
  // Derive the actual encryption key
  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false, // not extractable for security
    ['encrypt', 'decrypt']
  );
  
  return key;
};

export function useGhostStorage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<{ id: string; title: string; updatedAt: number; messageCount: number; folderId?: string }[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [corruptedCount, setCorruptedCount] = useState(0);
  
  // Prevent double initialization in React Strict Mode / HMR
  const initializingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  // Initialize storage with stable encryption key derived from user ID
  // IMPORTANT: Depend on user?.id (string) not user (object) to prevent re-init on object identity changes
  const userId = user?.id;

  useEffect(() => {
    console.log('[Ghost Storage Hook] effect', {
      userId: userId ? userId.slice(0, 8) : null,
      isInitialized,
      lastUserId: lastUserIdRef.current ? lastUserIdRef.current.slice(0, 8) : null,
      initializing: initializingRef.current,
    });

    const initStorage = async () => {
      if (!userId) {
        console.log('[Ghost Storage Hook] No userId; stop loading');
        setIsLoading(false);
        return;
      }

      // If already initialized for this user, just refresh conversations (don't re-init)
      if (isInitialized && lastUserIdRef.current === userId) {
        console.log('[Ghost Storage] Already initialized for user, refreshing list only');
        const storage = getGhostStorage();
        const convList = storage.listConversations();
        console.log('[Ghost Storage Hook] refreshOnly convList', convList.length);
        setConversations(convList);
        setIsLoading(false);
        return;
      }

      // Prevent double initialization while in progress
      if (initializingRef.current && lastUserIdRef.current === userId) {
        console.log('[Ghost Storage] Already initializing, skipping...');
        return;
      }

      // If user changed, reset
      if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
        console.log('[Ghost Storage] User changed, resetting...');
        resetGhostStorage();
        setIsInitialized(false);
      }

      initializingRef.current = true;
      lastUserIdRef.current = userId;

      try {
        setIsLoading(true);
        const storage = getGhostStorage();

        // Derive stable master key from user ID (same key every time for same user)
        const masterKey = await deriveKeyFromUserId(userId);

        console.log('[Ghost Storage] Initializing for user:', userId.slice(0, 8));
        await storage.init(masterKey);
        setIsInitialized(true);

        // Check for corrupted (undecryptable) conversations
        const corrupted = storage.getCorruptedCount();
        setCorruptedCount(corrupted);

        // Get conversation list
        const convList = storage.listConversations();
        console.log('[Ghost Storage] Loaded conversations:', convList.length);
        setConversations(convList);
      } catch (error) {
        console.error('[Ghost Storage] Failed to initialize:', error);
      } finally {
        setIsLoading(false);
        initializingRef.current = false;
      }
    };

    initStorage();

    // Cleanup on unmount to allow proper re-init on remount
    return () => {
      console.log('[Ghost Storage Hook] cleanup');
      initializingRef.current = false;
    };
  }, [userId, isInitialized]);

  const refreshConversations = useCallback(() => {
    if (!isInitialized) return;
    const storage = getGhostStorage();
    const convList = storage.listConversations();
    setConversations(convList);
  }, [isInitialized]);

  const createConversation = useCallback((title: string = 'New Ghost Session', isTemporary: boolean = false): string | null => {
    if (!isInitialized) return null;
    const storage = getGhostStorage();
    const id = storage.createConversation(title, isTemporary);
    // Only refresh if not temporary (temporary won't show in sidebar)
    if (!isTemporary) {
      refreshConversations();
    }
    return id;
  }, [isInitialized, refreshConversations]);

  const makeConversationPersistent = useCallback((convId: string) => {
    if (!isInitialized) return;
    const storage = getGhostStorage();
    storage.makeConversationPersistent(convId);
    refreshConversations();
  }, [isInitialized, refreshConversations]);

  const getConversation = useCallback((convId: string): GhostConversation | undefined => {
    if (!isInitialized) return undefined;
    const storage = getGhostStorage();
    return storage.getConversation(convId);
  }, [isInitialized]);

  const saveMessage = useCallback((convId: string, role: 'user' | 'assistant', content: string) => {
    if (!isInitialized) return;
    const storage = getGhostStorage();
    storage.saveMessage(convId, role, content);
    refreshConversations();
  }, [isInitialized, refreshConversations]);

  const deleteConversation = useCallback((convId: string) => {
    if (!isInitialized) return;
    const storage = getGhostStorage();
    storage.deleteConversation(convId);
    refreshConversations();
  }, [isInitialized, refreshConversations]);

  const exportConversation = useCallback(async (convId: string): Promise<Blob | null> => {
    if (!isInitialized) return null;
    const storage = getGhostStorage();
    return storage.exportConversation(convId);
  }, [isInitialized]);

  const exportAllConversations = useCallback(async (): Promise<Blob | null> => {
    if (!isInitialized) return null;
    const storage = getGhostStorage();
    const conversations = storage.listConversations();
    
    // Export all conversations as a combined blob
    const allExports: any[] = [];
    for (const conv of conversations) {
      try {
        const blob = await storage.exportConversation(conv.id);
        const text = await blob.text();
        allExports.push(JSON.parse(text));
      } catch (e) {
        console.error(`Failed to export conversation ${conv.id}:`, e);
      }
    }
    
    const combined = {
      version: 1,
      format: 'svghost-bundle',
      exportedAt: Date.now(),
      conversations: allExports
    };
    
    return new Blob([JSON.stringify(combined)], { type: 'application/json' });
  }, [isInitialized]);

  const importConversation = useCallback(async (blob: Blob): Promise<string | null> => {
    if (!isInitialized) return null;
    const storage = getGhostStorage();
    const id = await storage.importConversation(blob);
    refreshConversations();
    return id;
  }, [isInitialized, refreshConversations]);

  const updateConversationTitle = useCallback((convId: string, title: string): boolean => {
    if (!isInitialized) {
      console.warn('[useGhostStorage] Cannot updateTitle - not initialized');
      return false;
    }
    const storage = getGhostStorage();
    const success = storage.updateTitle(convId, title);
    if (success) refreshConversations();
    return success;
  }, [isInitialized, refreshConversations]);

  const moveToFolder = useCallback((convId: string, folderId: string | null): boolean => {
    if (!isInitialized) {
      console.warn('[useGhostStorage] Cannot moveToFolder - not initialized');
      return false;
    }
    const storage = getGhostStorage();
    const success = storage.moveToFolder(convId, folderId);
    if (success) refreshConversations();
    return success;
  }, [isInitialized, refreshConversations]);

  const clearAllConversations = useCallback(async () => {
    if (!isInitialized) return;
    const storage = getGhostStorage();
    await storage.clearAllConversations();
    setConversations([]);
    setCorruptedCount(0);
  }, [isInitialized]);

  const clearAllData = useCallback(() => {
    resetGhostStorage();
    setConversations([]);
    setIsInitialized(false);
    setCorruptedCount(0);
  }, []);

  return {
    conversations,
    isInitialized,
    isLoading,
    corruptedCount,
    createConversation,
    getConversation,
    saveMessage,
    deleteConversation,
    exportConversation,
    exportAllConversations,
    importConversation,
    updateConversationTitle,
    moveToFolder,
    makeConversationPersistent,
    clearAllConversations,
    clearAllData,
    refreshConversations,
  };
}
