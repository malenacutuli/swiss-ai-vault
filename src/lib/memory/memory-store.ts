// src/lib/memory/memory-store.ts
// Encrypted vector store for Personal AI Memory
// Uses existing SwissVault encryption from zerotrace-crypto.ts

import { encrypt, decrypt, type EncryptedData } from '@/lib/crypto/zerotrace-crypto';
import { similarity } from './embedding-engine';

// IndexedDB Configuration - separate from key vault
const DB_NAME = 'SwissVaultMemory';
const DB_VERSION = 1;
const STORE_NAME = 'memories';

// ==========================================
// TYPES
// ==========================================

export type MemorySource = 'document' | 'chat' | 'note' | 'url';

export interface MemoryMetadata {
  source: MemorySource;
  filename?: string;
  title?: string;
  url?: string;
  conversationId?: string;
  chunkIndex?: number;
  totalChunks?: number;
  createdAt: number;
  updatedAt?: number;
}

export interface MemoryItem {
  id: string;
  content: string;
  embedding: number[];
  metadata: MemoryMetadata;
}

// What we actually store in IndexedDB
interface StoredMemory {
  id: string;
  embedding: number[];      // Not encrypted - embeddings aren't reversible
  encrypted: string;        // AES-256-GCM encrypted JSON (content + metadata)
  nonce: string;
  createdAt: number;
}

// ==========================================
// HOT CACHE (In-Memory)
// ==========================================

const hotCache = new Map<string, MemoryItem>();
let hotCacheMaxSize = 100; // Limit hot cache to prevent memory issues

function addToHotCache(item: MemoryItem): void {
  // Evict oldest if at capacity
  if (hotCache.size >= hotCacheMaxSize) {
    const oldestKey = hotCache.keys().next().value;
    if (oldestKey) hotCache.delete(oldestKey);
  }
  hotCache.set(item.id, item);
}

// ==========================================
// DATABASE CONNECTION
// ==========================================

let db: IDBDatabase | null = null;
let dbPromise: Promise<IDBDatabase> | null = null;

async function getDB(): Promise<IDBDatabase> {
  if (db) return db;
  if (dbPromise) return dbPromise;
  
  dbPromise = new Promise((resolve, reject) => {
    console.log('[MemoryStore] Opening IndexedDB:', DB_NAME);
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => {
      console.error('[MemoryStore] Failed to open database:', request.error);
      reject(request.error);
    };
    
    request.onupgradeneeded = (event) => {
      console.log('[MemoryStore] Upgrading database schema');
      const database = (event.target as IDBOpenDBRequest).result;
      
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
    
    request.onsuccess = () => {
      db = request.result;
      console.log('[MemoryStore] ✅ Database ready');
      resolve(db);
    };
  });
  
  return dbPromise;
}

// ==========================================
// CRUD OPERATIONS
// ==========================================

/**
 * Add a memory item to the store
 * Content and metadata are encrypted with the user's key
 */
export async function addMemory(
  item: MemoryItem,
  encryptionKey: CryptoKey
): Promise<string> {
  // Encrypt content + metadata together
  const payload = JSON.stringify({
    content: item.content,
    metadata: item.metadata
  });
  
  const encryptedData: EncryptedData = await encrypt(payload, encryptionKey);
  
  const stored: StoredMemory = {
    id: item.id,
    embedding: item.embedding,
    encrypted: encryptedData.ciphertext,
    nonce: encryptedData.nonce,
    createdAt: item.metadata.createdAt || Date.now()
  };
  
  // Store in IndexedDB
  const database = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(stored);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  
  // Add to hot cache
  addToHotCache(item);
  
  console.log('[MemoryStore] Added memory:', item.id);
  return item.id;
}

/**
 * Add multiple memories in a batch
 */
export async function addMemories(
  items: MemoryItem[],
  encryptionKey: CryptoKey,
  onProgress?: (current: number, total: number) => void
): Promise<number> {
  let count = 0;
  
  for (let i = 0; i < items.length; i++) {
    await addMemory(items[i], encryptionKey);
    count++;
    onProgress?.(i + 1, items.length);
  }
  
  return count;
}

/**
 * Get a specific memory by ID
 */
export async function getMemory(
  id: string,
  encryptionKey: CryptoKey
): Promise<MemoryItem | null> {
  // Check hot cache first
  if (hotCache.has(id)) {
    return hotCache.get(id)!;
  }
  
  // Load from cold storage
  const database = await getDB();
  const stored: StoredMemory | undefined = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(id);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  if (!stored) return null;
  
  // Decrypt
  const encryptedData: EncryptedData = {
    ciphertext: stored.encrypted,
    nonce: stored.nonce
  };
  
  try {
    const decrypted = await decrypt(encryptedData, encryptionKey);
    const { content, metadata } = JSON.parse(decrypted);
    
    const item: MemoryItem = {
      id: stored.id,
      content,
      embedding: stored.embedding,
      metadata
    };
    
    addToHotCache(item);
    return item;
  } catch (error) {
    console.error('[MemoryStore] Failed to decrypt memory:', id, error);
    return null;
  }
}

/**
 * Delete a memory by ID
 */
export async function deleteMemory(id: string): Promise<void> {
  hotCache.delete(id);
  
  const database = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  
  console.log('[MemoryStore] Deleted memory:', id);
}

/**
 * Delete multiple memories
 */
export async function deleteMemories(ids: string[]): Promise<void> {
  for (const id of ids) {
    await deleteMemory(id);
  }
}

// ==========================================
// VECTOR SEARCH
// ==========================================

/**
 * Search memories by embedding similarity
 * Returns top-K most similar items with their scores
 */
export async function searchMemories(
  queryEmbedding: number[],
  encryptionKey: CryptoKey,
  options: {
    topK?: number;
    minScore?: number;
    source?: MemorySource;
    conversationId?: string;
  } = {}
): Promise<Array<{ item: MemoryItem; score: number }>> {
  const { topK = 5, minScore = 0.3, source, conversationId } = options;
  
  const database = await getDB();
  
  // Get all stored memories
  const allStored: StoredMemory[] = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  if (allStored.length === 0) {
    console.log('[MemoryStore] No memories to search');
    return [];
  }
  
  console.log('[MemoryStore] Searching', allStored.length, 'memories');
  
  // Calculate similarity scores for all memories
  const scored = allStored.map(stored => ({
    stored,
    score: similarity(queryEmbedding, stored.embedding)
  }));
  
  // Filter by minimum score and sort by score descending
  const relevant = scored
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK * 2); // Get extra to filter by source/conversation
  
  // Decrypt and filter by metadata
  const results: Array<{ item: MemoryItem; score: number }> = [];
  
  for (const { stored, score } of relevant) {
    if (results.length >= topK) break;
    
    // Check hot cache first
    let item: MemoryItem | null = hotCache.get(stored.id) || null;
    
    if (!item) {
      // Decrypt from cold storage
      try {
        const encryptedData: EncryptedData = {
          ciphertext: stored.encrypted,
          nonce: stored.nonce
        };
        const decrypted = await decrypt(encryptedData, encryptionKey);
        const { content, metadata } = JSON.parse(decrypted);
        
        item = {
          id: stored.id,
          content,
          embedding: stored.embedding,
          metadata
        };
        
        addToHotCache(item);
      } catch (error) {
        console.warn('[MemoryStore] Failed to decrypt memory:', stored.id);
        continue;
      }
    }
    
    // Apply metadata filters
    if (source && item.metadata.source !== source) continue;
    if (conversationId && item.metadata.conversationId !== conversationId) continue;
    
    results.push({ item, score });
  }
  
  console.log('[MemoryStore] Found', results.length, 'relevant memories');
  return results;
}

/**
 * Get all memory IDs (for listing without decryption)
 */
export async function getAllMemoryIds(): Promise<string[]> {
  const database = await getDB();
  const stored: StoredMemory[] = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  return stored.map(s => s.id);
}

// ==========================================
// STATISTICS
// ==========================================

/**
 * Get memory store statistics
 */
export async function getMemoryStats(): Promise<{
  count: number;
  sizeEstimateBytes: number;
  hotCacheSize: number;
  oldestTimestamp: number | null;
  newestTimestamp: number | null;
}> {
  const database = await getDB();
  const stored: StoredMemory[] = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  if (stored.length === 0) {
    return {
      count: 0,
      sizeEstimateBytes: 0,
      hotCacheSize: hotCache.size,
      oldestTimestamp: null,
      newestTimestamp: null
    };
  }
  
  // Estimate size: embedding (384 * 4 bytes) + encrypted string
  const sizeEstimateBytes = stored.reduce((acc, s) => 
    acc + (s.embedding.length * 4) + (s.encrypted.length * 2), 0
  );
  
  const timestamps = stored.map(s => s.createdAt).sort((a, b) => a - b);
  
  return {
    count: stored.length,
    sizeEstimateBytes,
    hotCacheSize: hotCache.size,
    oldestTimestamp: timestamps[0],
    newestTimestamp: timestamps[timestamps.length - 1]
  };
}

// ==========================================
// DATA MANAGEMENT
// ==========================================

/**
 * Clear all memories
 */
export async function clearAllMemory(): Promise<void> {
  hotCache.clear();
  
  const database = await getDB();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  
  console.log('[MemoryStore] Cleared all memories');
}

/**
 * Export all memories as JSON blob (already encrypted)
 */
export async function exportMemories(): Promise<Blob> {
  const database = await getDB();
  const stored: StoredMemory[] = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  const exportData = {
    version: 1,
    exportedAt: Date.now(),
    count: stored.length,
    memories: stored
  };
  
  return new Blob([JSON.stringify(exportData, null, 2)], { 
    type: 'application/json' 
  });
}

/**
 * Import memories from backup
 * Returns count of imported memories
 */
export async function importMemories(blob: Blob): Promise<number> {
  const text = await blob.text();
  const data = JSON.parse(text);
  
  if (data.version !== 1) {
    throw new Error('Unsupported memory export format version');
  }
  
  const memories: StoredMemory[] = data.memories;
  if (!Array.isArray(memories)) {
    throw new Error('Invalid memory export format');
  }
  
  const database = await getDB();
  let count = 0;
  
  for (const mem of memories) {
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(mem);
      tx.oncomplete = () => {
        count++;
        resolve();
      };
      tx.onerror = () => reject(tx.error);
    });
  }
  
  console.log('[MemoryStore] Imported', count, 'memories');
  return count;
}

/**
 * Set hot cache max size
 */
export function setHotCacheMaxSize(size: number): void {
  hotCacheMaxSize = size;
  
  // Evict if necessary
  while (hotCache.size > hotCacheMaxSize) {
    const oldestKey = hotCache.keys().next().value;
    if (oldestKey) hotCache.delete(oldestKey);
  }
}

/**
 * Clear hot cache only (keeps cold storage)
 */
export function clearHotCache(): void {
  hotCache.clear();
  console.log('[MemoryStore] Cleared hot cache');
}

/**
 * Check if store is initialized
 */
export function isInitialized(): boolean {
  return db !== null;
}

/**
 * Close database connection
 */
export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
    dbPromise = null;
    console.log('[MemoryStore] Database closed');
  }
}
