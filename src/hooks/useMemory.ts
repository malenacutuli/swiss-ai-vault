// src/hooks/useMemory.ts
// React hook for Personal AI Memory with lazy imports to avoid circular deps

import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useEncryptionContext } from '@/contexts/EncryptionContext';

// Lazy import with caching to ensure singleton instance
// This prevents module isolation issues where multiple imports get different state
let cachedManager: typeof import('@/lib/memory/memory-manager') | null = null;

const getMemoryManager = async () => {
  if (!cachedManager) {
    cachedManager = await import('@/lib/memory/memory-manager');
    console.log('[useMemory] Memory manager module loaded');
  }
  return cachedManager;
};

// ==========================================
// TYPES
// ==========================================

export interface MemoryProgress {
  message: string;
  percent: number;
}

export type MemorySource = 'document' | 'chat' | 'note' | 'url';

export interface ContextSnippet {
  id: string;
  content: string;
  source: MemorySource;
  score: number;
  metadata: {
    source: MemorySource;
    filename?: string;
    title?: string;
    url?: string;
    conversationId?: string;
    chunkIndex?: number;
    totalChunks?: number;
    createdAt: number;
    updatedAt?: number;
  };
}

export interface AddDocumentResult {
  documentId: string;
  chunksAdded: number;
  success: boolean;
  error?: string;
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
  
  // Migration (cross-origin transfer)
  migrateExport: (password: string, onProgress?: (current: number, total: number) => void) => Promise<Blob>;
  migrateImport: (file: File, password: string, onProgress?: (current: number, total: number) => void) => Promise<{ imported: number; skipped: number }>;
}

// ==========================================
// HOOK
// ==========================================

export function useMemory(): UseMemoryReturn {
  const { toast } = useToast();
  const { isUnlocked, getMasterKey } = useEncryptionContext();
  
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<MemoryProgress>({ message: '', percent: 0 });
  
  const initializingRef = useRef(false);
  
  // Check if vault is unlocked (required for encryption)
  const isVaultReady = useCallback(() => {
    return isUnlocked;
  }, [isUnlocked]);
  
  // Get encryption key from context (NOT directly from vault)
  const getEncryptionKey = useCallback((): CryptoKey | null => {
    return getMasterKey();
  }, [getMasterKey]);
  
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
      const manager = await getMemoryManager();
      await manager.initMemory(handleProgress);
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
      const manager = await getMemoryManager();
      const result = await manager.addDocument(content, filename, key, handleProgress);
      
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
      const manager = await getMemoryManager();
      const result = await manager.addFromURL(content, url, title, key, handleProgress);
      
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
      const manager = await getMemoryManager();
      return await manager.addChatExcerpt(content, conversationId, key);
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
      const manager = await getMemoryManager();
      const id = await manager.addNote(content, title, key);
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
  
  // Search memory - propagate errors for callers to handle
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
    
    const manager = await getMemoryManager();
    if (!manager.isMemoryReady()) {
      console.warn('[useMemory] Cannot search: embeddings not ready');
      return [];
    }
    
    // Let errors propagate so callers can show appropriate feedback
    console.log('[useMemory] Starting search for:', query.slice(0, 50) + '...');
    const results = await manager.getContext(query, key, options);
    console.log('[useMemory] Search returned', results?.length ?? 0, 'results');
    return results;
  }, [getEncryptionKey]);
  
  // Get context prompt for AI
  const getContextPromptForQuery = useCallback(async (query: string): Promise<{
    snippets: ContextSnippet[];
    prompt: string;
  }> => {
    const snippets = await searchMemory(query);
    const manager = await getMemoryManager();
    const prompt = manager.buildContextPrompt(snippets);
    return { snippets, prompt };
  }, [searchMemory]);
  
  // Delete single item
  const deleteItem = useCallback(async (id: string) => {
    const manager = await getMemoryManager();
    await manager.deleteMemory(id);
  }, []);
  
  // Delete multiple items
  const deleteItems = useCallback(async (ids: string[]) => {
    const manager = await getMemoryManager();
    await manager.deleteMemories(ids);
  }, []);
  
  // Get stats
  const getStats = useCallback(async () => {
    const manager = await getMemoryManager();
    return manager.getMemoryStats();
  }, []);
  
  // Clear all memory
  const clearAll = useCallback(async () => {
    const manager = await getMemoryManager();
    await manager.clearAllMemory();
    toast({
      title: 'Memory cleared',
      description: 'All stored memories have been removed'
    });
  }, [toast]);
  
  // Export backup
  const exportBackup = useCallback(async (): Promise<Blob> => {
    const manager = await getMemoryManager();
    const blob = await manager.exportMemories();
    toast({
      title: 'Memory exported',
      description: 'Your encrypted memories are ready for download'
    });
    return blob;
  }, [toast]);
  
  // Import backup
  const importBackup = useCallback(async (file: File): Promise<number> => {
    try {
      const manager = await getMemoryManager();
      const count = await manager.importMemories(file);
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
  
  // Migrate export (password-protected for cross-origin)
  const migrateExport = useCallback(async (
    password: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<Blob> => {
    const key = getEncryptionKey();
    if (!key) {
      throw new Error('Vault locked');
    }
    
    const { exportMemoriesWithPassword } = await import('@/lib/memory/migration');
    return exportMemoriesWithPassword(password, key, onProgress);
  }, [getEncryptionKey]);
  
  // Migrate import (password-protected for cross-origin)
  const migrateImport = useCallback(async (
    file: File,
    password: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<{ imported: number; skipped: number }> => {
    const key = getEncryptionKey();
    if (!key) {
      throw new Error('Vault locked');
    }
    
    const { importMemoriesWithPassword } = await import('@/lib/memory/migration');
    const result = await importMemoriesWithPassword(file, password, key, onProgress);
    
    toast({
      title: 'Migration complete',
      description: `${result.imported} memories imported, ${result.skipped} skipped`
    });
    
    return result;
  }, [getEncryptionKey, toast]);
  
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
    importBackup,
    
    // Migration
    migrateExport,
    migrateImport
  };
}
