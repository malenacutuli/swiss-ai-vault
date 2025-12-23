import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  answer: string;
  citations: SearchResult[];
  isComplete: boolean;
}

interface UseGhostSearchOptions {
  onToken?: (token: string) => void;
  onCitation?: (citations: SearchResult[]) => void;
  onComplete?: (response: SearchResponse) => void;
  onError?: (error: Error) => void;
}

export function useGhostSearch() {
  const [isSearching, setIsSearching] = useState(false);
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<SearchResult[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);

  const search = useCallback(async (
    query: string,
    options?: UseGhostSearchOptions
  ) => {
    if (!query.trim()) return;

    setIsSearching(true);
    setAnswer('');
    setCitations([]);

    abortControllerRef.current = new AbortController();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghost-web-search`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ query }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Search failed: ${response.status}`);
      }

      if (!response.body) {
        throw new Error('No response body');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = '';
      let fullAnswer = '';
      let allCitations: SearchResult[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        textBuffer += decoder.decode(value, { stream: true });

        // Process line-by-line
        let newlineIndex: number;
        while ((newlineIndex = textBuffer.indexOf('\n')) !== -1) {
          const line = textBuffer.slice(0, newlineIndex).trim();
          textBuffer = textBuffer.slice(newlineIndex + 1);

          if (!line || line.startsWith(':')) continue;
          if (!line.startsWith('data: ')) continue;

          const jsonStr = line.slice(6).trim();
          if (jsonStr === '[DONE]') continue;

          try {
            const parsed = JSON.parse(jsonStr);
            
            // Handle citations first
            if (parsed.citations && Array.isArray(parsed.citations)) {
              allCitations = parsed.citations.map((url: string, idx: number) => ({
                title: `Source ${idx + 1}`,
                url,
                snippet: '',
              }));
              setCitations(allCitations);
              options?.onCitation?.(allCitations);
            }

            // Handle streaming content
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullAnswer += content;
              setAnswer(fullAnswer);
              options?.onToken?.(content);
            }
          } catch {
            // Partial JSON, wait for more data
          }
        }
      }

      const finalResponse: SearchResponse = {
        answer: fullAnswer,
        citations: allCitations,
        isComplete: true,
      };

      options?.onComplete?.(finalResponse);
      return finalResponse;

    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('Search cancelled');
        return;
      }
      console.error('Search error:', error);
      options?.onError?.(error as Error);
      throw error;
    } finally {
      setIsSearching(false);
      abortControllerRef.current = null;
    }
  }, []);

  const cancelSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsSearching(false);
    }
  }, []);

  const reset = useCallback(() => {
    setAnswer('');
    setCitations([]);
    setIsSearching(false);
  }, []);

  return {
    search,
    cancelSearch,
    reset,
    isSearching,
    answer,
    citations,
  };
}
