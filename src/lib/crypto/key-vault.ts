/**
 * ZeroTrace Key Vault
 * Secure IndexedDB-based storage for encryption keys.
 * Master key stored encrypted, conversation keys cached in memory only.
 */

import { 
  deriveKeyFromPassword, 
  generateSalt, 
  hashKey,
  arrayBufferToBase64,
  base64ToArrayBuffer 
} from './zerotrace-crypto';

const DB_NAME = 'ZeroTraceVault';
const DB_VERSION = 1;
const STORE_NAME = 'keys';

interface VaultEntry {
  id: string;
  type: 'umk_params' | 'wrapped_cek';
  data: any;
  createdAt: number;
}

interface UMKParams {
  salt: string;           // Base64
  iterations: number;
  verificationHash: string;  // Double-hash for verification
}

// In-memory cache (cleared on page close)
const keyCache = new Map<string, CryptoKey>();
let masterKey: CryptoKey | null = null;
let lockTimeout: ReturnType<typeof setTimeout> | null = null;

/**
 * Initialize the key vault database
 */
export async function initializeVault(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
      }
    };
    
    request.onsuccess = () => resolve(request.result);
  });
}

/**
 * Check if user has set up encryption
 */
export async function isVaultInitialized(): Promise<boolean> {
  const db = await initializeVault();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('umk_params');
    
    request.onsuccess = () => resolve(!!request.result);
    request.onerror = () => resolve(false);
    
    tx.oncomplete = () => db.close();
  });
}

/**
 * Set up encryption with password (first time)
 */
export async function setupEncryption(password: string): Promise<void> {
  const salt = generateSalt();
  const umk = await deriveKeyFromPassword(password, salt);
  
  // Create double-hash for verification (hash of hash)
  const keyHash = await hashKey(umk);
  const verificationHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(keyHash)
  );
  
  const params: UMKParams = {
    salt: arrayBufferToBase64(salt),
    iterations: 100000,
    verificationHash: arrayBufferToBase64(verificationHash)
  };
  
  // Store params (NOT the key itself)
  const db = await initializeVault();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    store.put({
      id: 'umk_params',
      type: 'umk_params',
      data: params,
      createdAt: Date.now()
    });
    
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
  
  // Cache the master key in memory
  masterKey = umk;
  resetLockTimer();
}

/**
 * Unlock vault with password
 */
export async function unlockVault(password: string): Promise<boolean> {
  const db = await initializeVault();
  
  // Get stored params
  const params = await new Promise<UMKParams | null>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get('umk_params');
    
    request.onsuccess = () => {
      resolve(request.result?.data || null);
    };
    request.onerror = () => resolve(null);
    
    tx.oncomplete = () => db.close();
  });
  
  if (!params) {
    throw new Error('Vault not initialized');
  }
  
  // Derive key from password
  const salt = base64ToArrayBuffer(params.salt);
  const umk = await deriveKeyFromPassword(password, salt);
  
  // Verify key
  const keyHash = await hashKey(umk);
  const verificationHash = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(keyHash)
  );
  
  if (arrayBufferToBase64(verificationHash) !== params.verificationHash) {
    return false; // Wrong password
  }
  
  // Cache master key
  masterKey = umk;
  resetLockTimer();
  
  return true;
}

/**
 * Lock the vault (clear in-memory keys)
 */
export function lockVault(): void {
  masterKey = null;
  keyCache.clear();
  if (lockTimeout) {
    clearTimeout(lockTimeout);
    lockTimeout = null;
  }
}

/**
 * Check if vault is unlocked
 */
export function isVaultUnlocked(): boolean {
  return masterKey !== null;
}

/**
 * Get the master key (throws if locked)
 */
export function getMasterKey(): CryptoKey {
  if (!masterKey) {
    throw new Error('Vault is locked');
  }
  resetLockTimer();
  return masterKey;
}

/**
 * Store a conversation key (wrapped with UMK)
 */
export async function storeConversationKey(
  conversationId: string,
  wrappedKey: string,
  nonce: string
): Promise<void> {
  const db = await initializeVault();
  
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    
    store.put({
      id: `cek_${conversationId}`,
      type: 'wrapped_cek',
      data: { wrappedKey, nonce, conversationId },
      createdAt: Date.now()
    });
    
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get a conversation key (from cache or unwrap from storage)
 */
export async function getConversationKey(
  conversationId: string,
  unwrapKey: (wrapped: { ciphertext: string; nonce: string }) => Promise<CryptoKey>
): Promise<CryptoKey | null> {
  // Check cache first
  if (keyCache.has(conversationId)) {
    resetLockTimer();
    return keyCache.get(conversationId)!;
  }
  
  const db = await initializeVault();
  
  const entry = await new Promise<VaultEntry | null>((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const request = store.get(`cek_${conversationId}`);
    
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => resolve(null);
    
    tx.oncomplete = () => db.close();
  });
  
  if (!entry) return null;
  
  // Unwrap the key
  const key = await unwrapKey({
    ciphertext: entry.data.wrappedKey,
    nonce: entry.data.nonce
  });
  
  // Cache it
  keyCache.set(conversationId, key);
  resetLockTimer();
  
  return key;
}

/**
 * Cache a conversation key in memory
 */
export function cacheConversationKey(conversationId: string, key: CryptoKey): void {
  keyCache.set(conversationId, key);
  resetLockTimer();
}

/**
 * Clear a conversation key from cache
 */
export function clearConversationKey(conversationId: string): void {
  keyCache.delete(conversationId);
}

/**
 * Delete a conversation key from storage
 */
export async function deleteConversationKey(conversationId: string): Promise<void> {
  clearConversationKey(conversationId);
  
  const db = await initializeVault();
  
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(`cek_${conversationId}`);
    
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Reset the auto-lock timer
 */
function resetLockTimer(minutes: number = 15): void {
  if (lockTimeout) {
    clearTimeout(lockTimeout);
  }
  lockTimeout = setTimeout(() => {
    lockVault();
  }, minutes * 60 * 1000);
}

/**
 * Set custom auto-lock timeout
 */
export function setAutoLockTimeout(minutes: number): void {
  resetLockTimer(minutes);
}

/**
 * Export vault for backup (encrypted with provided password)
 */
export async function exportVaultBackup(backupPassword: string): Promise<string> {
  // This would export all keys encrypted with backup password
  // Implementation depends on recovery requirements
  throw new Error('Not implemented - define recovery strategy first');
}

/**
 * Clear all vault data (destructive!)
 */
export async function clearVault(): Promise<void> {
  lockVault();
  const db = await initializeVault();
  
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all stored conversation IDs
 */
export async function getStoredConversationIds(): Promise<string[]> {
  const db = await initializeVault();
  
  return new Promise((resolve) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('type');
    const request = index.getAll('wrapped_cek');
    
    request.onsuccess = () => {
      const entries = request.result as VaultEntry[];
      const ids = entries.map(e => e.data.conversationId);
      resolve(ids);
    };
    request.onerror = () => resolve([]);
    
    tx.oncomplete = () => db.close();
  });
}
