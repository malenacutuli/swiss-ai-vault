// src/hooks/useEmbeddings.ts
// React hook for browser-based embeddings

import { useState, useCallback, useEffect, useRef } from 'react';
import { 
  initEmbeddings, 
  embed, 
  embedBatch, 
  isReady, 
  similarity,
  findSimilar,
  getDimensions,
  dispose,
  type EmbeddingProgress 
} from '@/lib/memory/embedding-engine';

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
  similarity: typeof similarity;
  findSimilar: typeof findSimilar;
  dimensions: number;
}

export function useEmbeddings(autoInit: boolean = false): UseEmbeddingsReturn {
  const [status, setStatus] = useState<EmbeddingProgress['status']>(
    isReady() ? 'ready' : 'downloading'
  );
  const [progress, setProgress] = useState(isReady() ? 100 : 0);
  const [message, setMessage] = useState(isReady() ? 'Ready' : '');
  const initializingRef = useRef(false);
  
  const handleProgress = useCallback((p: EmbeddingProgress) => {
    setStatus(p.status);
    setProgress(p.progress ?? 0);
    setMessage(p.message ?? '');
  }, []);
  
  const initialize = useCallback(async () => {
    if (initializingRef.current || isReady()) return;
    
    initializingRef.current = true;
    try {
      await initEmbeddings(handleProgress);
    } finally {
      initializingRef.current = false;
    }
  }, [handleProgress]);
  
  // Auto-initialize if requested
  useEffect(() => {
    if (autoInit && !isReady() && !initializingRef.current) {
      initialize();
    }
  }, [autoInit, initialize]);
  
  // Update ready state when model loads
  useEffect(() => {
    if (isReady() && status !== 'ready') {
      setStatus('ready');
      setProgress(100);
      setMessage('Ready');
    }
  }, [status]);
  
  return {
    status,
    progress,
    message,
    isReady: isReady(),
    initialize,
    embed,
    embedBatch,
    similarity,
    findSimilar,
    dimensions: getDimensions()
  };
}

// Re-export types for convenience
export type { EmbeddingProgress };
