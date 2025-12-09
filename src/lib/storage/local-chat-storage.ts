/**
 * Local Chat Storage for ZeroTrace Mode
 * 
 * Stores encrypted messages ONLY on the user's device using IndexedDB.
 * Messages are never sent to the server when ZeroTrace mode is enabled.
 */

const DB_NAME = 'zerotrace-local-chats';
const DB_VERSION = 1;
const CONVERSATIONS_STORE = 'conversations';
const MESSAGES_STORE = 'messages';

export interface LocalConversation {
  id: string;
  encrypted_title: string;
  title_nonce: string;
  model_id: string;
  retention_days: number | null; // null = forever
  created_at: string;
  updated_at: string;
  message_count: number;
}

export interface LocalMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  encrypted_content: string;
  nonce: string;
  sequence_number: number;
  created_at: string;
}

export interface ExportedChat {
  version: '1.0';
  exported_at: string;
  encryption: {
    algorithm: 'AES-256-GCM';
    key_derivation: 'PBKDF2-SHA256';
    iterations: 100000;
  };
  conversation: LocalConversation;
  wrapped_key: {
    ciphertext: string;
    nonce: string;
  };
  messages: LocalMessage[];
}

class LocalChatStorageService {
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialize the IndexedDB database
   */
  async init(): Promise<void> {
    if (this.db) {
      console.log('[LocalChatStorage] Already initialized');
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = new Promise((resolve, reject) => {
      console.log('[LocalChatStorage] Initializing database...');
      
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[LocalChatStorage] Failed to open database:', request.error);
        this.initPromise = null;
        reject(new Error('Failed to open local chat storage'));
      };

      request.onsuccess = () => {
        this.db = request.result;
        console.log('[LocalChatStorage] ✅ Database initialized successfully');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        console.log('[LocalChatStorage] Upgrading database schema...');
        const db = (event.target as IDBOpenDBRequest).result;

        // Create conversations store
        if (!db.objectStoreNames.contains(CONVERSATIONS_STORE)) {
          const convStore = db.createObjectStore(CONVERSATIONS_STORE, { keyPath: 'id' });
          convStore.createIndex('created_at', 'created_at', { unique: false });
          convStore.createIndex('updated_at', 'updated_at', { unique: false });
          console.log('[LocalChatStorage] Created conversations store');
        }

        // Create messages store with compound index
        if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
          const msgStore = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id' });
          msgStore.createIndex('conversation_id', 'conversation_id', { unique: false });
          msgStore.createIndex('conversation_sequence', ['conversation_id', 'sequence_number'], { unique: true });
          msgStore.createIndex('created_at', 'created_at', { unique: false });
          console.log('[LocalChatStorage] Created messages store with compound index');
        }
      };
    });

    return this.initPromise;
  }

  /**
   * Ensure database is initialized before operations
   */
  private async ensureDb(): Promise<IDBDatabase> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('[LocalChatStorage] Database not initialized');
    }
    return this.db;
  }

  // ============ CONVERSATION METHODS ============

  /**
   * Create a new conversation
   */
  async createConversation(conv: LocalConversation): Promise<string> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CONVERSATIONS_STORE, 'readwrite');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      
      const request = store.add(conv);
      
      request.onsuccess = () => {
        console.log('[LocalChatStorage] Created conversation:', conv.id);
        resolve(conv.id);
      };
      
      request.onerror = () => {
        console.error('[LocalChatStorage] Failed to create conversation:', request.error);
        reject(new Error('Failed to create conversation'));
      };
    });
  }

  /**
   * Get a conversation by ID
   */
  async getConversation(id: string): Promise<LocalConversation | null> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CONVERSATIONS_STORE, 'readonly');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      
      const request = store.get(id);
      
      request.onsuccess = () => {
        resolve(request.result || null);
      };
      
      request.onerror = () => {
        console.error('[LocalChatStorage] Failed to get conversation:', request.error);
        reject(new Error('Failed to get conversation'));
      };
    });
  }

  /**
   * List all conversations, sorted by updated_at descending
   */
  async listConversations(): Promise<LocalConversation[]> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CONVERSATIONS_STORE, 'readonly');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      
      const request = store.getAll();
      
      request.onsuccess = () => {
        const conversations = request.result as LocalConversation[];
        // Sort by updated_at descending (most recent first)
        conversations.sort((a, b) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        );
        console.log('[LocalChatStorage] Listed', conversations.length, 'conversations');
        resolve(conversations);
      };
      
      request.onerror = () => {
        console.error('[LocalChatStorage] Failed to list conversations:', request.error);
        reject(new Error('Failed to list conversations'));
      };
    });
  }

  /**
   * Update a conversation
   */
  async updateConversation(id: string, updates: Partial<LocalConversation>): Promise<void> {
    const db = await this.ensureDb();
    
    return new Promise(async (resolve, reject) => {
      const existing = await this.getConversation(id);
      if (!existing) {
        reject(new Error('Conversation not found'));
        return;
      }

      const updated: LocalConversation = {
        ...existing,
        ...updates,
        id, // Ensure ID is not overwritten
        updated_at: new Date().toISOString(),
      };

      const transaction = db.transaction(CONVERSATIONS_STORE, 'readwrite');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      
      const request = store.put(updated);
      
      request.onsuccess = () => {
        console.log('[LocalChatStorage] Updated conversation:', id);
        resolve();
      };
      
      request.onerror = () => {
        console.error('[LocalChatStorage] Failed to update conversation:', request.error);
        reject(new Error('Failed to update conversation'));
      };
    });
  }

  /**
   * Delete a conversation and all its messages
   */
  async deleteConversation(id: string): Promise<void> {
    const db = await this.ensureDb();
    
    // First delete all messages
    await this.deleteMessagesForConversation(id);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(CONVERSATIONS_STORE, 'readwrite');
      const store = transaction.objectStore(CONVERSATIONS_STORE);
      
      const request = store.delete(id);
      
      request.onsuccess = () => {
        console.log('[LocalChatStorage] Deleted conversation:', id);
        resolve();
      };
      
      request.onerror = () => {
        console.error('[LocalChatStorage] Failed to delete conversation:', request.error);
        reject(new Error('Failed to delete conversation'));
      };
    });
  }

  // ============ MESSAGE METHODS ============

  /**
   * Add a message to a conversation
   */
  async addMessage(msg: LocalMessage): Promise<string> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MESSAGES_STORE, CONVERSATIONS_STORE], 'readwrite');
      const msgStore = transaction.objectStore(MESSAGES_STORE);
      const convStore = transaction.objectStore(CONVERSATIONS_STORE);
      
      // Add the message
      const msgRequest = msgStore.add(msg);
      
      msgRequest.onsuccess = () => {
        // Update conversation message_count and updated_at
        const convRequest = convStore.get(msg.conversation_id);
        
        convRequest.onsuccess = () => {
          const conv = convRequest.result as LocalConversation;
          if (conv) {
            conv.message_count = (conv.message_count || 0) + 1;
            conv.updated_at = new Date().toISOString();
            convStore.put(conv);
          }
        };
        
        console.log('[LocalChatStorage] Added message:', msg.id, 'seq:', msg.sequence_number);
        resolve(msg.id);
      };
      
      msgRequest.onerror = () => {
        console.error('[LocalChatStorage] Failed to add message:', msgRequest.error);
        reject(new Error('Failed to add message'));
      };
    });
  }

  /**
   * Get all messages for a conversation, sorted by sequence_number
   */
  async getMessages(conversationId: string): Promise<LocalMessage[]> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MESSAGES_STORE, 'readonly');
      const store = transaction.objectStore(MESSAGES_STORE);
      const index = store.index('conversation_id');
      
      const request = index.getAll(conversationId);
      
      request.onsuccess = () => {
        const messages = request.result as LocalMessage[];
        // Sort by sequence_number ascending
        messages.sort((a, b) => a.sequence_number - b.sequence_number);
        console.log('[LocalChatStorage] Retrieved', messages.length, 'messages for conversation:', conversationId);
        resolve(messages);
      };
      
      request.onerror = () => {
        console.error('[LocalChatStorage] Failed to get messages:', request.error);
        reject(new Error('Failed to get messages'));
      };
    });
  }

  /**
   * Get the next sequence number for a conversation
   */
  async getNextSequenceNumber(conversationId: string): Promise<number> {
    const messages = await this.getMessages(conversationId);
    if (messages.length === 0) {
      return 1;
    }
    const maxSeq = Math.max(...messages.map(m => m.sequence_number));
    return maxSeq + 1;
  }

  /**
   * Delete all messages for a conversation
   */
  async deleteMessagesForConversation(conversationId: string): Promise<void> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(MESSAGES_STORE, 'readwrite');
      const store = transaction.objectStore(MESSAGES_STORE);
      const index = store.index('conversation_id');
      
      const request = index.openCursor(conversationId);
      let deletedCount = 0;
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          console.log('[LocalChatStorage] Deleted', deletedCount, 'messages for conversation:', conversationId);
          resolve();
        }
      };
      
      request.onerror = () => {
        console.error('[LocalChatStorage] Failed to delete messages:', request.error);
        reject(new Error('Failed to delete messages'));
      };
    });
  }

  // ============ RETENTION CLEANUP ============

  /**
   * Clean up expired conversations based on their individual retention settings
   * @returns Number of deleted conversations and messages
   */
  async cleanupExpiredContent(): Promise<{ conversationsDeleted: number; messagesDeleted: number }> {
    const now = Date.now();
    let conversationsDeleted = 0;
    let messagesDeleted = 0;
    
    try {
      const conversations = await this.listConversations();
      
      for (const conv of conversations) {
        // null retention_days = forever - skip
        if (conv.retention_days === null) continue;
        
        const createdAt = new Date(conv.created_at).getTime();
        const expiryTime = createdAt + (conv.retention_days * 24 * 60 * 60 * 1000);
        
        if (now > expiryTime) {
          const msgCount = conv.message_count || 0;
          await this.deleteConversation(conv.id);
          conversationsDeleted++;
          messagesDeleted += msgCount;
          console.log('[LocalChatStorage] Deleted expired conversation:', conv.id, 
            `(${conv.retention_days} day retention, created ${conv.created_at})`);
        }
      }
      
      console.log('[LocalChatStorage] Cleanup complete:', 
        conversationsDeleted, 'conversations,', messagesDeleted, 'messages deleted');
      
      return { conversationsDeleted, messagesDeleted };
    } catch (error) {
      console.error('[LocalChatStorage] Error during cleanup:', error);
      return { conversationsDeleted, messagesDeleted };
    }
  }

  /**
   * Clean up messages older than retention period (legacy method)
   * @param retentionDays Number of days to retain messages
   * @returns Number of deleted messages
   */
  async cleanupExpiredMessages(retentionDays: number): Promise<number> {
    const db = await this.ensureDb();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    const cutoffIso = cutoffDate.toISOString();
    
    console.log('[LocalChatStorage] Cleaning up messages older than:', cutoffIso);
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([MESSAGES_STORE, CONVERSATIONS_STORE], 'readwrite');
      const msgStore = transaction.objectStore(MESSAGES_STORE);
      const convStore = transaction.objectStore(CONVERSATIONS_STORE);
      
      let deletedCount = 0;
      const affectedConversations = new Set<string>();
      
      const request = msgStore.openCursor();
      
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          const msg = cursor.value as LocalMessage;
          if (msg.created_at < cutoffIso) {
            cursor.delete();
            deletedCount++;
            affectedConversations.add(msg.conversation_id);
          }
          cursor.continue();
        } else {
          // Update message counts for affected conversations
          affectedConversations.forEach(async (convId) => {
            const convRequest = convStore.get(convId);
            convRequest.onsuccess = () => {
              const conv = convRequest.result as LocalConversation;
              if (conv) {
                // Recount messages
                const countRequest = msgStore.index('conversation_id').count(convId);
                countRequest.onsuccess = () => {
                  conv.message_count = countRequest.result;
                  conv.updated_at = new Date().toISOString();
                  convStore.put(conv);
                };
              }
            };
          });
          
          console.log('[LocalChatStorage] Cleaned up', deletedCount, 'expired messages');
          resolve(deletedCount);
        }
      };
      
      request.onerror = () => {
        console.error('[LocalChatStorage] Failed to cleanup messages:', request.error);
        reject(new Error('Failed to cleanup expired messages'));
      };
    });
  }

  // ============ EXPORT/IMPORT ============

  /**
   * Export a conversation with all messages for backup
   * Note: wrapped_key must be provided by the caller from the key storage
   */
  async exportConversation(conversationId: string, wrappedKey: { ciphertext: string; nonce: string }): Promise<ExportedChat> {
    const conversation = await this.getConversation(conversationId);
    if (!conversation) {
      throw new Error('Conversation not found');
    }
    
    const messages = await this.getMessages(conversationId);
    
    const exportData: ExportedChat = {
      version: '1.0',
      exported_at: new Date().toISOString(),
      encryption: {
        algorithm: 'AES-256-GCM',
        key_derivation: 'PBKDF2-SHA256',
        iterations: 100000,
      },
      conversation,
      wrapped_key: wrappedKey,
      messages,
    };
    
    console.log('[LocalChatStorage] Exported conversation:', conversationId, 'with', messages.length, 'messages');
    return exportData;
  }

  /**
   * Import a conversation from backup
   * Note: Key import must be handled separately by the key storage
   * @returns The imported conversation ID
   */
  async importConversation(data: ExportedChat): Promise<string> {
    if (data.version !== '1.0') {
      throw new Error(`Unsupported export version: ${data.version}`);
    }
    
    // Check if conversation already exists
    const existing = await this.getConversation(data.conversation.id);
    if (existing) {
      throw new Error('Conversation already exists. Delete it first to import.');
    }
    
    // Create conversation
    await this.createConversation({
      ...data.conversation,
      message_count: 0, // Will be updated as messages are added
      updated_at: new Date().toISOString(),
    });
    
    // Add all messages
    for (const msg of data.messages) {
      await this.addMessage(msg);
    }
    
    console.log('[LocalChatStorage] Imported conversation:', data.conversation.id, 'with', data.messages.length, 'messages');
    return data.conversation.id;
  }

  /**
   * Clear all local data (for logout or reset)
   */
  async clearAll(): Promise<void> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE, MESSAGES_STORE], 'readwrite');
      
      const convClear = transaction.objectStore(CONVERSATIONS_STORE).clear();
      const msgClear = transaction.objectStore(MESSAGES_STORE).clear();
      
      transaction.oncomplete = () => {
        console.log('[LocalChatStorage] Cleared all local data');
        resolve();
      };
      
      transaction.onerror = () => {
        console.error('[LocalChatStorage] Failed to clear data:', transaction.error);
        reject(new Error('Failed to clear local storage'));
      };
    });
  }

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{ conversationCount: number; messageCount: number }> {
    const db = await this.ensureDb();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction([CONVERSATIONS_STORE, MESSAGES_STORE], 'readonly');
      
      let conversationCount = 0;
      let messageCount = 0;
      
      const convCount = transaction.objectStore(CONVERSATIONS_STORE).count();
      convCount.onsuccess = () => {
        conversationCount = convCount.result;
      };
      
      const msgCount = transaction.objectStore(MESSAGES_STORE).count();
      msgCount.onsuccess = () => {
        messageCount = msgCount.result;
      };
      
      transaction.oncomplete = () => {
        console.log('[LocalChatStorage] Stats:', { conversationCount, messageCount });
        resolve({ conversationCount, messageCount });
      };
      
      transaction.onerror = () => {
        reject(new Error('Failed to get stats'));
      };
    });
  }
}

// Export as singleton
export const localChatStorage = new LocalChatStorageService();
