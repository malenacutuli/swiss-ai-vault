import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

export function useGhostInference() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'connecting' | 'streaming' | 'complete'>('idle');
  const abortControllerRef = useRef<AbortController | null>(null);

  const streamResponse = useCallback(async (
    messages: Array<{ role: string; content: string }>,
    model: string,
    callbacks: StreamCallbacks
  ) => {
    setIsStreaming(true);
    setStreamStatus('connecting');
    
    let fullContent = '';
    const startTime = Date.now();
    let firstTokenTime: number | null = null;
    
    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghost-inference`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
            'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({ messages, model, stream: true }),
          signal: abortControllerRef.current.signal,
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || `HTTP ${response.status}`);
        } catch {
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('No response body');

      const decoder = new TextDecoder();
      setStreamStatus('streaming');
      
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        
        // Keep the last potentially incomplete line in buffer
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          
          if (!trimmedLine || trimmedLine.startsWith(':')) continue;
          
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6).trim();
            
            if (data === '[DONE]') {
              setStreamStatus('complete');
              callbacks.onComplete(fullContent);
              console.log(`[Ghost Streaming] Complete in ${Date.now() - startTime}ms`);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              
              // Handle vLLM/OpenAI compatible streaming format
              const delta = parsed.choices?.[0]?.delta;
              const content = delta?.content || parsed.content;
              
              if (content) {
                if (!firstTokenTime) {
                  firstTokenTime = Date.now();
                  console.log(`[Ghost Streaming] First token in ${firstTokenTime - startTime}ms`);
                }
                
                fullContent += content;
                callbacks.onToken(content);
              }
              
              // Check for errors in stream
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (e) {
              // Skip malformed JSON chunks - common in SSE streams
              if (data !== '' && !data.startsWith('{')) {
                console.debug('[Ghost Streaming] Skipping non-JSON chunk:', data.slice(0, 50));
              }
            }
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim()) {
        const trimmedLine = buffer.trim();
        if (trimmedLine.startsWith('data: ')) {
          const data = trimmedLine.slice(6).trim();
          if (data !== '[DONE]') {
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content || parsed.content;
              if (content) {
                fullContent += content;
                callbacks.onToken(content);
              }
            } catch { /* ignore */ }
          }
        }
      }

      callbacks.onComplete(fullContent);
      console.log(`[Ghost Streaming] Total time: ${Date.now() - startTime}ms`);
      
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        console.log('[Ghost Streaming] Aborted by user');
        callbacks.onComplete(fullContent); // Save partial response
      } else {
        console.error('[Ghost Streaming] Error:', error);
        callbacks.onError(error as Error);
      }
    } finally {
      setIsStreaming(false);
      setStreamStatus('idle');
      abortControllerRef.current = null;
    }
  }, []);

  const cancelStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  return {
    streamResponse,
    cancelStream,
    isStreaming,
    streamStatus,
  };
}
