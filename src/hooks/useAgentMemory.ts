import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  initEmbeddings, 
  embed, 
  similarity,
  isModelReady 
} from '@/lib/memory/embedding-engine';

// IndexedDB setup
const DB_NAME = 'swissvault-agent-memory';
const DB_VERSION = 2; // Bump version for embedding support
const STORE_NAME = 'agent_memories';

interface MemoryItem {
  id: string;
  content: string;
  type: 'conversation' | 'task_result' | 'user_preference' | 'document';
  embedding?: number[];
  metadata: {
    title?: string;
    source?: string;
    taskId?: string;
    createdAt: string;
  };
}

interface MemoryContext {
  type: string;
  content: string;
  source: string;
  relevance: number;
}

// Open IndexedDB
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('type', 'type', { unique: false });
        store.createIndex('createdAt', 'metadata.createdAt', { unique: false });
      }
    };
  });
}

export function useAgentMemory() {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [memoryCount, setMemoryCount] = useState(0);
  const [embeddingsReady, setEmbeddingsReady] = useState(false);
  const initRef = useRef(false);

  // Initialize embeddings on mount
  useEffect(() => {
    countMemories();
    
    // Lazy-load embedding model
    if (!initRef.current) {
      initRef.current = true;
      initEmbeddings()
        .then(() => setEmbeddingsReady(true))
        .catch(err => console.warn('[useAgentMemory] Embedding init failed, using keyword fallback:', err));
    }
  }, []);

  const countMemories = async () => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const count = await new Promise<number>((resolve, reject) => {
        const request = store.count();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
      setMemoryCount(count);
    } catch (err) {
      console.error('[useAgentMemory] Count error:', err);
    }
  };

  // Store a memory item
  const storeMemory = useCallback(async (item: Omit<MemoryItem, 'id'>): Promise<string> => {
    try {
      const db = await openDB();
      const id = `mem-${Date.now()}-${Math.random().toString(36).substring(7)}`;
      const memory: MemoryItem = { ...item, id };

      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.put(memory);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      console.log('[useAgentMemory] Stored memory:', id);
      countMemories();
      return id;
    } catch (err) {
      console.error('[useAgentMemory] Store error:', err);
      throw err;
    }
  }, []);

  // Search memories by keyword
  const searchMemories = useCallback(async (
    query: string,
    maxResults: number = 5
  ): Promise<MemoryItem[]> => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);

      const all = await new Promise<MemoryItem[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (all.length === 0) return [];

      // Try semantic search if embeddings are ready
      if (embeddingsReady && isModelReady()) {
        try {
          console.log('[useAgentMemory] Using semantic search');
          const queryEmbedding = await embed(query);
          
          // Score each memory by cosine similarity
          const scored = all
            .map(item => {
              let score = 0;
              
              if (item.embedding && item.embedding.length > 0) {
                // Use pre-computed embedding
                score = similarity(queryEmbedding, item.embedding);
              } else {
                // Fallback: generate embedding on-the-fly (slower)
                // Skip for now to avoid blocking
                score = 0;
              }
              
              // Boost recent items slightly
              const age = Date.now() - new Date(item.metadata.createdAt).getTime();
              const recencyBoost = Math.max(0, 1 - age / (7 * 24 * 60 * 60 * 1000)) * 0.1;
              
              return { item, score: score + recencyBoost };
            })
            .filter(x => x.score > 0.3) // Similarity threshold
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults)
            .map(x => x.item);

          if (scored.length > 0) {
            return scored;
          }
        } catch (embErr) {
          console.warn('[useAgentMemory] Semantic search failed, falling back to keyword:', embErr);
        }
      }

      // Fallback: keyword-based search
      console.log('[useAgentMemory] Using keyword search');
      const queryLower = query.toLowerCase();
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 2);
      
      const scored = all
        .map(item => {
          const contentLower = item.content.toLowerCase();
          const titleLower = (item.metadata.title || '').toLowerCase();
          
          let score = 0;
          for (const word of queryWords) {
            if (contentLower.includes(word)) score += 1;
            if (titleLower.includes(word)) score += 0.5;
          }
          
          const age = Date.now() - new Date(item.metadata.createdAt).getTime();
          const recencyBoost = Math.max(0, 1 - age / (7 * 24 * 60 * 60 * 1000));
          
          return { item, score: score + recencyBoost * 0.2 };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(x => x.item);

      return scored;
    } catch (err) {
      console.error('[useAgentMemory] Search error:', err);
      return [];
    }
  }, [embeddingsReady]);

  // Get context for a task
  const getContextForTask = useCallback(async (
    taskPrompt: string,
    maxResults: number = 5
  ): Promise<MemoryContext[]> => {
    if (!user) return [];
    
    setIsLoading(true);
    const contexts: MemoryContext[] = [];

    try {
      // 1. Search local IndexedDB memories
      const localMemories = await searchMemories(taskPrompt, maxResults);
      
      for (const item of localMemories) {
        contexts.push({
          type: item.type,
          content: item.content.substring(0, 500),
          source: item.metadata.source || 'Local Memory',
          relevance: 0.8,
        });
      }

      // 2. Get recent completed tasks from database
      const { data: recentTasks } = await supabase
        .from('agent_tasks')
        .select('prompt, result_summary, plan_summary')
        .eq('user_id', user.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(3);

      if (recentTasks) {
        for (const task of recentTasks) {
          if (task.result_summary) {
            contexts.push({
              type: 'previous_task',
              content: `Task: "${task.prompt.substring(0, 80)}..." → ${task.result_summary}`,
              source: 'Previous Agent Task',
              relevance: 0.6,
            });
          }
        }
      }

      // 3. Check agent memory context table
      const { data: memoryContexts } = await supabase
        .from('agent_memory_context')
        .select('context_type, context_content, relevance_score, source_reference')
        .eq('user_id', user.id)
        .order('relevance_score', { ascending: false })
        .limit(3);

      if (memoryContexts) {
        for (const ctx of memoryContexts) {
          contexts.push({
            type: ctx.context_type,
            content: ctx.context_content.substring(0, 500),
            source: ctx.source_reference || 'Agent Memory',
            relevance: ctx.relevance_score || 0.5,
          });
        }
      }

      // Sort by relevance and return
      return contexts.sort((a, b) => b.relevance - a.relevance).slice(0, maxResults);

    } catch (err) {
      console.error('[useAgentMemory] Context error:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [user, searchMemories]);

  // Store task result as memory
  const storeTaskResult = useCallback(async (
    taskId: string,
    prompt: string,
    result: string,
    outputs: { file_name?: string }[]
  ): Promise<void> => {
    const outputNames = outputs.map(o => o.file_name || 'output').join(', ');
    
    await storeMemory({
      content: `Task: ${prompt}\nResult: ${result}${outputNames ? `\nOutputs: ${outputNames}` : ''}`,
      type: 'task_result',
      metadata: {
        title: prompt.substring(0, 50),
        source: 'Agent Task',
        taskId,
        createdAt: new Date().toISOString(),
      },
    });

    // Also store in database for cross-device access
    if (user) {
      await supabase.from('agent_memory_context').insert({
        user_id: user.id,
        task_id: taskId,
        context_type: 'task_result',
        context_content: `${prompt.substring(0, 200)} → ${result.substring(0, 500)}`,
        source_reference: 'Agent Task',
        relevance_score: 0.8,
      });
    }
  }, [storeMemory, user]);

  // Format context for agent injection
  const formatContextForAgent = useCallback((contexts: MemoryContext[]): string => {
    if (contexts.length === 0) return '';

    let formatted = '\n\n--- CONTEXT FROM USER MEMORY ---\n';
    
    contexts.forEach((ctx, i) => {
      formatted += `\n[${i + 1}] ${ctx.source} (${Math.round(ctx.relevance * 100)}% relevant)\n`;
      formatted += `${ctx.content}\n`;
    });

    formatted += '\n--- END MEMORY CONTEXT ---\n';
    formatted += 'Use this context to personalize your response.\n';

    return formatted;
  }, []);

  // Clear all memories
  const clearMemories = useCallback(async (): Promise<void> => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      await new Promise<void>((resolve, reject) => {
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      setMemoryCount(0);
      console.log('[useAgentMemory] Cleared all memories');
    } catch (err) {
      console.error('[useAgentMemory] Clear error:', err);
    }
  }, []);

  // Get all memories
  const getAllMemories = useCallback(async (): Promise<MemoryItem[]> => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      
      return await new Promise<MemoryItem[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch (err) {
      console.error('[useAgentMemory] GetAll error:', err);
      return [];
    }
  }, []);

  // Delete a specific memory
  const deleteMemory = useCallback(async (id: string): Promise<void> => {
    try {
      const db = await openDB();
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      
      await new Promise<void>((resolve, reject) => {
        const request = store.delete(id);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
      
      countMemories();
      console.log('[useAgentMemory] Deleted memory:', id);
    } catch (err) {
      console.error('[useAgentMemory] Delete error:', err);
    }
  }, []);

  return {
    storeMemory,
    searchMemories,
    getContextForTask,
    storeTaskResult,
    formatContextForAgent,
    clearMemories,
    getAllMemories,
    deleteMemory,
    memoryCount,
    isLoading,
  };
}

export type { MemoryItem, MemoryContext };
export default useAgentMemory;
