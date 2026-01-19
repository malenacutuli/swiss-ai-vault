import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getHealthStorage,
  resetHealthStorageAsync,
  wipeHealthStorageAsync,
  HealthConversation,
  HealthMessage,
  AttachedDocument,
  RetentionMode,
  HealthSettings,
  DEFAULT_HEALTH_SETTINGS
} from '@/lib/health/health-storage';
import { useAuth } from '@/contexts/AuthContext';

const ANON_ID_KEY = 'health_anon_user_id_v1';

/**
 * Derive a stable encryption key from user ID using PBKDF2
 */
const deriveKeyFromUserId = async (userId: string): Promise<CryptoKey> => {
  const encoder = new TextEncoder();
  const salt = encoder.encode(`swissbrain_health_${userId}_stable_salt_v1`);

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(userId),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  return key;
};

let memoryAnonId: string | null = null;

function getOrCreateAnonymousId(): string {
  try {
    const existing = localStorage.getItem(ANON_ID_KEY);
    if (existing) return existing;
    const created = crypto.randomUUID();
    localStorage.setItem(ANON_ID_KEY, created);
    return created;
  } catch {
    try {
      const existing = sessionStorage.getItem(ANON_ID_KEY);
      if (existing) return existing;
      const created = crypto.randomUUID();
      sessionStorage.setItem(ANON_ID_KEY, created);
      return created;
    } catch {
      if (memoryAnonId) return memoryAnonId;
      memoryAnonId = crypto.randomUUID();
      return memoryAnonId;
    }
  }
}

export interface ConversationSummary {
  id: string;
  title: string;
  updatedAt: number;
  messageCount: number;
  documentCount: number;
  taskType: string;
  retentionMode: RetentionMode;
}

export function useHealthStorage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [corruptedCount, setCorruptedCount] = useState(0);
  const [settings, setSettings] = useState<HealthSettings>(DEFAULT_HEALTH_SETTINGS);

  const [anonId] = useState<string>(() =>
    typeof window !== 'undefined' ? getOrCreateAnonymousId() : 'anon'
  );

  const initializingRef = useRef(false);
  const lastUserIdRef = useRef<string | null>(null);

  const userId = user?.id || anonId;

  useEffect(() => {
    console.log('[Health Storage Hook] effect', {
      userId: userId ? userId.slice(0, 8) : null,
      isInitialized,
      lastUserId: lastUserIdRef.current ? lastUserIdRef.current.slice(0, 8) : null,
    });

    const initStorage = async () => {
      if (!userId) {
        setIsLoading(false);
        return;
      }

      if (isInitialized && lastUserIdRef.current === userId) {
        const storage = getHealthStorage();
        const convList = storage.listConversations();
        setConversations(convList);
        setIsLoading(false);
        return;
      }

      if (initializingRef.current && lastUserIdRef.current === userId) {
        return;
      }

      if (lastUserIdRef.current && lastUserIdRef.current !== userId) {
        await resetHealthStorageAsync();
        setIsInitialized(false);
      }

      initializingRef.current = true;
      lastUserIdRef.current = userId;

      try {
        setIsLoading(true);
        const storage = getHealthStorage();

        const masterKey = await deriveKeyFromUserId(userId);

        console.log('[Health Storage] Initializing for user:', userId.slice(0, 8));
        await storage.init(masterKey);
        setIsInitialized(true);

        const corrupted = storage.getCorruptedCount();
        setCorruptedCount(corrupted);

        const convList = storage.listConversations();
        setConversations(convList);

        // Load settings
        const loadedSettings = await storage.getSettings();
        setSettings(loadedSettings);

        console.log('[Health Storage] Init complete', {
          conversationCount: convList.length,
          corruptedCount: corrupted,
        });
      } catch (error) {
        console.error('[Health Storage] Failed to initialize:', error);
      } finally {
        setIsLoading(false);
        initializingRef.current = false;
      }
    };

    initStorage();

    // Cleanup zerotrace on unload
    const handleBeforeUnload = () => {
      const storage = getHealthStorage();
      if (storage.isInitialized()) {
        storage.clearAllZerotrace();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      initializingRef.current = false;
    };
  }, [userId, isInitialized]);

  const refreshConversations = useCallback(() => {
    if (!isInitialized) return;
    const storage = getHealthStorage();
    const convList = storage.listConversations();
    setConversations(convList);
  }, [isInitialized]);

  const createConversation = useCallback((
    title: string = 'New Health Session',
    retentionMode?: RetentionMode,
    memoryEnabled?: boolean,
    taskType?: string
  ): string | null => {
    if (!isInitialized) return null;
    const storage = getHealthStorage();
    const id = storage.createConversation(
      title,
      retentionMode ?? settings.defaultRetentionMode,
      memoryEnabled ?? settings.memoryEnabled,
      taskType ?? settings.preferredTaskType
    );
    refreshConversations();
    return id;
  }, [isInitialized, settings, refreshConversations]);

  const getConversation = useCallback((convId: string): HealthConversation | undefined => {
    if (!isInitialized) return undefined;
    const storage = getHealthStorage();
    return storage.getConversation(convId);
  }, [isInitialized]);

  const saveMessage = useCallback((
    convId: string,
    role: 'user' | 'assistant',
    content: string,
    toolCalls?: HealthMessage['toolCalls'],
    metadata?: Record<string, any>
  ): HealthMessage | null => {
    if (!isInitialized) return null;
    const storage = getHealthStorage();
    const message = storage.saveMessage(convId, role, content, toolCalls, metadata);
    refreshConversations();
    return message;
  }, [isInitialized, refreshConversations]);

  const attachDocument = useCallback((
    convId: string,
    filename: string,
    mimeType: string,
    content: string,
    size: number,
    extractedText?: string
  ): AttachedDocument | null => {
    if (!isInitialized) return null;
    const storage = getHealthStorage();
    const doc = storage.attachDocument(convId, filename, mimeType, content, size, extractedText);
    refreshConversations();
    return doc;
  }, [isInitialized, refreshConversations]);

  const removeDocument = useCallback((convId: string, docId: string): boolean => {
    if (!isInitialized) return false;
    const storage = getHealthStorage();
    const success = storage.removeDocument(convId, docId);
    if (success) refreshConversations();
    return success;
  }, [isInitialized, refreshConversations]);

  const deleteConversation = useCallback(async (convId: string) => {
    if (!isInitialized) return;
    const storage = getHealthStorage();
    await storage.deleteConversation(convId);
    refreshConversations();
  }, [isInitialized, refreshConversations]);

  const updateTitle = useCallback((convId: string, title: string): boolean => {
    if (!isInitialized) return false;
    const storage = getHealthStorage();
    const success = storage.updateTitle(convId, title);
    if (success) refreshConversations();
    return success;
  }, [isInitialized, refreshConversations]);

  const updateTaskType = useCallback((convId: string, taskType: string): boolean => {
    if (!isInitialized) return false;
    const storage = getHealthStorage();
    const success = storage.updateTaskType(convId, taskType);
    if (success) refreshConversations();
    return success;
  }, [isInitialized, refreshConversations]);

  const setMemoryEnabled = useCallback((convId: string, enabled: boolean): boolean => {
    if (!isInitialized) return false;
    const storage = getHealthStorage();
    return storage.setMemoryEnabled(convId, enabled);
  }, [isInitialized]);

  const setRetentionMode = useCallback((convId: string, mode: RetentionMode): boolean => {
    if (!isInitialized) return false;
    const storage = getHealthStorage();
    const success = storage.setRetentionMode(convId, mode);
    if (success) refreshConversations();
    return success;
  }, [isInitialized, refreshConversations]);

  const updateSettings = useCallback(async (updates: Partial<HealthSettings>) => {
    if (!isInitialized) return;
    const storage = getHealthStorage();
    await storage.saveSettings(updates);
    setSettings(prev => ({ ...prev, ...updates }));
  }, [isInitialized]);

  const clearAllData = useCallback(async () => {
    console.log('[useHealthStorage] User-initiated wipe');
    await wipeHealthStorageAsync();
    setConversations([]);
    setIsInitialized(false);
    setCorruptedCount(0);
    setSettings(DEFAULT_HEALTH_SETTINGS);
  }, []);

  return {
    // State
    conversations,
    isInitialized,
    isLoading,
    corruptedCount,
    settings,

    // Conversation operations
    createConversation,
    getConversation,
    deleteConversation,
    updateTitle,
    updateTaskType,
    refreshConversations,

    // Message operations
    saveMessage,

    // Document operations
    attachDocument,
    removeDocument,

    // Settings
    setMemoryEnabled,
    setRetentionMode,
    updateSettings,

    // Data management
    clearAllData,
  };
}
