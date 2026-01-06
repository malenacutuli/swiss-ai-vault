// src/lib/memory/embedding-engine.ts
// Browser-based embedding engine using Transformers.js
// This handles ONLY embeddings - encryption is handled by src/lib/crypto/

import { pipeline, env } from '@huggingface/transformers';

// Configure for browser environment
env.allowLocalModels = false;
env.useBrowserCache = true;

// Model configuration
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2'; // ~30MB, 384 dimensions
const EMBEDDING_DIMENSIONS = 384;

// Use 'any' to avoid complex type unions from transformers.js
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let embedder: any = null;
let isLoading = false;
let loadPromise: Promise<void> | null = null;

/**
 * Check if the embedding model is loaded and ready
 */
export function isModelReady(): boolean {
  return embedder !== null && !isLoading;
}

export type EmbeddingProgress = {
  status: 'downloading' | 'loading' | 'ready' | 'error';
  progress?: number;
  message?: string;
};

export type EmbeddingProgressCallback = (progress: EmbeddingProgress) => void;

/**
 * Initialize the embedding engine
 * Downloads the model on first use, caches in IndexedDB
 */
export async function initEmbeddings(
  onProgress?: EmbeddingProgressCallback
): Promise<void> {
  // Already initialized
  if (embedder) {
    onProgress?.({ status: 'ready', message: 'Model ready' });
    return;
  }
  
  // Already loading - wait for existing load
  if (isLoading && loadPromise) {
    await loadPromise;
    return;
  }
  
  isLoading = true;
  
  loadPromise = (async () => {
    try {
      console.log('[EmbeddingEngine] Initializing model:', MODEL_ID);
      onProgress?.({ status: 'downloading', progress: 0, message: 'Downloading embedding model...' });
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      embedder = await (pipeline as any)('feature-extraction', MODEL_ID, {
        progress_callback: (progressInfo: { status: string; loaded?: number; total?: number; file?: string }) => {
          if (progressInfo.status === 'progress' && progressInfo.loaded && progressInfo.total) {
            const pct = Math.round((progressInfo.loaded / progressInfo.total) * 100);
            onProgress?.({ 
              status: 'downloading', 
              progress: pct, 
              message: `Downloading: ${pct}%` 
            });
          } else if (progressInfo.status === 'done') {
            onProgress?.({ status: 'loading', progress: 100, message: 'Loading model...' });
          }
        }
      });
      
      console.log('[EmbeddingEngine] ✅ Model ready');
      onProgress?.({ status: 'ready', message: 'Embedding model ready' });
      
    } catch (error) {
      console.error('[EmbeddingEngine] ❌ Failed to load model:', error);
      onProgress?.({ status: 'error', message: String(error) });
      embedder = null;
      throw error;
    } finally {
      isLoading = false;
    }
  })();
  
  await loadPromise;
}

/**
 * Generate embedding for a single text
 * @returns Array of 384 floats (normalized)
 */
export async function embed(text: string): Promise<number[]> {
  if (!embedder) {
    await initEmbeddings();
  }
  
  if (!embedder) {
    throw new Error('Embedding model not initialized');
  }
  
  // Run embedding with mean pooling and normalization
  const result = await embedder(text, { 
    pooling: 'mean', 
    normalize: true 
  });
  
  // Convert to regular array
  return Array.from(result.data as Float32Array);
}

/**
 * Generate embeddings for multiple texts
 * Processes sequentially to avoid memory issues
 */
export async function embedBatch(texts: string[]): Promise<number[][]> {
  const results: number[][] = [];
  
  for (const text of texts) {
    results.push(await embed(text));
  }
  
  return results;
}

/**
 * Calculate cosine similarity between two embedding vectors
 * @returns Similarity score between -1 and 1 (1 = identical)
 */
export function similarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector dimension mismatch: ${a.length} vs ${b.length}`);
  }
  
  let dot = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  if (denominator === 0) return 0;
  
  return dot / denominator;
}

/**
 * Find top-k most similar items from a list
 */
export function findSimilar<T>(
  queryEmbedding: number[],
  items: Array<{ embedding: number[]; data: T }>,
  topK: number = 5,
  minSimilarity: number = 0.3
): Array<{ data: T; score: number }> {
  const scored = items
    .map(item => ({
      data: item.data,
      score: similarity(queryEmbedding, item.embedding)
    }))
    .filter(item => item.score >= minSimilarity)
    .sort((a, b) => b.score - a.score);
  
  return scored.slice(0, topK);
}

/**
 * Check if embedding engine is ready
 */
export function isReady(): boolean {
  return embedder !== null;
}

/**
 * Get embedding dimensions (384 for MiniLM)
 */
export function getDimensions(): number {
  return EMBEDDING_DIMENSIONS;
}

/**
 * Dispose of the model to free memory
 */
export async function dispose(): Promise<void> {
  if (embedder) {
    // @ts-ignore - dispose may exist
    if (typeof embedder.dispose === 'function') {
      await embedder.dispose();
    }
    embedder = null;
    loadPromise = null;
    console.log('[EmbeddingEngine] Model disposed');
  }
}
