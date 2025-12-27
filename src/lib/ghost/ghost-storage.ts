/**
 * Ghost Storage Manager - Two-Tier Venice-Style Architecture
 * 
 * TIER 1 (Hot Storage): JavaScript Map for in-memory decrypted conversations
 * - All UI reads/writes go here first
 * - Instant access, no encryption overhead
 * 
 * TIER 2 (Cold Storage): IndexedDB with encrypted data at rest
 * - Persists between sessions
 * - Uses zerotrace-crypto.ts for AES-256-GCM encryption
 * - Debounced writes (500ms after last change)
 */

import { 
  encrypt, 
  decrypt, 
  generateNonce, 
  arrayBufferToBase64,
  base64ToArrayBuffer,
  type EncryptedData 
} from '../crypto/zerotrace-crypto';

// ==========================================
// TYPES
// ==========================================

export interface GhostMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface GhostConversation {
  id: string;
  title: string;
  messages: GhostMessage[];
  createdAt: number;
  updatedAt: number;
  isTemporary?: boolean; // If true, won't be persisted to IndexedDB
  folderId?: string; // Optional folder assignment
}

interface EncryptedConversation {
  id: string;
  encryptedData: EncryptedData;
  createdAt: number;
  updatedAt: number;
}

interface ExportedGhostFile {
  version: 1;
  format: 'svghost';
  exportedAt: number;
  conversation: EncryptedData;
  metadata: {
    title: string;
    messageCount: number;
    createdAt: number;
    updatedAt: number;
  };
}

// ==========================================
// CONSTANTS
// ==========================================

const DB_NAME = 'ghost-chat-storage';
const DB_VERSION = 2; // Incremented to trigger migration for stable key derivation
const STORE_NAME = 'conversations';
const DEBOUNCE_MS = 500;

// ==========================================
// GHOST STORAGE MANAGER
// ==========================================

export class GhostStorageManager {
  private hotStore: Map<string, GhostConversation> = new Map();
  private db: IDBDatabase | null = null;
  private masterKey: CryptoKey | null = null;
  private saveTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private initialized = false;
  private corruptedCount = 0; // Track conversations that failed to decrypt

  /**
   * Initialize the storage manager with user's master key
   * Loads and decrypts all conversations from IndexedDB into hot storage
   */
  async init(masterKey: CryptoKey): Promise<void> {
    if (this.initialized) {
      console.warn('GhostStorageManager already initialized');
      return;
    }

    this.masterKey = masterKey;
    this.db = await this.openDatabase();
    await this.loadAllConversations();
    this.initialized = true;
  }

  /**
   * Check if storage manager is initialized
   */
  isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Open IndexedDB database
   */
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
        }
      };
    });
  }

  /**
   * Load all conversations from IndexedDB and decrypt into hot storage
   */
  private async loadAllConversations(): Promise<void> {
    if (!this.db || !this.masterKey) return;

    this.corruptedCount = 0; // Reset count on each load
    const encryptedConvos = await this.getAllFromIndexedDB();
    
    for (const encrypted of encryptedConvos) {
      try {
        const decrypted = await this.decryptConversation(encrypted);
        this.hotStore.set(decrypted.id, decrypted);
      } catch (error) {
        console.error(`Failed to decrypt conversation ${encrypted.id}:`, error);
        this.corruptedCount++; // Increment corrupted count
        // Skip corrupted conversations
      }
    }
  }

  /**
   * Get the number of conversations that failed to decrypt
   */
  getCorruptedCount(): number {
    return this.corruptedCount;
  }

  /**
   * Get all encrypted conversations from IndexedDB
   */
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

  /**
   * Decrypt an encrypted conversation
   */
  private async decryptConversation(encrypted: EncryptedConversation): Promise<GhostConversation> {
    if (!this.masterKey) throw new Error('Master key not set');

    const decrypted = await decrypt(encrypted.encryptedData, this.masterKey);
    const parsed = JSON.parse(decrypted);

    return {
      id: encrypted.id,
      title: parsed.title,
      messages: parsed.messages,
      createdAt: encrypted.createdAt,
      updatedAt: encrypted.updatedAt,
      folderId: parsed.folderId
    };
  }

  /**
   * Encrypt a conversation for cold storage
   */
  private async encryptConversation(conversation: GhostConversation): Promise<EncryptedConversation> {
    if (!this.masterKey) throw new Error('Master key not set');

    const payload = JSON.stringify({
      title: conversation.title,
      messages: conversation.messages,
      folderId: conversation.folderId
    });

    const encryptedData = await encrypt(payload, this.masterKey);

    return {
      id: conversation.id,
      encryptedData,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt
    };
  }

  /**
   * Create a new conversation
   * Returns the conversation ID
   * @param title - Conversation title
   * @param isTemporary - If true, conversation won't be persisted to IndexedDB
   */
  createConversation(title: string = 'New Ghost Chat', isTemporary: boolean = false): string {
    const id = crypto.randomUUID();
    const now = Date.now();

    const conversation: GhostConversation = {
      id,
      title,
      messages: [],
      createdAt: now,
      updatedAt: now,
      isTemporary
    };

    this.hotStore.set(id, conversation);
    
    // Only persist if not temporary
    if (!isTemporary) {
      this.schedulePersist(id);
    }

    return id;
  }

  /**
   * Save a message to a conversation
   * Adds to hot store immediately, debounces persist to IndexedDB (unless temporary)
   */
  saveMessage(convId: string, role: 'user' | 'assistant', content: string): GhostMessage {
    const conversation = this.hotStore.get(convId);
    if (!conversation) {
      throw new Error(`Conversation ${convId} not found`);
    }

    const message: GhostMessage = {
      id: crypto.randomUUID(),
      role,
      content,
      timestamp: Date.now()
    };

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();

    // Auto-generate title from first user message
    if (conversation.messages.length === 1 && role === 'user') {
      conversation.title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
    }

    // Only persist if not temporary
    if (!conversation.isTemporary) {
      this.schedulePersist(convId);
    }

    return message;
  }

  /**
   * Update conversation title
   */
  updateTitle(convId: string, title: string): boolean {
    const conversation = this.hotStore.get(convId);
    if (!conversation) {
      console.warn(`[GhostStorage] updateTitle: Conversation ${convId} not found`);
      return false;
    }

    conversation.title = title;
    conversation.updatedAt = Date.now();

    // Only persist if not temporary
    if (!conversation.isTemporary) {
      // Title changes are small but important; persist immediately to survive rapid refreshes.
      this.persistNow(convId);
    }
    return true;
  }

  /**
   * Convert a temporary conversation to persistent
   */
  makeConversationPersistent(convId: string): void {
    const conversation = this.hotStore.get(convId);
    if (!conversation) {
      throw new Error(`Conversation ${convId} not found`);
    }

    if (conversation.isTemporary) {
      conversation.isTemporary = false;
      this.schedulePersist(convId);
    }
  }

  /**
   * Get a conversation from hot storage (instant)
   */
  getConversation(convId: string): GhostConversation | undefined {
    return this.hotStore.get(convId);
  }

  /**
   * List all conversations (metadata only, from hot storage)
   */
  listConversations(): { id: string; title: string; updatedAt: number; messageCount: number; folderId?: string }[] {
    const conversations = Array.from(this.hotStore.values());

    return conversations
      .map(conv => ({
        id: conv.id,
        title: conv.title,
        updatedAt: conv.updatedAt,
        messageCount: conv.messages.length,
        folderId: conv.folderId
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  /**
   * Move a conversation to a folder (or remove from folder if folderId is null)
   */
  moveToFolder(convId: string, folderId: string | null): boolean {
    const conversation = this.hotStore.get(convId);
    if (!conversation) {
      console.warn(`[GhostStorage] moveToFolder: Conversation ${convId} not found`);
      return false;
    }

    conversation.folderId = folderId || undefined;
    conversation.updatedAt = Date.now();

    // Only persist if not temporary
    if (!conversation.isTemporary) {
      // Folder moves should persist immediately to survive rapid refreshes.
      this.persistNow(convId);
    }
    return true;
  }

  /**
   * Delete a conversation from both tiers
   */
  async deleteConversation(convId: string): Promise<void> {
    // Cancel any pending persist
    const timeout = this.saveTimeouts.get(convId);
    if (timeout) {
      clearTimeout(timeout);
      this.saveTimeouts.delete(convId);
    }

    // Remove from hot storage
    this.hotStore.delete(convId);

    // Remove from cold storage
    if (this.db) {
      await this.deleteFromIndexedDB(convId);
    }
  }

  /**
   * Delete from IndexedDB
   */
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

  /**
   * Export a conversation as encrypted .svghost blob
   */
  async exportConversation(convId: string): Promise<Blob> {
    if (!this.masterKey) throw new Error('Master key not set');

    const conversation = this.hotStore.get(convId);
    if (!conversation) {
      throw new Error(`Conversation ${convId} not found`);
    }

    const payload = JSON.stringify(conversation);
    const encryptedConversation = await encrypt(payload, this.masterKey);

    const exportData: ExportedGhostFile = {
      version: 1,
      format: 'svghost',
      exportedAt: Date.now(),
      conversation: encryptedConversation,
      metadata: {
        title: conversation.title,
        messageCount: conversation.messages.length,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt
      }
    };

    return new Blob([JSON.stringify(exportData)], { type: 'application/json' });
  }

  /**
   * Import a conversation from encrypted .svghost blob
   * Returns the new conversation ID
   */
  async importConversation(blob: Blob): Promise<string> {
    if (!this.masterKey) throw new Error('Master key not set');

    const text = await blob.text();
    const exportData: ExportedGhostFile = JSON.parse(text);

    // Validate format
    if (exportData.format !== 'svghost' || exportData.version !== 1) {
      throw new Error('Invalid Ghost Chat export file');
    }

    // Decrypt conversation
    const decrypted = await decrypt(exportData.conversation, this.masterKey);
    const conversation: GhostConversation = JSON.parse(decrypted);

    // Generate new ID to avoid conflicts
    const newId = crypto.randomUUID();
    const now = Date.now();

    const importedConversation: GhostConversation = {
      ...conversation,
      id: newId,
      title: `${conversation.title} (Imported)`,
      updatedAt: now
    };

    this.hotStore.set(newId, importedConversation);
    this.schedulePersist(newId);

    return newId;
  }

  /**
   * Schedule persist to IndexedDB with debouncing
   * Waits 500ms after last change before writing
   */
  private schedulePersist(convId: string): void {
    // Cancel existing timeout for this conversation
    const existingTimeout = this.saveTimeouts.get(convId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule new persist
    const timeout = setTimeout(async () => {
      try {
        await this.persistToIndexedDB(convId);
        this.saveTimeouts.delete(convId);
      } catch (error) {
        console.error(`Failed to persist conversation ${convId}:`, error);
      }
    }, DEBOUNCE_MS);

    this.saveTimeouts.set(convId, timeout);
  }

  /**
   * Persist immediately (best-effort) to survive rapid refreshes.
   * Cancels any pending debounced write for this conversation.
   */
  private persistNow(convId: string): void {
    const existingTimeout = this.saveTimeouts.get(convId);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
      this.saveTimeouts.delete(convId);
    }

    // Fire-and-forget: IndexedDB put is async but usually completes quickly.
    void this.persistToIndexedDB(convId);
  }

  /**
   * Persist a conversation to IndexedDB
   */
  private async persistToIndexedDB(convId: string): Promise<void> {
    if (!this.db || !this.masterKey) return;

    const conversation = this.hotStore.get(convId);
    if (!conversation) return;

    const encrypted = await this.encryptConversation(conversation);

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(encrypted);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve();
    });
  }

  /**
   * Force persist all pending changes immediately
   */
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

  /**
   * Clear all data and reset (for logout)
   */
  async destroy(): Promise<void> {
    // Cancel all pending persists
    for (const timeout of this.saveTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.saveTimeouts.clear();

    // Clear hot storage
    this.hotStore.clear();

    // Clear cold storage
    if (this.db) {
      await this.clearIndexedDB();
      this.db.close();
      this.db = null;
    }

    this.masterKey = null;
    this.initialized = false;
  }

  /**
   * Clear all data from IndexedDB
   */
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

  /**
   * Clear all conversations (for recovery from corrupted data)
   */
  async clearAllConversations(): Promise<void> {
    // Cancel all pending persists
    for (const timeout of this.saveTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.saveTimeouts.clear();

    // Clear hot storage
    this.hotStore.clear();

    // Clear cold storage
    if (this.db) {
      await this.clearIndexedDB();
    }

    this.corruptedCount = 0;
  }

  /**
   * Get conversation count
   */
  getConversationCount(): number {
    return this.hotStore.size;
  }

  /**
   * Check if a conversation exists
   */
  hasConversation(convId: string): boolean {
    return this.hotStore.has(convId);
  }
}

// Singleton instance
let ghostStorageInstance: GhostStorageManager | null = null;

export function getGhostStorage(): GhostStorageManager {
  if (!ghostStorageInstance) {
    ghostStorageInstance = new GhostStorageManager();
  }
  return ghostStorageInstance;
}

export function resetGhostStorage(): void {
  if (ghostStorageInstance) {
    ghostStorageInstance.destroy();
    ghostStorageInstance = null;
  }
}
