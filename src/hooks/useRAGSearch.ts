// src/hooks/useRAGSearch.ts
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SearchResult {
  chunk_id: string;
  document_id: string;
  content: string;
  similarity: number;
  metadata: Record<string, any>;
}

export function useRAGSearch() {
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(async (
    query: string,
    options?: { orgId?: string; matchCount?: number; threshold?: number }
  ) => {
    setIsSearching(true);
    setError(null);

    try {
      const { data, error: searchError } = await supabase.functions.invoke('embeddings?action=search', {
        body: {
          query,
          org_id: options?.orgId,
          match_count: options?.matchCount || 5,
          threshold: options?.threshold || 0.7
        }
      });

      if (searchError) throw searchError;

      setResults(data?.results || []);
      return data?.results || [];
    } catch (err: any) {
      setError(err.message);
      return [];
    } finally {
      setIsSearching(false);
    }
  }, []);

  const indexDocument = useCallback(async (documentId: string) => {
    try {
      const { data, error } = await supabase.functions.invoke('embeddings?action=index_document', {
        body: { document_id: documentId }
      });

      if (error) throw error;
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, []);

  return { results, isSearching, error, search, indexDocument };
}
