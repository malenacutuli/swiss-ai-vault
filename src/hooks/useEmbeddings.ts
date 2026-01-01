// src/hooks/useEmbeddings.ts
// React hook for browser-based embeddings with lazy imports

import { useState, useCallback, useEffect, useRef } from 'react';

// Lazy import to avoid circular dependencies
const getEmbeddingEngine = async () => {
  const engine = await import('@/lib/memory/embedding-engine');
  return engine;
};

export interface EmbeddingProgress {
  status: 'downloading' | 'loading' | 'ready' | 'error';
  progress?: number;
  message?: string;
}

export interface UseEmbeddingsReturn {
  // Status
  status: EmbeddingProgress['status'];
  progress: number;
  message: string;
  isReady: boolean;
  
  // Actions
  initialize: () => Promise<void>;
  embed: (text: string) => Promise<number[]>;
  embedBatch: (texts: string[]) => Promise<number[][]>;
  
  // Utilities
  similarity: (a: number[], b: number[]) => number;
  findSimilar: (query: number[], corpus: number[][], topK?: number) => Array<{ index: number; score: number }>;
  dimensions: number;
}

// Local similarity function to avoid needing the engine for type checks
function localSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

function localFindSimilar(
  query: number[], 
  corpus: number[][], 
  topK: number = 5
): Array<{ index: number; score: number }> {
  const scores = corpus.map((vec, index) => ({
    index,
    score: localSimilarity(query, vec)
  }));
  scores.sort((a, b) => b.score - a.score);
  return scores.slice(0, topK);
}

export function useEmbeddings(autoInit: boolean = false): UseEmbeddingsReturn {
  const [status, setStatus] = useState<EmbeddingProgress['status']>('downloading');
  const [progress, setProgress] = useState(0);
  const [message, setMessage] = useState('');
  const [ready, setReady] = useState(false);
  const initializingRef = useRef(false);
  
  const handleProgress = useCallback((p: EmbeddingProgress) => {
    setStatus(p.status);
    setProgress(p.progress ?? 0);
    setMessage(p.message ?? '');
    if (p.status === 'ready') setReady(true);
  }, []);
  
  const initialize = useCallback(async () => {
    if (initializingRef.current || ready) return;
    
    initializingRef.current = true;
    try {
      const engine = await getEmbeddingEngine();
      if (engine.isReady()) {
        setStatus('ready');
        setProgress(100);
        setReady(true);
        return;
      }
      await engine.initEmbeddings(handleProgress);
    } finally {
      initializingRef.current = false;
    }
  }, [handleProgress, ready]);
  
  // Auto-initialize if requested
  useEffect(() => {
    if (autoInit && !ready && !initializingRef.current) {
      initialize();
    }
  }, [autoInit, initialize, ready]);
  
  // Check ready state on mount
  useEffect(() => {
    const checkReady = async () => {
      const engine = await getEmbeddingEngine();
      if (engine.isReady()) {
        setStatus('ready');
        setProgress(100);
        setReady(true);
      }
    };
    checkReady();
  }, []);
  
  const embed = useCallback(async (text: string) => {
    const engine = await getEmbeddingEngine();
    return engine.embed(text);
  }, []);
  
  const embedBatch = useCallback(async (texts: string[]) => {
    const engine = await getEmbeddingEngine();
    return engine.embedBatch(texts);
  }, []);
  
  return {
    status,
    progress,
    message,
    isReady: ready,
    initialize,
    embed,
    embedBatch,
    similarity: localSimilarity,
    findSimilar: localFindSimilar,
    dimensions: 384 // all-MiniLM-L6-v2 dimension
  };
}

// Re-export types for convenience
export type { EmbeddingProgress as EmbeddingProgressType };
