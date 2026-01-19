/**
 * Health Storage Manager - Encrypted Local Storage for Healthcare Data
 *
 * Three retention modes:
 * - forever: Data persists indefinitely (encrypted in IndexedDB)
 * - 90days: Data auto-expires after 90 days
 * - zerotrace: Data deleted when browser closes (memory only)
 *
 * Uses same encryption pattern as Ghost Storage (AES-256-GCM)
 */

import {
  encrypt,
  decrypt,
  type EncryptedData
} from '../crypto/zerotrace-crypto';

// ==========================================
// TYPES
// ==========================================

export type RetentionMode = 'forever' | '90days' | 'zerotrace';

export interface HealthMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  toolCalls?: Array<{
    tool: string;
    input: Record<string, any>;
    output: any;
    success: boolean;
  }>;
  metadata?: Record<string, any>;
}

export interface AttachedDocument {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  content: string; // Base64 encoded for binary, plain text for text files
  uploadedAt: number;
  extractedText?: string; // For PDFs/images after OCR
}

export interface HealthConversation {
  id: string;
  title: string;
  messages: HealthMessage[];
  documents: AttachedDocument[];
  taskType: string;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number; // For 90days mode
  retentionMode: RetentionMode;
  memoryEnabled: boolean;
}

interface EncryptedConversation {
  id: string;
  encryptedData: EncryptedData;
  createdAt: number;
  updatedAt: number;
  expiresAt?: number;
}

export interface HealthSettings {
  defaultRetentionMode: RetentionMode;
  memoryEnabled: boolean;
  showDisclaimer: boolean;
  preferredTaskType: string;
}

export const DEFAULT_HEALTH_SETTINGS: HealthSettings = {
  defaultRetentionMode: '90days',
  memoryEnabled: true,
  showDisclaimer: true,
  preferredTaskType: 'general_query'
};

// ==========================================
// CONSTANTS
// ==========================================

const DB_NAME = 'vault-health-storage';
const DB_VERSION = 1;
const STORE_NAME = 'conversations';
const SETTINGS_STORE = 'settings';
const DEBOUNCE_MS = 500;
const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

// ==========================================
// HEALTH STORAGE MANAGER
// ==========================================

export class HealthStorageManager {
  private hotStore: Map<string, HealthConversation> = new Map();
  private db: IDBDatabase | null = null;
  private masterKey: CryptoKey | null = null;
  private saveTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private initialized = false;
  private corruptedCount = 0;
  private cachedSettings: HealthSettings | null = null;

  /**
   * Initialize the storage manager with user's master key
   */
  async init(masterKey: CryptoKey): Promise<void> {
    if (this.initialized) {
      console.warn('[HealthStorage] Already initialized');
      return;
    }

    this.masterKey = masterKey;
    this.db = await this.openDatabase();
    await this.loadAllConversations();
    await this.cleanupExpired();
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  private openDatabase(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('updatedAt', 'updatedAt', { unique: false });
          store.createIndex('expiresAt', 'expiresAt', { unique: false });
        }

        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: 'id' });
        }
      };
    });
  }

  /**
   * Load all conversations from IndexedDB and decrypt
   */
  private async loadAllConversations(): Promise<void> {
    if (!this.db || !this.masterKey) return;

    this.corruptedCount = 0;
    const encryptedConvos = await this.getAllFromIndexedDB();

    for (const encrypted of encryptedConvos) {
      try {
        const decrypted = await this.decryptConversation(encrypted);
        // Only load non-zerotrace conversations (zerotrace never persisted)
        if (decrypted.retentionMode !== 'zerotrace') {
          this.hotStore.set(decrypted.id, decrypted);
        }
      } catch (error) {
        console.error(`[HealthStorage] Failed to decrypt ${encrypted.id}:`, error);
        this.corruptedCount++;
      }
    }
  }

  /**
   * Clean up expired conversations (90days mode)
   */
  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [id, conv] of this.hotStore.entries()) {
      if (conv.expiresAt && conv.expiresAt < now) {
        toDelete.push(id);
      }
    }

    for (const id of toDelete) {
      await this.deleteConversation(id);
      console.log(`[HealthStorage] Cleaned up expired conversation: ${id}`);
    }
  }

  getCorruptedCount(): number {
    return this.corruptedCount;
  }

  private getAllFromIndexedDB(): Promise<EncryptedConversation[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve([]);
        return;
      }

      const transaction = this.db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || []);
    });
  }

  private async decryptConversation(encrypted: EncryptedConversation): Promise<HealthConversation> {
    if (!this.masterKey) throw new Error('Master key not set');

    const decrypted = await decrypt(encrypted.encryptedData, this.masterKey);
    const parsed = JSON.parse(decrypted);

    return {
      id: encrypted.id,
      title: parsed.title,
      messages: parsed.messages || [],
      documents: parsed.documents || [],
      taskType: parsed.taskType || 'general_query',
      createdAt: encrypted.createdAt,
      updatedAt: encrypted.updatedAt,
      expiresAt: encrypted.expiresAt,
      retentionMode: parsed.retentionMode || '90days',
      memoryEnabled: parsed.memoryEnabled ?? true
    };
  }

  private async encryptConversation(conversation: HealthConversation): Promise<EncryptedConversation> {
    if (!this.masterKey) throw new Error('Master key not set');

    const payload = JSON.stringify({
      title: conversation.title,
      messages: conversation.messages,
      documents: conversation.documents,
      taskType: conversation.taskType,
      retentionMode: conversation.retentionMode,
      memoryEnabled: conversation.memoryEnabled
    });

    const encryptedData = await encrypt(payload, this.masterKey);

    return {
      id: conversation.id,
      encryptedData,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
      expiresAt: conversation.expiresAt
    };
  }

  /**
   * Create a new health conversation
   */
  createConversation(
    title: string = 'New Health Session',
    retentionMode: RetentionMode = '90days',
    memoryEnabled: boolean = true,
    taskType: string = 'general_query'
  ): string {
    const id = crypto.randomUUID();
    const now = Date.now();

    const conversation: HealthConversation = {
      id,
      title,
      messages: [],
      documents: [],
      taskType,
      createdAt: now,
      updatedAt: now,
      expiresAt: retentionMode === '90days' ? now + NINETY_DAYS_MS : undefined,
      retentionMode,
      memoryEnabled
    };

    this.hotStore.set(id, conversation);

    // Only persist non-zerotrace
    if (retentionMode !== 'zerotrace') {
      this.schedulePersist(id);
    }

    return id;
  }

  /**
   * Save a message to a conversation
   */
  saveMessage(
    convId: string,
    role: 'user' | 'assistant',
    content: string,
    toolCalls?: HealthMessage['toolCalls'],
    metadata?: Record<string, any>
  ): HealthMessage {
    const conversation = this.hotStore.get(convId);
    if (!conversation) {
      throw new Error(`Conversation ${convId} not found`);
    }

    const message: HealthMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now(),
      ...(toolCalls && toolCalls.length > 0 ? { toolCalls } : {}),
      ...(metadata && Object.keys(metadata).length > 0 ? { metadata } : {}),
    };

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();

    // Auto-generate title from first user message
    if (conversation.messages.length === 1 && role === 'user') {
      conversation.title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
    }

    // Extend expiration on activity for 90days mode
    if (conversation.retentionMode === '90days') {
      conversation.expiresAt = Date.now() + NINETY_DAYS_MS;
    }

    if (conversation.retentionMode !== 'zerotrace') {
      this.schedulePersist(convId);
    }

    return message;
  }

  /**
   * Attach a document to a conversation
   */
  attachDocument(
    convId: string,
    filename: string,
    mimeType: string,
    content: string,
    size: number,
    extractedText?: string
  ): AttachedDocument {
    const conversation = this.hotStore.get(convId);
    if (!conversation) {
      throw new Error(`Conversation ${convId} not found`);
    }

    const doc: AttachedDocument = {
      id: crypto.randomUUID(),
      filename,
      mimeType,
      size,
      content,
      uploadedAt: Date.now(),
      extractedText
    };

    conversation.documents.push(doc);
    conversation.updatedAt = Date.now();

    if (conversation.retentionMode !== 'zerotrace') {
      this.schedulePersist(convId);
    }

    return doc;
  }

  /**
   * Remove a document from a conversation
   */
  removeDocument(convId: string, docId: string): boolean {
    const conversation = this.hotStore.get(convId);
    if (!conversation) return false;

    const idx = conversation.documents.findIndex(d => d.id === docId);
    if (idx === -1) return false;

    conversation.documents.splice(idx, 1);
    conversation.updatedAt = Date.now();

    if (conversation.retentionMode !== 'zerotrace') {
      this.schedulePersist(convId);
    }

    return true;
  }

  /**
   * Update conversation title
   */
  updateTitle(convId: string, title: string): boolean {
    const conversation = this.hotStore.get(convId);
    if (!conversation) return false;

    conversation.title = title;
    conversation.updatedAt = Date.now();

    if (conversation.retentionMode !== 'zerotrace') {
      this.persistNow(convId);
    }
    return true;
  }

  /**
   * Update task type for a conversation
   */
  updateTaskType(convId: string, taskType: string): boolean {
    const conversation = this.hotStore.get(convId);
    if (!conversation) return false;

    conversation.taskType = taskType;
    conversation.updatedAt = Date.now();

    if (conversation.retentionMode !== 'zerotrace') {
      this.schedulePersist(convId);
    }
    return true;
  }

  /**
   * Toggle memory for a conversation
   */
  setMemoryEnabled(convId: string, enabled: boolean): boolean {
    const conversation = this.hotStore.get(convId);
    if (!conversation) return false;

    conversation.memoryEnabled = enabled;
    conversation.updatedAt = Date.now();

    if (conversation.retentionMode !== 'zerotrace') {
      this.schedulePersist(convId);
    }
    return true;
  }

  /**
   * Change retention mode (converts between modes)
   */
  setRetentionMode(convId: string, mode: RetentionMode): boolean {
    const conversation = this.hotStore.get(convId);
    if (!conversation) return false;

    const oldMode = conversation.retentionMode;
    conversation.retentionMode = mode;
    conversation.updatedAt = Date.now();

    // Handle expiration
    if (mode === '90days') {
      conversation.expiresAt = Date.now() + NINETY_DAYS_MS;
    } else {
      conversation.expiresAt = undefined;
    }

    // If changing TO zerotrace, delete from IndexedDB
    if (mode === 'zerotrace' && oldMode !== 'zerotrace') {
      this.deleteFromIndexedDB(convId);
    }
    // If changing FROM zerotrace, persist to IndexedDB
    else if (mode !== 'zerotrace' && oldMode === 'zerotrace') {
      this.schedulePersist(convId);
    }
    // Otherwise just update
    else if (mode !== 'zerotrace') {
      this.schedulePersist(convId);
    }

    return true;
  }

  getConversation(convId: string): HealthConversation | undefined {
    return this.hotStore.get(convId);
  }

  listConversations(): Array<{
    id: string;
    title: string;
    updatedAt: number;
    messageCount: number;
    documentCount: number;
    taskType: string;
    retentionMode: RetentionMode;
  }> {
    return Array.from(this.hotStore.values())
      .map(conv => ({
        id: conv.id,
        title: conv.title,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages.length,
        documentCount: conv.documents.length,
        taskType: conv.taskType,
        retentionMode: conv.retentionMode
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async deleteConversation(convId: string): Promise<void> {
    const timeout = this.saveTimeouts.get(convId);
    if (timeout) {
      clearTimeout(timeout);
      this.saveTimeouts.delete(convId);
    }

    this.hotStore.delete(convId);

    if (this.db) {
      await this.deleteFromIndexedDB(convId);
    }
  }

  /**
   * Clear all zerotrace conversations (called on browser close)
   */
  clearAllZerotrace(): void {
    for (const [id, conv] of this.hotStore.entries()) {
      if (conv.retentionMode === 'zerotrace') {
        const timeout = this.saveTimeouts.get(id);
        if (timeout) {
          clearTimeout(timeout);
          this.saveTimeouts.delete(id);
        }
        this.hotStore.delete(id);
      }
    }
  }

  private deleteFromIndexedDB(convId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(convId);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private schedulePersist(convId: string): void {
    const existingTimeout = this.saveTimeouts.get(convId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    const timeout = setTimeout(async () => {
      try {
        await this.persistToIndexedDB(convId);
        this.saveTimeouts.delete(convId);
      } catch (error) {
        console.error(`[HealthStorage] Failed to persist ${convId}:`, error);
      }
    }, DEBOUNCE_MS);

    this.saveTimeouts.set(convId, timeout);
  }

  private persistNow(convId: string): void {
    const existingTimeout = this.saveTimeouts.get(convId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.saveTimeouts.delete(convId);
    }
    void this.persistToIndexedDB(convId);
  }

  private async persistToIndexedDB(convId: string): Promise<void> {
    if (!this.db || !this.masterKey) return;

    const conversation = this.hotStore.get(convId);
    if (!conversation || conversation.retentionMode === 'zerotrace') return;

    const encrypted = await this.encryptConversation(conversation);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(encrypted);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  async flushPendingWrites(): Promise<void> {
    const pendingIds = Array.from(this.saveTimeouts.keys());

    for (const convId of pendingIds) {
      const timeout = this.saveTimeouts.get(convId);
      if (timeout) {
        clearTimeout(timeout);
        this.saveTimeouts.delete(convId);
      }
      await this.persistToIndexedDB(convId);
    }
  }

  async destroy(): Promise<void> {
    console.log('[HealthStorage] Destroying...');

    for (const timeout of this.saveTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.saveTimeouts.clear();
    this.hotStore.clear();

    if (this.db) {
      this.db.close();
      this.db = null;
    }

    this.masterKey = null;
    this.initialized = false;
    this.cachedSettings = null;
  }

  async wipeAllData(): Promise<void> {
    console.log('[HealthStorage] Wiping all data...');

    for (const timeout of this.saveTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.saveTimeouts.clear();
    this.hotStore.clear();

    if (this.db) {
      await this.clearIndexedDB();
      this.db.close();
      this.db = null;
    }

    this.masterKey = null;
    this.initialized = false;
    this.cachedSettings = null;
    this.corruptedCount = 0;
  }

  private clearIndexedDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      const transaction = this.db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  // ==========================================
  // SETTINGS
  // ==========================================

  async getSettings(): Promise<HealthSettings> {
    if (this.cachedSettings) return this.cachedSettings;

    try {
      const record = await this.getSettingsFromIndexedDB();
      if (record && this.masterKey) {
        const decrypted = await decrypt(record.encryptedData, this.masterKey);
        this.cachedSettings = { ...DEFAULT_HEALTH_SETTINGS, ...JSON.parse(decrypted) };
        return this.cachedSettings;
      }
    } catch (e) {
      console.warn('[HealthStorage] Failed to load settings:', e);
    }

    return { ...DEFAULT_HEALTH_SETTINGS };
  }

  async saveSettings(updates: Partial<HealthSettings>): Promise<void> {
    if (!this.masterKey || !this.db) {
      console.warn('[HealthStorage] Cannot save settings: not initialized');
      return;
    }

    this.cachedSettings = { ...DEFAULT_HEALTH_SETTINGS, ...this.cachedSettings, ...updates };

    const payload = JSON.stringify(this.cachedSettings);
    const encryptedData = await encrypt(payload, this.masterKey);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(SETTINGS_STORE, 'readwrite');
      const store = transaction.objectStore(SETTINGS_STORE);
      const request = store.put({ id: 'health-settings', encryptedData, updatedAt: Date.now() });

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  private getSettingsFromIndexedDB(): Promise<{ encryptedData: EncryptedData; updatedAt: number } | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve(null);
        return;
      }

      const transaction = this.db.transaction(SETTINGS_STORE, 'readonly');
      const store = transaction.objectStore(SETTINGS_STORE);
      const request = store.get('health-settings');

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result || null);
    });
  }
}

// Singleton instance
let healthStorageInstance: HealthStorageManager | null = null;

export function getHealthStorage(): HealthStorageManager {
  if (!healthStorageInstance) {
    healthStorageInstance = new HealthStorageManager();
  }
  return healthStorageInstance;
}

export function resetHealthStorage(): void {
  if (healthStorageInstance) {
    healthStorageInstance.destroy();
    healthStorageInstance = null;
  }
}

export async function resetHealthStorageAsync(): Promise<void> {
  if (healthStorageInstance) {
    healthStorageInstance.clearAllZerotrace();
    await healthStorageInstance.destroy();
    healthStorageInstance = null;
  }
}

export async function wipeHealthStorageAsync(): Promise<void> {
  if (healthStorageInstance) {
    await healthStorageInstance.wipeAllData();
    healthStorageInstance = null;
  }
}
