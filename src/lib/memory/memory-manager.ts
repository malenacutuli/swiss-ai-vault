// src/lib/memory/memory-manager.ts
// Memory Manager - coordinates embedding engine and memory store
// Integrates with SwissVault's existing encryption system

import { embed, embedBatch, initEmbeddings, isReady as isEmbeddingsReady } from './embedding-engine';
import { 
  addMemory, 
  searchMemories, 
  deleteMemory,
  deleteMemories,
  getMemory,
  getMemoryStats,
  clearAllMemory,
  exportMemories,
  importMemories,
  type MemoryItem,
  type MemorySource
} from './memory-store';

// ==========================================
// CONFIGURATION
// ==========================================

const CHUNK_SIZE = 400;       // ~400 tokens per chunk
const CHUNK_OVERLAP = 50;     // Overlap between chunks
const MIN_CHUNK_SIZE = 50;    // Minimum chunk size

// ==========================================
// TYPES
// ==========================================

export interface AddDocumentResult {
  documentId: string;
  chunksAdded: number;
  success: boolean;
  error?: string;
}

export interface ContextSnippet {
  id: string;
  content: string;
  source: string;
  score: number;
  metadata: MemoryItem['metadata'];
}

export type ProgressCallback = (message: string, percent?: number) => void;

// ==========================================
// TEXT CHUNKING
// ==========================================

/**
 * Chunk text into smaller pieces for embedding
 * Uses paragraph boundaries when possible
 */
function chunkText(text: string): string[] {
  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = '';
  
  for (const para of paragraphs) {
    const trimmedPara = para.trim();
    if (!trimmedPara) continue;
    
    const paraTokens = Math.ceil(trimmedPara.length / 4);
    const currentTokens = Math.ceil(current.length / 4);
    
    if (currentTokens + paraTokens <= CHUNK_SIZE) {
      // Add to current chunk
      current += (current ? '\n\n' : '') + trimmedPara;
    } else {
      // Save current chunk and start new one
      if (current && Math.ceil(current.length / 4) >= MIN_CHUNK_SIZE) {
        chunks.push(current);
      }
      
      if (paraTokens > CHUNK_SIZE) {
        // Split long paragraphs by sentence
        const sentences = trimmedPara.split(/(?<=[.!?])\s+/);
        current = '';
        
        for (const sent of sentences) {
          const sentTokens = Math.ceil(sent.length / 4);
          const currTokens = Math.ceil(current.length / 4);
          
          if (currTokens + sentTokens <= CHUNK_SIZE) {
            current += (current ? ' ' : '') + sent;
          } else {
            if (current && Math.ceil(current.length / 4) >= MIN_CHUNK_SIZE) {
              chunks.push(current);
            }
            current = sent;
          }
        }
      } else {
        current = trimmedPara;
      }
    }
  }
  
  // Don't forget the last chunk
  if (current && Math.ceil(current.length / 4) >= MIN_CHUNK_SIZE) {
    chunks.push(current);
  }
  
  return chunks;
}

// ==========================================
// INITIALIZATION
// ==========================================

/**
 * Initialize the memory system
 * Loads the embedding model (downloads on first use, ~30MB)
 */
export async function initMemory(
  onProgress?: ProgressCallback
): Promise<void> {
  if (isEmbeddingsReady()) {
    onProgress?.('Memory system ready', 100);
    return;
  }
  
  onProgress?.('Loading embedding model...', 0);
  
  await initEmbeddings((p) => {
    onProgress?.(p.message || 'Loading...', p.progress);
  });
  
  onProgress?.('Memory system ready', 100);
}

/**
 * Check if memory system is ready
 */
export function isMemoryReady(): boolean {
  return isEmbeddingsReady();
}

// ==========================================
// DOCUMENT OPERATIONS
// ==========================================

/**
 * Add a document to memory
 * Chunks the document, generates embeddings, and stores encrypted
 */
export async function addDocument(
  content: string,
  filename: string,
  encryptionKey: CryptoKey,
  onProgress?: ProgressCallback
): Promise<AddDocumentResult> {
  const docId = crypto.randomUUID();
  
  try {
    // Ensure embeddings are ready
    if (!isEmbeddingsReady()) {
      onProgress?.('Loading embedding model...', 5);
      await initMemory(onProgress);
    }
    
    onProgress?.('Chunking document...', 10);
    const chunks = chunkText(content);
    
    if (chunks.length === 0) {
      return {
        documentId: docId,
        chunksAdded: 0,
        success: false,
        error: 'Document is too short or empty'
      };
    }
    
    console.log(`[MemoryManager] Document "${filename}" split into ${chunks.length} chunks`);
    
    onProgress?.('Generating embeddings...', 20);
    const embeddings = await embedBatch(chunks);
    
    // Store each chunk
    for (let i = 0; i < chunks.length; i++) {
      const pct = 20 + Math.round((i / chunks.length) * 75);
      onProgress?.(`Storing chunk ${i + 1}/${chunks.length}...`, pct);
      
      const memoryItem: MemoryItem = {
        id: `${docId}-${i}`,
        content: chunks[i],
        embedding: embeddings[i],
        metadata: {
          source: 'document',
          filename,
          chunkIndex: i,
          totalChunks: chunks.length,
          createdAt: Date.now()
        }
      };
      
      await addMemory(memoryItem, encryptionKey);
    }
    
    onProgress?.('Document added successfully', 100);
    console.log(`[MemoryManager] ✅ Added document "${filename}" with ${chunks.length} chunks`);
    
    return {
      documentId: docId,
      chunksAdded: chunks.length,
      success: true
    };
  } catch (error) {
    console.error('[MemoryManager] Failed to add document:', error);
    return {
      documentId: docId,
      chunksAdded: 0,
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

/**
 * Add content from a URL to memory
 */
export async function addFromURL(
  content: string,
  url: string,
  title: string,
  encryptionKey: CryptoKey,
  onProgress?: ProgressCallback
): Promise<AddDocumentResult> {
  const docId = crypto.randomUUID();
  
  try {
    if (!isEmbeddingsReady()) {
      await initMemory(onProgress);
    }
    
    onProgress?.('Processing content...', 10);
    const chunks = chunkText(content);
    
    if (chunks.length === 0) {
      return { documentId: docId, chunksAdded: 0, success: false, error: 'No content' };
    }
    
    onProgress?.('Generating embeddings...', 20);
    const embeddings = await embedBatch(chunks);
    
    for (let i = 0; i < chunks.length; i++) {
      const pct = 20 + Math.round((i / chunks.length) * 75);
      onProgress?.(`Storing ${i + 1}/${chunks.length}...`, pct);
      
      await addMemory({
        id: `${docId}-${i}`,
        content: chunks[i],
        embedding: embeddings[i],
        metadata: {
          source: 'url',
          url,
          title,
          chunkIndex: i,
          totalChunks: chunks.length,
          createdAt: Date.now()
        }
      }, encryptionKey);
    }
    
    onProgress?.('Done', 100);
    return { documentId: docId, chunksAdded: chunks.length, success: true };
  } catch (error) {
    return { documentId: docId, chunksAdded: 0, success: false, error: String(error) };
  }
}

// ==========================================
// CHAT & NOTE OPERATIONS
// ==========================================

/**
 * Add a chat excerpt to memory
 * Use this for important conversation turns the user wants to remember
 */
export async function addChatExcerpt(
  content: string,
  conversationId: string,
  encryptionKey: CryptoKey
): Promise<string> {
  if (!isEmbeddingsReady()) {
    await initMemory();
  }
  
  const embedding = await embed(content);
  const id = crypto.randomUUID();
  
  await addMemory({
    id,
    content,
    embedding,
    metadata: {
      source: 'chat',
      conversationId,
      createdAt: Date.now()
    }
  }, encryptionKey);
  
  console.log('[MemoryManager] Added chat excerpt to memory');
  return id;
}

/**
 * Add a note to memory
 */
export async function addNote(
  content: string,
  title: string,
  encryptionKey: CryptoKey
): Promise<string> {
  if (!isEmbeddingsReady()) {
    await initMemory();
  }
  
  const embedding = await embed(content);
  const id = crypto.randomUUID();
  
  await addMemory({
    id,
    content,
    embedding,
    metadata: {
      source: 'note',
      title,
      createdAt: Date.now()
    }
  }, encryptionKey);
  
  console.log('[MemoryManager] Added note to memory:', title);
  return id;
}

// ==========================================
// CONTEXT RETRIEVAL
// ==========================================

/**
 * Get context snippets for a query
 * Returns most relevant memories for augmenting AI responses
 */
export async function getContext(
  query: string,
  encryptionKey: CryptoKey,
  options: {
    topK?: number;
    maxTokens?: number;
    minScore?: number;
    source?: MemorySource;
    conversationId?: string;
  } = {}
): Promise<ContextSnippet[]> {
  const { topK = 5, maxTokens = 2000, minScore = 0.3 } = options;
  
  if (!isEmbeddingsReady()) {
    console.warn('[MemoryManager] Embeddings not ready, skipping context retrieval');
    return [];
  }
  
  // Generate query embedding
  const queryEmbedding = await embed(query);
  
  // Search memories
  const results = await searchMemories(queryEmbedding, encryptionKey, {
    topK: topK * 2, // Get extra to account for token budget
    minScore,
    source: options.source,
    conversationId: options.conversationId
  });
  
  // Apply token budget
  const snippets: ContextSnippet[] = [];
  let totalTokens = 0;
  
  for (const { item, score } of results) {
    const tokens = Math.ceil(item.content.length / 4);
    
    if (totalTokens + tokens > maxTokens) {
      break;
    }
    
    // Generate source label
    let source: string;
    if (item.metadata.source === 'document') {
      source = item.metadata.filename || 'Document';
    } else if (item.metadata.source === 'url') {
      source = item.metadata.title || item.metadata.url || 'Web page';
    } else if (item.metadata.source === 'note') {
      source = item.metadata.title || 'Note';
    } else if (item.metadata.source === 'chat') {
      source = 'Previous conversation';
    } else {
      source = 'Memory';
    }
    
    snippets.push({
      id: item.id,
      content: item.content,
      source,
      score,
      metadata: item.metadata
    });
    
    totalTokens += tokens;
  }
  
  console.log(`[MemoryManager] Retrieved ${snippets.length} context snippets (${totalTokens} tokens)`);
  return snippets;
}

/**
 * Build a context prompt for the AI
 * Formats retrieved snippets into a prompt section
 */
export function buildContextPrompt(snippets: ContextSnippet[]): string {
  if (snippets.length === 0) {
    return '';
  }
  
  const parts = snippets.map((s, i) => {
    const relevance = Math.round(s.score * 100);
    return `[${i + 1}. ${s.source} (${relevance}% relevant)]\n${s.content}`;
  });
  
  return `[CONTEXT FROM YOUR PERSONAL MEMORY]\nThe following information was retrieved from your stored documents, notes, and conversations:\n\n${parts.join('\n\n---\n\n')}\n\n[END CONTEXT]\n\nUse this context to inform your response when relevant. Cite sources when directly using information.`;
}

// ==========================================
// MANAGEMENT & EXPORT
// ==========================================

export { 
  deleteMemory, 
  deleteMemories,
  getMemory,
  getMemoryStats, 
  clearAllMemory, 
  exportMemories, 
  importMemories 
};

export type { MemoryItem, MemorySource };
