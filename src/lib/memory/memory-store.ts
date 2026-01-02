// src/lib/memory/memory-store.ts
// Encrypted vector store for Personal AI Memory
// Uses existing SwissVault encryption from zerotrace-crypto.ts

import { encrypt, decrypt, type EncryptedData } from '@/lib/crypto/zerotrace-crypto';

// Cosine similarity function - defined locally to avoid circular deps with embedding-engine
function similarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// IndexedDB Configuration - separate from key vault
const DB_NAME = 'SwissVaultMemory';
const DB_VERSION = 2;
const STORE_NAME = 'memories';
const FOLDERS_STORE = 'folders';

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
  // Folder support
  folderId?: string;
  folderPath?: string;
}

export interface MemoryItem {
  id: string;
  content: string;
  embedding: number[];
  metadata: MemoryMetadata;
}

export interface MemoryFolder {
  id: string;
  name: string;
  parentId: string | null;
  color?: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
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
      
      // Memories store
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
      
      // Folders store
      if (!database.objectStoreNames.contains(FOLDERS_STORE)) {
        const foldersStore = database.createObjectStore(FOLDERS_STORE, { keyPath: 'id' });
        foldersStore.createIndex('parentId', 'parentId', { unique: false });
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

// ==========================================
// FOLDER OPERATIONS
// ==========================================

export async function createFolder(folder: Omit<MemoryFolder, 'id' | 'createdAt' | 'updatedAt'>): Promise<MemoryFolder> {
  const database = await getDB();
  
  const newFolder: MemoryFolder = {
    ...folder,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };
  
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(FOLDERS_STORE, 'readwrite');
    tx.objectStore(FOLDERS_STORE).put(newFolder);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  
  console.log('[MemoryStore] Created folder:', newFolder.name);
  return newFolder;
}

export async function getFolders(): Promise<MemoryFolder[]> {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(FOLDERS_STORE, 'readonly');
    const request = tx.objectStore(FOLDERS_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

export async function getFolder(id: string): Promise<MemoryFolder | null> {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(FOLDERS_STORE, 'readonly');
    const request = tx.objectStore(FOLDERS_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function updateFolder(id: string, updates: Partial<MemoryFolder>): Promise<void> {
  const database = await getDB();
  const existing = await getFolder(id);
  if (!existing) throw new Error('Folder not found');
  
  const updated = { ...existing, ...updates, updatedAt: Date.now() };
  
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(FOLDERS_STORE, 'readwrite');
    tx.objectStore(FOLDERS_STORE).put(updated);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  
  console.log('[MemoryStore] Updated folder:', id);
}

export async function deleteFolder(id: string): Promise<void> {
  const database = await getDB();
  
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(FOLDERS_STORE, 'readwrite');
    tx.objectStore(FOLDERS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  
  console.log('[MemoryStore] Deleted folder:', id);
}

export async function getMemoriesByFolder(
  folderId: string | null,
  encryptionKey: CryptoKey
): Promise<MemoryItem[]> {
  const database = await getDB();
  
  const stored: StoredMemory[] = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  const items: MemoryItem[] = [];
  
  for (const s of stored) {
    try {
      const encryptedData = { ciphertext: s.encrypted, nonce: s.nonce };
      const decrypted = await decrypt(encryptedData, encryptionKey);
      const { content, metadata } = JSON.parse(decrypted);
      
      const itemFolderId = metadata.folderId || null;
      if (folderId === 'uncategorized' ? itemFolderId === null : itemFolderId === folderId) {
        items.push({
          id: s.id,
          content,
          embedding: s.embedding,
          metadata
        });
      }
    } catch (e) {
      console.error('[MemoryStore] Failed to decrypt memory:', s.id);
    }
  }
  
  return items;
}

export async function getFolderItemCounts(encryptionKey: CryptoKey): Promise<Map<string | null, number>> {
  const database = await getDB();
  
  const stored: StoredMemory[] = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  const counts = new Map<string | null, number>();
  
  for (const s of stored) {
    try {
      const encryptedData = { ciphertext: s.encrypted, nonce: s.nonce };
      const decrypted = await decrypt(encryptedData, encryptionKey);
      const { metadata } = JSON.parse(decrypted);
      
      const folderId = metadata.folderId || null;
      counts.set(folderId, (counts.get(folderId) || 0) + 1);
    } catch (e) {
      // Skip items we can't decrypt
    }
  }
  
  return counts;
}

// ==========================================
// DOCUMENT GROUPING & SOURCE BREAKDOWN
// ==========================================

export interface DocumentGroup {
  documentId: string;
  filename: string;
  chunkCount: number;
  source: MemorySource;
  createdAt: number;
  chunkIds: string[];
}

export interface SourceBreakdown {
  document: number;
  note: number;
  chat: number;
  url: number;
}

/**
 * Get all memories grouped by document/source file
 */
export async function getDocumentGroups(encryptionKey: CryptoKey): Promise<DocumentGroup[]> {
  const database = await getDB();
  
  const stored: StoredMemory[] = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  const groups = new Map<string, {
    filename: string;
    source: MemorySource;
    createdAt: number;
    chunkIds: string[];
  }>();
  
  for (const s of stored) {
    try {
      const encryptedData = { ciphertext: s.encrypted, nonce: s.nonce };
      const decrypted = await decrypt(encryptedData, encryptionKey);
      const { metadata } = JSON.parse(decrypted);
      
      // Group by filename or title for documents, or by ID for notes/urls/chats
      const source = metadata.source || 'document';
      let groupKey: string;
      let displayName: string;
      
      if (source === 'document' && metadata.filename) {
        groupKey = metadata.filename;
        displayName = metadata.filename;
      } else if (source === 'note') {
        groupKey = `note_${metadata.title || s.id}`;
        displayName = metadata.title || 'Untitled Note';
      } else if (source === 'url') {
        groupKey = metadata.url || s.id;
        displayName = metadata.title || metadata.url || 'Web Page';
      } else if (source === 'chat') {
        groupKey = metadata.conversationId || s.id;
        displayName = metadata.title || 'Chat Conversation';
      } else {
        groupKey = metadata.filename || s.id;
        displayName = metadata.filename || metadata.title || 'Unknown';
      }
      
      const existing = groups.get(groupKey);
      if (existing) {
        existing.chunkIds.push(s.id);
        // Use earliest timestamp
        if (s.createdAt < existing.createdAt) {
          existing.createdAt = s.createdAt;
        }
      } else {
        groups.set(groupKey, {
          filename: displayName,
          source,
          createdAt: s.createdAt,
          chunkIds: [s.id]
        });
      }
    } catch (e) {
      console.error('[MemoryStore] Failed to decrypt for grouping:', s.id);
    }
  }
  
  // Convert to array and sort by creation date (newest first)
  return Array.from(groups.entries())
    .map(([documentId, data]) => ({
      documentId,
      filename: data.filename,
      chunkCount: data.chunkIds.length,
      source: data.source,
      createdAt: data.createdAt,
      chunkIds: data.chunkIds
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/**
 * Get source breakdown counts
 */
export async function getSourceBreakdown(encryptionKey: CryptoKey): Promise<SourceBreakdown> {
  const database = await getDB();
  
  const stored: StoredMemory[] = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  const breakdown: SourceBreakdown = { document: 0, note: 0, chat: 0, url: 0 };
  
  for (const s of stored) {
    try {
      const encryptedData = { ciphertext: s.encrypted, nonce: s.nonce };
      const decrypted = await decrypt(encryptedData, encryptionKey);
      const { metadata } = JSON.parse(decrypted);
      
      const source = metadata.source || 'document';
      if (source in breakdown) {
        breakdown[source as keyof SourceBreakdown]++;
      }
    } catch (e) {
      // Skip items we can't decrypt
    }
  }
  
  return breakdown;
}

/**
 * Delete all chunks belonging to a document
 */
export async function deleteDocumentChunks(chunkIds: string[]): Promise<number> {
  let deleted = 0;
  for (const id of chunkIds) {
    await deleteMemory(id);
    deleted++;
  }
  console.log('[MemoryStore] Deleted', deleted, 'chunks');
  return deleted;
}
