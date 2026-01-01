// src/hooks/useMemory.ts
// React hook for Personal AI Memory
// Integrates with SwissVault's existing useEncryption for key management

import { useState, useCallback, useEffect, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import * as vault from '@/lib/crypto/key-vault';
import {
  initMemory,
  isMemoryReady,
  addDocument,
  addFromURL,
  addChatExcerpt,
  addNote,
  getContext,
  buildContextPrompt,
  deleteMemory,
  deleteMemories,
  getMemoryStats,
  clearAllMemory,
  exportMemories,
  importMemories,
  type ContextSnippet,
  type AddDocumentResult,
  type MemorySource
} from '@/lib/memory/memory-manager';

// ==========================================
// TYPES
// ==========================================

export interface MemoryProgress {
  message: string;
  percent: number;
}

export interface UseMemoryReturn {
  // State
  isInitialized: boolean;
  isLoading: boolean;
  progress: MemoryProgress;
  isReady: boolean;
  
  // Initialization
  initialize: () => Promise<void>;
  
  // Add operations
  addDocument: (content: string, filename: string) => Promise<AddDocumentResult>;
  addURL: (content: string, url: string, title: string) => Promise<AddDocumentResult>;
  addChat: (content: string, conversationId: string) => Promise<string | null>;
  addNote: (content: string, title: string) => Promise<string | null>;
  
  // Retrieval
  search: (query: string, options?: {
    topK?: number;
    maxTokens?: number;
    source?: MemorySource;
  }) => Promise<ContextSnippet[]>;
  getContextPrompt: (query: string) => Promise<{
    snippets: ContextSnippet[];
    prompt: string;
  }>;
  
  // Management
  deleteItem: (id: string) => Promise<void>;
  deleteItems: (ids: string[]) => Promise<void>;
  getStats: () => Promise<{
    count: number;
    sizeEstimateBytes: number;
    hotCacheSize: number;
    oldestTimestamp: number | null;
    newestTimestamp: number | null;
  }>;
  clearAll: () => Promise<void>;
  exportBackup: () => Promise<Blob>;
  importBackup: (file: File) => Promise<number>;
}

// ==========================================
// HOOK
// ==========================================

export function useMemory(): UseMemoryReturn {
  const { toast } = useToast();
  
  const [isInitialized, setIsInitialized] = useState(isMemoryReady());
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<MemoryProgress>({ message: '', percent: 0 });
  
  const initializingRef = useRef(false);
  
  // Check if vault is unlocked (required for encryption)
  const isVaultReady = useCallback(() => {
    return vault.isVaultUnlocked();
  }, []);
  
  // Get encryption key from vault
  const getEncryptionKey = useCallback((): CryptoKey | null => {
    try {
      return vault.getMasterKey();
    } catch {
      return null;
    }
  }, []);
  
  // Progress handler
  const handleProgress = useCallback((message: string, percent?: number) => {
    setProgress({ message, percent: percent ?? 0 });
  }, []);
  
  // Initialize memory system
  const initialize = useCallback(async () => {
    if (isInitialized || initializingRef.current) return;
    
    initializingRef.current = true;
    setIsLoading(true);
    
    try {
      await initMemory(handleProgress);
      setIsInitialized(true);
      console.log('[useMemory] ✅ Memory system initialized');
    } catch (error) {
      console.error('[useMemory] Failed to initialize:', error);
      toast({
        title: 'Memory initialization failed',
        description: 'Could not load the embedding model',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
      initializingRef.current = false;
    }
  }, [isInitialized, handleProgress, toast]);
  
  // Update initialized state when embedding engine loads
  useEffect(() => {
    if (isMemoryReady() && !isInitialized) {
      setIsInitialized(true);
    }
  }, [isInitialized]);
  
  // Add document to memory
  const addDocumentToMemory = useCallback(async (
    content: string,
    filename: string
  ): Promise<AddDocumentResult> => {
    const key = getEncryptionKey();
    if (!key) {
      toast({
        title: 'Vault locked',
        description: 'Please unlock your vault to add documents to memory',
        variant: 'destructive'
      });
      return { documentId: '', chunksAdded: 0, success: false, error: 'Vault locked' };
    }
    
    setIsLoading(true);
    try {
      const result = await addDocument(content, filename, key, handleProgress);
      
      if (result.success) {
        toast({
          title: 'Document added to memory',
          description: `${result.chunksAdded} sections stored from "${filename}"`
        });
      } else {
        toast({
          title: 'Failed to add document',
          description: result.error,
          variant: 'destructive'
        });
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [getEncryptionKey, handleProgress, toast]);
  
  // Add URL content to memory
  const addURLToMemory = useCallback(async (
    content: string,
    url: string,
    title: string
  ): Promise<AddDocumentResult> => {
    const key = getEncryptionKey();
    if (!key) {
      return { documentId: '', chunksAdded: 0, success: false, error: 'Vault locked' };
    }
    
    setIsLoading(true);
    try {
      const result = await addFromURL(content, url, title, key, handleProgress);
      
      if (result.success) {
        toast({
          title: 'Page added to memory',
          description: `Saved "${title}"`
        });
      }
      
      return result;
    } finally {
      setIsLoading(false);
    }
  }, [getEncryptionKey, handleProgress, toast]);
  
  // Add chat excerpt to memory
  const addChatToMemory = useCallback(async (
    content: string,
    conversationId: string
  ): Promise<string | null> => {
    const key = getEncryptionKey();
    if (!key) return null;
    
    try {
      return await addChatExcerpt(content, conversationId, key);
    } catch (error) {
      console.error('[useMemory] Failed to add chat:', error);
      return null;
    }
  }, [getEncryptionKey]);
  
  // Add note to memory
  const addNoteToMemory = useCallback(async (
    content: string,
    title: string
  ): Promise<string | null> => {
    const key = getEncryptionKey();
    if (!key) {
      toast({
        title: 'Vault locked',
        description: 'Please unlock your vault to add notes',
        variant: 'destructive'
      });
      return null;
    }
    
    try {
      const id = await addNote(content, title, key);
      toast({
        title: 'Note saved to memory',
        description: `"${title}" will be available for context`
      });
      return id;
    } catch (error) {
      console.error('[useMemory] Failed to add note:', error);
      toast({
        title: 'Failed to save note',
        variant: 'destructive'
      });
      return null;
    }
  }, [getEncryptionKey, toast]);
  
  // Search memory
  const searchMemory = useCallback(async (
    query: string,
    options?: {
      topK?: number;
      maxTokens?: number;
      source?: MemorySource;
    }
  ): Promise<ContextSnippet[]> => {
    const key = getEncryptionKey();
    if (!key) {
      console.warn('[useMemory] Cannot search: vault locked');
      return [];
    }
    
    if (!isMemoryReady()) {
      console.warn('[useMemory] Cannot search: embeddings not ready');
      return [];
    }
    
    try {
      return await getContext(query, key, options);
    } catch (error) {
      console.error('[useMemory] Search failed:', error);
      return [];
    }
  }, [getEncryptionKey]);
  
  // Get context prompt for AI
  const getContextPromptForQuery = useCallback(async (query: string): Promise<{
    snippets: ContextSnippet[];
    prompt: string;
  }> => {
    const snippets = await searchMemory(query);
    const prompt = buildContextPrompt(snippets);
    return { snippets, prompt };
  }, [searchMemory]);
  
  // Delete single item
  const deleteItem = useCallback(async (id: string) => {
    await deleteMemory(id);
  }, []);
  
  // Delete multiple items
  const deleteItems = useCallback(async (ids: string[]) => {
    await deleteMemories(ids);
  }, []);
  
  // Get stats
  const getStats = useCallback(async () => {
    return getMemoryStats();
  }, []);
  
  // Clear all memory
  const clearAll = useCallback(async () => {
    await clearAllMemory();
    toast({
      title: 'Memory cleared',
      description: 'All stored memories have been removed'
    });
  }, [toast]);
  
  // Export backup
  const exportBackup = useCallback(async (): Promise<Blob> => {
    const blob = await exportMemories();
    toast({
      title: 'Memory exported',
      description: 'Your encrypted memories are ready for download'
    });
    return blob;
  }, [toast]);
  
  // Import backup
  const importBackup = useCallback(async (file: File): Promise<number> => {
    try {
      const count = await importMemories(file);
      toast({
        title: 'Memory imported',
        description: `${count} memories restored`
      });
      return count;
    } catch (error) {
      toast({
        title: 'Import failed',
        description: error instanceof Error ? error.message : 'Invalid file',
        variant: 'destructive'
      });
      return 0;
    }
  }, [toast]);
  
  return {
    // State
    isInitialized,
    isLoading,
    progress,
    isReady: isInitialized && isVaultReady(),
    
    // Initialization
    initialize,
    
    // Add operations
    addDocument: addDocumentToMemory,
    addURL: addURLToMemory,
    addChat: addChatToMemory,
    addNote: addNoteToMemory,
    
    // Retrieval
    search: searchMemory,
    getContextPrompt: getContextPromptForQuery,
    
    // Management
    deleteItem,
    deleteItems,
    getStats,
    clearAll,
    exportBackup,
    importBackup
  };
}

// Re-export types
export type { ContextSnippet, AddDocumentResult, MemorySource };
