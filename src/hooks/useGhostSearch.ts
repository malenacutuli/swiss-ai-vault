import { useState, useCallback, useRef, useEffect } from 'react';

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
  // All hooks called unconditionally at top level
  const [isSearching, setIsSearching] = useState(false);
  const [answer, setAnswer] = useState('');
  const [citations, setCitations] = useState<SearchResult[]>([]);

  // Track mounted state to prevent updates after unmount
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;
      // Abort any pending requests on unmount
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const search = useCallback(
    async (query: string, options?: UseGhostSearchOptions) => {
      if (!query.trim()) return;

      // Cancel previous request if any
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      // Only update state if mounted
      if (isMountedRef.current) {
        setIsSearching(true);
        setAnswer('');
        setCitations([]);
      }

      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghost-web-search`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ query }),
            signal: abortControllerRef.current.signal,
          }
        );

        // Check if still mounted
        if (!isMountedRef.current) return;

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
          // Check if still mounted before each iteration
          if (!isMountedRef.current) {
            try {
              await reader.cancel();
            } catch {
              // ignore
            }
            return;
          }

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
                if (isMountedRef.current) {
                  setCitations(allCitations);
                }
                options?.onCitation?.(allCitations);
              }

              // Handle streaming content
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                fullAnswer += content;
                if (isMountedRef.current) {
                  setAnswer(fullAnswer);
                }
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

        if (isMountedRef.current) {
          options?.onComplete?.(finalResponse);
        }
        return finalResponse;
      } catch (error) {
        const err = error as Error;

        if (err.name === 'AbortError') {
          console.log('[GhostSearch] Search cancelled');
          return;
        }

        console.error('[GhostSearch] Search error:', err);

        if (isMountedRef.current) {
          options?.onError?.(err);
        }
        throw err;
      } finally {
        if (isMountedRef.current) {
          setIsSearching(false);
        }
        abortControllerRef.current = null;
      }
    },
    []
  );

  const cancelSearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (isMountedRef.current) {
      setIsSearching(false);
    }
  }, []);

  const reset = useCallback(() => {
    if (isMountedRef.current) {
      setAnswer('');
      setCitations([]);
      setIsSearching(false);
    }
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
