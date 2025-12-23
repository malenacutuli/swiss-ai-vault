import { useState, useEffect, useCallback } from 'react';
import { getGhostStorage, resetGhostStorage, GhostConversation } from '@/lib/ghost/ghost-storage';
import { useAuth } from '@/contexts/AuthContext';

export function useGhostStorage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<{ id: string; title: string; updatedAt: number; messageCount: number }[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize storage with encryption key
  useEffect(() => {
    const initStorage = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const storage = getGhostStorage();
        
        // Generate master key for ghost storage using Web Crypto directly
        const masterKey = await crypto.subtle.generateKey(
          { name: 'AES-GCM', length: 256 },
          true,
          ['encrypt', 'decrypt']
        );
        
        await storage.init(masterKey);
        setIsInitialized(true);
        refreshConversations();
      } catch (error) {
        console.error('[Ghost Storage] Failed to initialize:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initStorage();
  }, [user]);

  const refreshConversations = useCallback(() => {
    if (!isInitialized) return;
    const storage = getGhostStorage();
    const convList = storage.listConversations();
    setConversations(convList);
  }, [isInitialized]);

  const createConversation = useCallback((title: string = 'New Ghost Session'): string | null => {
    if (!isInitialized) return null;
    const storage = getGhostStorage();
    const id = storage.createConversation(title);
    refreshConversations();
    return id;
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

  const updateConversationTitle = useCallback((convId: string, title: string) => {
    if (!isInitialized) return;
    const storage = getGhostStorage();
    storage.updateTitle(convId, title);
    refreshConversations();
  }, [isInitialized, refreshConversations]);

  const clearAllData = useCallback(() => {
    resetGhostStorage();
    setConversations([]);
    setIsInitialized(false);
  }, []);

  return {
    conversations,
    isInitialized,
    isLoading,
    createConversation,
    getConversation,
    saveMessage,
    deleteConversation,
    exportConversation,
    exportAllConversations,
    importConversation,
    updateConversationTitle,
    clearAllData,
    refreshConversations,
  };
}
