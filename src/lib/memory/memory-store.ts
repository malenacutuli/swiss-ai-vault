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
const DB_VERSION = 3; // Bumped for projects support
const STORE_NAME = 'memories';
const FOLDERS_STORE = 'folders';
const PROJECTS_STORE = 'projects';

// ==========================================
// TYPES
// ==========================================

export type MemorySource = 'document' | 'chat' | 'note' | 'url';

// AI platform identification for imported conversations
export type AIPlatform = 'chatgpt' | 'claude' | 'gemini' | 'perplexity' | 'grok' | 'copilot' | 'swissvault' | 'unknown';

export interface MemoryMetadata {
  source: MemorySource;
  aiPlatform?: AIPlatform; // Stores specific AI platform: 'claude', 'chatgpt', etc.
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
  // Project support - item can belong to multiple projects
  projectIds?: string[];
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
  projectId?: string; // Optional project association
  color?: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

// Project for organizing documents with custom instructions
export interface MemoryProject {
  id: string;
  name: string;
  description?: string;
  instructions?: string; // Custom system prompt for this project
  color?: string;
  icon?: string;
  documentIds: string[]; // References to MemoryItem IDs
  createdAt: number;
  updatedAt: number;
  isArchived?: boolean;
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
      
      // Projects store (new in version 3)
      if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
        const projectsStore = database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' });
        projectsStore.createIndex('name', 'name', { unique: false });
        projectsStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        projectsStore.createIndex('isArchived', 'isArchived', { unique: false });
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
  aiPlatform?: AIPlatform; // AI platform for imported conversations
  folderId?: string; // Folder association for filtering
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
    aiPlatform?: AIPlatform;
    folderId?: string;
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
        // Preserve aiPlatform if present
        if (metadata.aiPlatform && !existing.aiPlatform) {
          existing.aiPlatform = metadata.aiPlatform;
        }
      } else {
        groups.set(groupKey, {
          filename: displayName,
          source,
          aiPlatform: metadata.aiPlatform,
          folderId: metadata.folderId,
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
      aiPlatform: data.aiPlatform,
      folderId: data.folderId,
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

/**
 * Move documents to a folder by updating their metadata
 */
export async function moveDocumentsToFolder(
  chunkIds: string[],
  folderId: string | null,
  encryptionKey: CryptoKey
): Promise<{ success: boolean; moved: number }> {
  const database = await getDB();
  let moved = 0;
  
  for (const id of chunkIds) {
    try {
      // Get stored memory
      const stored: StoredMemory | undefined = await new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      if (!stored) continue;
      
      // Decrypt
      const encryptedData = { ciphertext: stored.encrypted, nonce: stored.nonce };
      const decrypted = await decrypt(encryptedData, encryptionKey);
      const { content, metadata } = JSON.parse(decrypted);
      
      // Update folderId in metadata
      const updatedMetadata = {
        ...metadata,
        folderId: folderId,
        updatedAt: Date.now()
      };
      
      // Re-encrypt with updated metadata
      const payload = JSON.stringify({
        content,
        metadata: updatedMetadata
      });
      const newEncrypted = await encrypt(payload, encryptionKey);
      
      // Store updated memory
      const updatedStored: StoredMemory = {
        id: stored.id,
        embedding: stored.embedding,
        encrypted: newEncrypted.ciphertext,
        nonce: newEncrypted.nonce,
        createdAt: stored.createdAt
      };
      
      await new Promise<void>((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).put(updatedStored);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
      
      // Update hot cache if present
      if (hotCache.has(id)) {
        const cached = hotCache.get(id)!;
        hotCache.set(id, {
          ...cached,
          metadata: updatedMetadata
        });
      }
      
      moved++;
    } catch (error) {
      console.error(`[MemoryStore] Failed to move chunk ${id}:`, error);
    }
  }
  
  console.log('[MemoryStore] Moved', moved, 'chunks to folder', folderId || '(root)');
  return { success: true, moved };
}

// ==========================================
// FULL MEMORY EXPORT (for distillation)
// ==========================================

/**
 * Get all memories decrypted - used for AI distillation
 */
export async function getAllMemoriesDecrypted(
  encryptionKey: CryptoKey
): Promise<MemoryItem[]> {
  const database = await getDB();
  
  const stored: StoredMemory[] = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  const decrypted: MemoryItem[] = [];
  
  for (const s of stored) {
    try {
      const encryptedData = { ciphertext: s.encrypted, nonce: s.nonce };
      const decryptedPayload = await decrypt(encryptedData, encryptionKey);
      const { content, metadata } = JSON.parse(decryptedPayload);
      
      decrypted.push({
        id: s.id,
        content,
        embedding: s.embedding,
        metadata
      });
    } catch (error) {
      console.warn('[MemoryStore] Failed to decrypt memory item:', s.id);
    }
  }
  
  console.log('[MemoryStore] Decrypted', decrypted.length, 'of', stored.length, 'memories');
  return decrypted;
}

// ==========================================
// PROJECT OPERATIONS (ALL LOCAL)
// ==========================================

/**
 * Create a new project
 */
export async function createProject(
  project: Omit<MemoryProject, 'id' | 'createdAt' | 'updatedAt' | 'documentIds'>
): Promise<MemoryProject> {
  const database = await getDB();
  
  const newProject: MemoryProject = {
    ...project,
    id: crypto.randomUUID(),
    documentIds: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(PROJECTS_STORE, 'readwrite');
    tx.objectStore(PROJECTS_STORE).put(newProject);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  
  console.log('[MemoryStore] Created project:', newProject.name);
  return newProject;
}

/**
 * Get all non-archived projects
 */
export async function getProjects(): Promise<MemoryProject[]> {
  const database = await getDB();
  
  const projects: MemoryProject[] = await new Promise((resolve, reject) => {
    const tx = database.transaction(PROJECTS_STORE, 'readonly');
    const request = tx.objectStore(PROJECTS_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  return projects.filter(p => !p.isArchived);
}

/**
 * Get all projects including archived
 */
export async function getAllProjects(): Promise<MemoryProject[]> {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(PROJECTS_STORE, 'readonly');
    const request = tx.objectStore(PROJECTS_STORE).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get a specific project by ID
 */
export async function getProject(id: string): Promise<MemoryProject | null> {
  const database = await getDB();
  
  return new Promise((resolve, reject) => {
    const tx = database.transaction(PROJECTS_STORE, 'readonly');
    const request = tx.objectStore(PROJECTS_STORE).get(id);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update a project
 */
export async function updateProject(
  id: string,
  updates: Partial<MemoryProject>
): Promise<void> {
  const database = await getDB();
  const existing = await getProject(id);
  if (!existing) throw new Error('Project not found');
  
  const updated = { ...existing, ...updates, updatedAt: Date.now() };
  
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(PROJECTS_STORE, 'readwrite');
    tx.objectStore(PROJECTS_STORE).put(updated);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  
  console.log('[MemoryStore] Updated project:', id);
}

/**
 * Add a document to a project
 */
export async function addDocumentToProject(
  projectId: string,
  documentId: string,
  encryptionKey: CryptoKey
): Promise<void> {
  const database = await getDB();
  const project = await getProject(projectId);
  
  if (!project) throw new Error('Project not found');
  
  // Add to project's document list if not already there
  if (!project.documentIds.includes(documentId)) {
    project.documentIds.push(documentId);
    project.updatedAt = Date.now();
    
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction(PROJECTS_STORE, 'readwrite');
      tx.objectStore(PROJECTS_STORE).put(project);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }
  
  // Also update the document's projectIds in its metadata
  const stored: StoredMemory | undefined = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(documentId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  if (stored) {
    try {
      const encryptedData = { ciphertext: stored.encrypted, nonce: stored.nonce };
      const decrypted = await decrypt(encryptedData, encryptionKey);
      const { content, metadata } = JSON.parse(decrypted);
      
      const projectIds = metadata.projectIds || [];
      if (!projectIds.includes(projectId)) {
        projectIds.push(projectId);
        
        const updatedMetadata = { ...metadata, projectIds, updatedAt: Date.now() };
        const payload = JSON.stringify({ content, metadata: updatedMetadata });
        const newEncrypted = await encrypt(payload, encryptionKey);
        
        const updatedStored: StoredMemory = {
          id: stored.id,
          embedding: stored.embedding,
          encrypted: newEncrypted.ciphertext,
          nonce: newEncrypted.nonce,
          createdAt: stored.createdAt
        };
        
        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(updatedStored);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        
        // Update hot cache
        if (hotCache.has(documentId)) {
          const cached = hotCache.get(documentId)!;
          hotCache.set(documentId, { ...cached, metadata: updatedMetadata });
        }
      }
    } catch (error) {
      console.error('[MemoryStore] Failed to update document projectIds:', error);
    }
  }
  
  console.log('[MemoryStore] Added document', documentId, 'to project', projectId);
}

/**
 * Remove a document from a project
 */
export async function removeDocumentFromProject(
  projectId: string,
  documentId: string,
  encryptionKey: CryptoKey
): Promise<void> {
  const database = await getDB();
  const project = await getProject(projectId);
  
  if (!project) return;
  
  // Remove from project's document list
  project.documentIds = project.documentIds.filter(id => id !== documentId);
  project.updatedAt = Date.now();
  
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(PROJECTS_STORE, 'readwrite');
    tx.objectStore(PROJECTS_STORE).put(project);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  
  // Also update the document's projectIds
  const stored: StoredMemory | undefined = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).get(documentId);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  
  if (stored) {
    try {
      const encryptedData = { ciphertext: stored.encrypted, nonce: stored.nonce };
      const decrypted = await decrypt(encryptedData, encryptionKey);
      const { content, metadata } = JSON.parse(decrypted);
      
      if (metadata.projectIds) {
        metadata.projectIds = metadata.projectIds.filter((id: string) => id !== projectId);
        metadata.updatedAt = Date.now();
        
        const payload = JSON.stringify({ content, metadata });
        const newEncrypted = await encrypt(payload, encryptionKey);
        
        const updatedStored: StoredMemory = {
          id: stored.id,
          embedding: stored.embedding,
          encrypted: newEncrypted.ciphertext,
          nonce: newEncrypted.nonce,
          createdAt: stored.createdAt
        };
        
        await new Promise<void>((resolve, reject) => {
          const tx = database.transaction(STORE_NAME, 'readwrite');
          tx.objectStore(STORE_NAME).put(updatedStored);
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        });
        
        // Update hot cache
        if (hotCache.has(documentId)) {
          const cached = hotCache.get(documentId)!;
          hotCache.set(documentId, { ...cached, metadata });
        }
      }
    } catch (error) {
      console.error('[MemoryStore] Failed to update document projectIds:', error);
    }
  }
  
  console.log('[MemoryStore] Removed document', documentId, 'from project', projectId);
}

/**
 * Get all documents in a project
 */
export async function getProjectDocuments(
  projectId: string,
  encryptionKey: CryptoKey
): Promise<MemoryItem[]> {
  const project = await getProject(projectId);
  if (!project) return [];
  
  const documents: MemoryItem[] = [];
  
  for (const docId of project.documentIds) {
    const item = await getMemory(docId, encryptionKey);
    if (item) documents.push(item);
  }
  
  return documents;
}

/**
 * Archive a project (soft delete)
 */
export async function archiveProject(id: string): Promise<void> {
  await updateProject(id, { isArchived: true });
  console.log('[MemoryStore] Archived project:', id);
}

/**
 * Unarchive a project
 */
export async function unarchiveProject(id: string): Promise<void> {
  await updateProject(id, { isArchived: false });
  console.log('[MemoryStore] Unarchived project:', id);
}

/**
 * Permanently delete a project (removes project, not documents)
 */
export async function deleteProject(
  id: string,
  encryptionKey: CryptoKey
): Promise<void> {
  const database = await getDB();
  const project = await getProject(id);
  
  if (project) {
    // Remove project references from all documents
    for (const docId of project.documentIds) {
      const stored: StoredMemory | undefined = await new Promise((resolve, reject) => {
        const tx = database.transaction(STORE_NAME, 'readonly');
        const request = tx.objectStore(STORE_NAME).get(docId);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      
      if (stored) {
        try {
          const encryptedData = { ciphertext: stored.encrypted, nonce: stored.nonce };
          const decrypted = await decrypt(encryptedData, encryptionKey);
          const { content, metadata } = JSON.parse(decrypted);
          
          if (metadata.projectIds) {
            metadata.projectIds = metadata.projectIds.filter((pid: string) => pid !== id);
            metadata.updatedAt = Date.now();
            
            const payload = JSON.stringify({ content, metadata });
            const newEncrypted = await encrypt(payload, encryptionKey);
            
            const updatedStored: StoredMemory = {
              id: stored.id,
              embedding: stored.embedding,
              encrypted: newEncrypted.ciphertext,
              nonce: newEncrypted.nonce,
              createdAt: stored.createdAt
            };
            
            await new Promise<void>((resolve, reject) => {
              const tx = database.transaction(STORE_NAME, 'readwrite');
              tx.objectStore(STORE_NAME).put(updatedStored);
              tx.oncomplete = () => resolve();
              tx.onerror = () => reject(tx.error);
            });
            
            // Update hot cache
            if (hotCache.has(docId)) {
              const cached = hotCache.get(docId)!;
              hotCache.set(docId, { ...cached, metadata });
            }
          }
        } catch (error) {
          console.error('[MemoryStore] Failed to remove project ref from doc:', docId);
        }
      }
    }
  }
  
  // Delete the project itself
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(PROJECTS_STORE, 'readwrite');
    tx.objectStore(PROJECTS_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  
  console.log('[MemoryStore] Deleted project:', id);
}

/**
 * Get memories filtered by project
 */
export async function getMemoriesByProject(
  projectId: string,
  encryptionKey: CryptoKey
): Promise<MemoryItem[]> {
  const project = await getProject(projectId);
  if (!project) return [];
  
  return getProjectDocuments(projectId, encryptionKey);
}

/**
 * Search memories within a specific project
 */
export async function searchMemoriesInProject(
  queryEmbedding: number[],
  projectId: string,
  encryptionKey: CryptoKey,
  options: {
    topK?: number;
    minScore?: number;
  } = {}
): Promise<Array<{ item: MemoryItem; score: number }>> {
  const project = await getProject(projectId);
  if (!project || project.documentIds.length === 0) return [];
  
  const { topK = 5, minScore = 0.3 } = options;
  const projectDocIds = new Set(project.documentIds);
  
  const database = await getDB();
  
  // Get all stored memories
  const allStored: StoredMemory[] = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
  
  // Filter to only project documents and calculate similarity
  const projectStored = allStored.filter(s => projectDocIds.has(s.id));
  
  const scored = projectStored.map(stored => ({
    stored,
    score: similarity(queryEmbedding, stored.embedding)
  }));
  
  const relevant = scored
    .filter(s => s.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
  
  const results: Array<{ item: MemoryItem; score: number }> = [];
  
  for (const { stored, score } of relevant) {
    let item: MemoryItem | null = hotCache.get(stored.id) || null;
    
    if (!item) {
      try {
        const encryptedData = { ciphertext: stored.encrypted, nonce: stored.nonce };
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
    
    results.push({ item, score });
  }
  
  console.log('[MemoryStore] Found', results.length, 'relevant memories in project', projectId);
  return results;
}

// ==========================================
// VOICE NOTES
// ==========================================

export interface VoiceNoteMetadata extends MemoryMetadata {
  audioDataUrl: string;           // Base64 encoded audio data URL
  duration: number;               // Duration in seconds
  language: string;               // Recording language (e.g., 'en')
  recordedAt: string;             // ISO timestamp
  transcriptionConfidence?: number;
  isVoiceNote: true;              // Type discriminator
}

export interface VoiceNoteItem extends Omit<MemoryItem, 'metadata'> {
  metadata: VoiceNoteMetadata;
}

/**
 * Save a voice note with audio to IndexedDB
 * Audio is stored as base64 data URL within encrypted metadata
 */
export async function saveVoiceNote(
  audioBlob: Blob,
  transcript: string,
  duration: number,
  embedding: number[],
  encryptionKey: CryptoKey,
  options: {
    folderId?: string;
    projectIds?: string[];
    title?: string;
    language?: string;
  } = {}
): Promise<string> {
  // Convert audio blob to base64 data URL
  const audioDataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(audioBlob);
  });

  const now = Date.now();
  const id = crypto.randomUUID();

  const metadata: VoiceNoteMetadata = {
    source: 'note',
    audioDataUrl,
    duration,
    language: options.language || 'en',
    recordedAt: new Date().toISOString(),
    isVoiceNote: true,
    title: options.title || `Voice Note - ${new Date().toLocaleString()}`,
    folderId: options.folderId,
    projectIds: options.projectIds || [],
    createdAt: now,
    updatedAt: now,
  };

  const voiceNote: MemoryItem = {
    id,
    content: transcript,
    embedding,
    metadata,
  };

  // Use existing addMemory function which handles encryption
  await addMemory(voiceNote, encryptionKey);

  console.log('[MemoryStore] Voice note saved:', id);
  return id;
}

/**
 * Get all voice notes (decrypted)
 */
export async function getVoiceNotes(encryptionKey: CryptoKey): Promise<VoiceNoteItem[]> {
  const database = await getDB();
  
  const stored: StoredMemory[] = await new Promise((resolve, reject) => {
    const tx = database.transaction(STORE_NAME, 'readonly');
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });

  const voiceNotes: VoiceNoteItem[] = [];

  for (const s of stored) {
    try {
      const encryptedData = { ciphertext: s.encrypted, nonce: s.nonce };
      const decrypted = await decrypt(encryptedData, encryptionKey);
      const { content, metadata } = JSON.parse(decrypted);

      // Check if this is a voice note
      if (metadata.isVoiceNote) {
        voiceNotes.push({
          id: s.id,
          content,
          embedding: s.embedding,
          metadata: metadata as VoiceNoteMetadata,
        });
      }
    } catch (e) {
      console.error('[MemoryStore] Failed to decrypt memory:', s.id);
    }
  }

  // Sort by creation date, newest first
  return voiceNotes.sort((a, b) => b.metadata.createdAt - a.metadata.createdAt);
}

/**
 * Get a single voice note by ID
 */
export async function getVoiceNote(
  id: string,
  encryptionKey: CryptoKey
): Promise<VoiceNoteItem | null> {
  const item = await getMemory(id, encryptionKey);
  
  if (item && (item.metadata as VoiceNoteMetadata).isVoiceNote) {
    return item as VoiceNoteItem;
  }
  
  return null;
}

/**
 * Delete a voice note by ID
 */
export async function deleteVoiceNote(id: string): Promise<void> {
  await deleteMemory(id);
  console.log('[MemoryStore] Voice note deleted:', id);
}

/**
 * Get voice notes count
 */
export async function getVoiceNotesCount(encryptionKey: CryptoKey): Promise<number> {
  const voiceNotes = await getVoiceNotes(encryptionKey);
  return voiceNotes.length;
}
