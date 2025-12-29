import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ResearchSource {
  title: string;
  url: string;
  snippet?: string;
}

export interface ResearchResponse {
  content: string;
  sources: ResearchSource[];
  isComplete: boolean;
}

interface UseGhostResearchOptions {
  onToken?: (token: string) => void;
  onSources?: (sources: ResearchSource[]) => void;
  onComplete?: (response: ResearchResponse) => void;
  onError?: (error: Error) => void;
}

export function useGhostResearch() {
  const [isResearching, setIsResearching] = useState(false);
  const [content, setContent] = useState('');
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [progress, setProgress] = useState<string>('');

  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  const research = useCallback(
    async (query: string, options?: UseGhostResearchOptions) => {
      if (!query.trim()) return;

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      abortControllerRef.current = new AbortController();

      if (isMountedRef.current) {
        setIsResearching(true);
        setContent('');
        setSources([]);
        setProgress('Initiating deep research...');
      }

      try {
        // Get auth token if available
        const { data: { session } } = await supabase.auth.getSession();
        
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghost-deep-research`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: session?.access_token 
                ? `Bearer ${session.access_token}`
                : `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ 
              query,
              mode: 'comprehensive',
              include_sources: true,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!isMountedRef.current) return;

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          const error = new Error(errorData.error || `Research failed: ${response.status}`);
          options?.onError?.(error);
          throw error;
        }

        // Handle streaming response
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        let fullContent = '';
        let collectedSources: ResearchSource[] = [];

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (!isMountedRef.current) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            
            const data = line.slice(6);
            if (data === '[DONE]') continue;

            try {
              const parsed = JSON.parse(data);
              
              if (parsed.progress && isMountedRef.current) {
                setProgress(parsed.progress);
              }
              
              if (parsed.content) {
                fullContent += parsed.content;
                if (isMountedRef.current) {
                  setContent(fullContent);
                }
                options?.onToken?.(parsed.content);
              }
              
              if (parsed.sources) {
                collectedSources = parsed.sources;
                if (isMountedRef.current) {
                  setSources(collectedSources);
                }
                options?.onSources?.(collectedSources);
              }
            } catch {
              // Ignore parse errors for incomplete chunks
            }
          }
        }

        const finalResponse: ResearchResponse = {
          content: fullContent,
          sources: collectedSources,
          isComplete: true,
        };

        options?.onComplete?.(finalResponse);
        return finalResponse;

      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('[useGhostResearch] Request aborted');
          return;
        }
        console.error('[useGhostResearch] Error:', error);
        options?.onError?.(error instanceof Error ? error : new Error(String(error)));
        throw error;
      } finally {
        if (isMountedRef.current) {
          setIsResearching(false);
          setProgress('');
        }
      }
    },
    []
  );

  const cancelResearch = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (isMountedRef.current) {
      setIsResearching(false);
      setProgress('');
    }
  }, []);

  const reset = useCallback(() => {
    setContent('');
    setSources([]);
    setProgress('');
    setIsResearching(false);
  }, []);

  return {
    research,
    cancelResearch,
    reset,
    isResearching,
    content,
    sources,
    progress,
  };
}
