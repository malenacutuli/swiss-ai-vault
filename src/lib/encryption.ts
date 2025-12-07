/**
 * SwissVault Vault Chat - Enterprise Encryption
 * Web Crypto API with AES-256-GCM
 */

export interface EncryptionKey {
  conversationId: string;
  key: CryptoKey;
  keyHash: string;
  createdAt: number;
  version: number;
}

export class ChatEncryptionError extends Error {
  constructor(
    message: string,
    public code: 'ENCRYPTION_FAILED' | 'DECRYPTION_FAILED' | 'KEY_NOT_FOUND' | 'STORAGE_ERROR'
  ) {
    super(message);
    this.name = 'ChatEncryptionError';
  }
}

export class ChatEncryption {
  private dbName = 'swissvault-vault-chat-keys';
  private storeName = 'encryption-keys';
  private db: IDBDatabase | null = null;
  private readonly ALGORITHM = 'AES-GCM';
  private readonly KEY_SIZE = 256;
  private readonly IV_SIZE = 12;
  private readonly TAG_SIZE = 128;
  private readonly VERSION = 1;

  async initialize(): Promise<void> {
    if (this.db) return;
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onerror = () => reject(new ChatEncryptionError(`IndexedDB error: ${request.error?.message}`, 'STORAGE_ERROR'));
      request.onsuccess = () => {
        this.db = request.result;
        console.log('[Vault Chat Encryption] ✅ Initialized with AES-256-GCM');
        resolve();
      };
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'conversationId' });
          store.createIndex('createdAt', 'createdAt', { unique: false });
        }
      };
    });
  }

  async generateKey(): Promise<CryptoKey> {
    try {
      return await crypto.subtle.generateKey(
        { name: this.ALGORITHM, length: this.KEY_SIZE },
        true,
        ['encrypt', 'decrypt']
      );
    } catch (error) {
      throw new ChatEncryptionError(`Key generation failed: ${error}`, 'ENCRYPTION_FAILED');
    }
  }

  async hashKey(key: CryptoKey): Promise<string> {
    try {
      const keyData = await crypto.subtle.exportKey('raw', key);
      const hashBuffer = await crypto.subtle.digest('SHA-256', keyData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    } catch (error) {
      throw new ChatEncryptionError(`Key hashing failed: ${error}`, 'ENCRYPTION_FAILED');
    }
  }

  async storeKey(conversationId: string, key: CryptoKey): Promise<void> {
    if (!this.db) await this.initialize();
    try {
      const keyData = await crypto.subtle.exportKey('jwk', key);
      const keyHash = await this.hashKey(key);
      const record = {
        conversationId,
        keyData,
        keyHash,
        createdAt: Date.now(),
        version: this.VERSION
      };
      return new Promise((resolve, reject) => {
        const transaction = this.db!.transaction([this.storeName], 'readwrite');
        const store = transaction.objectStore(this.storeName);
        const request = store.put(record);
        request.onerror = () => reject(new ChatEncryptionError(`Store failed: ${request.error?.message}`, 'STORAGE_ERROR'));
        request.onsuccess = () => resolve();
      });
    } catch (error) {
      throw new ChatEncryptionError(`Store failed: ${error}`, 'STORAGE_ERROR');
    }
  }


  async getKey(conversationId: string): Promise<CryptoKey | null> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(conversationId);
      request.onerror = () => reject(new ChatEncryptionError(`Retrieve failed: ${request.error?.message}`, 'STORAGE_ERROR'));
      request.onsuccess = async () => {
        if (!request.result) {
          resolve(null);
          return;
        }
        try {
          const keyData = request.result.keyData;
          const key = await crypto.subtle.importKey(
            'jwk',
            keyData,
            { name: this.ALGORITHM, length: this.KEY_SIZE },
            true,
            ['encrypt', 'decrypt']
          );
          resolve(key);
        } catch (error) {
          reject(new ChatEncryptionError(`Import failed: ${error}`, 'STORAGE_ERROR'));
        }
      };
    });
  }

  async deleteKey(conversationId: string): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(conversationId);
      request.onerror = () => reject(new ChatEncryptionError(`Delete failed: ${request.error?.message}`, 'STORAGE_ERROR'));
      request.onsuccess = () => resolve();
    });
  }

  async encryptMessage(message: string, key: CryptoKey): Promise<string> {
    try {
      const iv = crypto.getRandomValues(new Uint8Array(this.IV_SIZE));
      const encoder = new TextEncoder();
      const messageBytes = encoder.encode(message);
      const ciphertext = await crypto.subtle.encrypt(
        { name: this.ALGORITHM, iv: iv, tagLength: this.TAG_SIZE },
        key,
        messageBytes
      );
      const combined = new Uint8Array(iv.length + ciphertext.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(ciphertext), iv.length);
      return this.arrayBufferToBase64(combined);
    } catch (error) {
      throw new ChatEncryptionError(`Encryption failed: ${error}`, 'ENCRYPTION_FAILED');
    }
  }

  async decryptMessage(encryptedMessage: string, key: CryptoKey): Promise<string> {
    try {
      const combined = this.base64ToArrayBuffer(encryptedMessage);
      const iv = combined.slice(0, this.IV_SIZE);
      const ciphertext = combined.slice(this.IV_SIZE);
      const decryptedBytes = await crypto.subtle.decrypt(
        { name: this.ALGORITHM, iv: iv, tagLength: this.TAG_SIZE },
        key,
        ciphertext
      );
      const decoder = new TextDecoder();
      return decoder.decode(decryptedBytes);
    } catch (error) {
      throw new ChatEncryptionError(`Decryption failed: ${error}. Message may be tampered.`, 'DECRYPTION_FAILED');
    }
  }

  async initializeConversation(conversationId: string): Promise<{ keyHash: string }> {
    try {
      const key = await this.generateKey();
      const keyHash = await this.hashKey(key);
      await this.storeKey(conversationId, key);
      console.log(`[Vault Chat] 🔐 Initialized ${conversationId.slice(0, 8)}...`);
      return { keyHash };
    } catch (error) {
      throw new ChatEncryptionError(`Init failed: ${error}`, 'ENCRYPTION_FAILED');
    }
  }

  async clearAllKeys(): Promise<void> {
    if (!this.db) await this.initialize();
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onerror = () => reject(new ChatEncryptionError(`Clear failed: ${request.error?.message}`, 'STORAGE_ERROR'));
      request.onsuccess = () => {
        console.log('[Vault Chat] 🧹 Cleared all keys');
        resolve();
      };
    });
  }

  private arrayBufferToBase64(buffer: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buffer.byteLength; i++) {
      binary += String.fromCharCode(buffer[i]);
    }
    return btoa(binary);
  }

  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const buffer = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buffer[i] = binary.charCodeAt(i);
    }
    return buffer;
  }
}

export const chatEncryption = new ChatEncryption();

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  (window as any).__vaultChatEncryption = chatEncryption;
}
