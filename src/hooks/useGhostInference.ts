import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: (fullResponse: string) => void;
  onError: (error: Error) => void;
}

// Content part types for multimodal messages
export type MessageContentPart = 
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'auto' | 'low' | 'high' } };

export type MessageContent = string | MessageContentPart[];

interface StreamOptions {
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
}

export type StreamStatus = 'idle' | 'connecting' | 'generating' | 'complete' | 'error';

export function useGhostInference() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lastResponseTime, setLastResponseTime] = useState<number | null>(null);
  const [lastTokenCount, setLastTokenCount] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamStartRef = useRef<number | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);

  // Timer effect for elapsed time during streaming
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isStreaming && streamStartRef.current) {
      interval = setInterval(() => {
        setElapsedTime((Date.now() - streamStartRef.current!) / 1000);
      }, 100);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming]);

  const streamResponse = useCallback(
    async (
      messages: Array<{ role: string; content: MessageContent }>,
      model: string,
      callbacks: StreamCallbacks,
      options?: StreamOptions,
      requestId?: string
    ) => {
      const thisRequestId = requestId ?? crypto.randomUUID();
      currentRequestIdRef.current = thisRequestId;

      const isCurrent = () => currentRequestIdRef.current === thisRequestId;

      // Abort any existing request first
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      setIsStreaming(true);
      setStreamStatus('connecting');
      setElapsedTime(0);
      setLastResponseTime(null);
      setLastTokenCount(null);
      streamStartRef.current = Date.now();

      let fullContent = '';
      const startTime = Date.now();
      let firstTokenTime: number | null = null;

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Not authenticated');
        if (!isCurrent()) return;

        console.log('[Ghost Inference] Sending request:', {
          model,
          messageCount: messages.length,
          stream: true,
        });

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghost-inference`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
              'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            },
            body: JSON.stringify({
              messages,
              model,
              stream: true,
              system_prompt: options?.systemPrompt,
              temperature: options?.temperature ?? 0.7,
              top_p: options?.topP ?? 0.9,
            }),
            signal: abortControllerRef.current.signal,
          }
        );

        if (!isCurrent()) return;

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[Ghost Inference] HTTP error:', response.status, errorText);
          try {
            const errorJson = JSON.parse(errorText);
            throw new Error(errorJson.error || `HTTP ${response.status}`);
          } catch {
            throw new Error(`HTTP ${response.status}: ${errorText}`);
          }
        }

        const contentType = response.headers.get('content-type') || '';
        console.log('[Ghost Inference] Response content-type:', contentType);

        // ==========================================
        // HANDLE NON-STREAMING JSON RESPONSE
        // ==========================================
        if (contentType.includes('application/json')) {
          console.log('[Ghost Inference] Detected JSON response (non-streaming)');
          setStreamStatus('generating');

          const data = await response.json();
          if (!isCurrent()) return;

          console.log('[Ghost Inference] JSON response:', JSON.stringify(data).substring(0, 500));

          // Extract content from various possible JSON shapes
          let content = '';

          // OpenAI format: choices[0].message.content
          if (data.choices?.[0]?.message?.content) {
            content = data.choices[0].message.content;
          }
          // Delta format: choices[0].delta.content
          else if (data.choices?.[0]?.delta?.content) {
            content = data.choices[0].delta.content;
          }
          // Direct content field
          else if (data.content) {
            content = typeof data.content === 'string' ? data.content : JSON.stringify(data.content);
          }
          // Output field (some models)
          else if (data.output) {
            content = data.output;
          }
          // Generated text field
          else if (data.generated_text) {
            content = data.generated_text;
          }
          // Error in response
          else if (data.error) {
            throw new Error(data.error);
          }

          if (!content) {
            console.error('[Ghost Inference] Could not extract content from response:', data);
            throw new Error('No content in response');
          }

          fullContent = content;
          if (isCurrent()) {
            callbacks.onToken(content);
            setStreamStatus('complete');
            callbacks.onComplete(fullContent);
          }

          setLastResponseTime(Date.now() - startTime);
          if (data.usage?.total_tokens) {
            setLastTokenCount(data.usage.total_tokens);
          }

          console.log(`[Ghost Inference] JSON response complete in ${Date.now() - startTime}ms`);
          return;
        }

        // ==========================================
        // HANDLE SSE STREAMING RESPONSE
        // ==========================================
        console.log('[Ghost Inference] Starting SSE stream processing');
        const reader = response.body?.getReader();
        if (!reader) throw new Error('No response body');

        const decoder = new TextDecoder();
        setStreamStatus('generating');

        let buffer = '';
        let tokenCount = 0;

        while (true) {
          if (!isCurrent()) {
            try {
              await reader.cancel();
            } catch {
              // ignore
            }
            return;
          }

          const { done, value } = await reader.read();
          if (done) {
            console.log('[Ghost Inference] Stream reader done, total tokens:', tokenCount);
            break;
          }

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
                if (isCurrent()) {
                  setStreamStatus('complete');
                  callbacks.onComplete(fullContent);
                  setLastResponseTime(Date.now() - startTime);
                  console.log(`[Ghost Inference] Stream complete in ${Date.now() - startTime}ms`);
                }
                return;
              }

              try {
                const parsed = JSON.parse(data);

                // Handle vLLM/OpenAI compatible streaming format
                const delta = parsed.choices?.[0]?.delta;
                const content = delta?.content || parsed.content;

                if (content && isCurrent()) {
                  if (!firstTokenTime) {
                    firstTokenTime = Date.now();
                    console.log(`[Ghost Inference] First token in ${firstTokenTime - startTime}ms`);
                  }

                  tokenCount++;
                  fullContent += content;
                  callbacks.onToken(content);
                }

                // Check for errors in stream
                if (parsed.error) {
                  throw new Error(parsed.error);
                }

                // Capture usage if provided
                if (parsed.usage?.total_tokens) {
                  setLastTokenCount(parsed.usage.total_tokens);
                }
              } catch (e) {
                // Skip malformed JSON chunks - common in SSE streams
                if (data !== '' && !data.startsWith('{')) {
                  console.debug('[Ghost Inference] Skipping non-JSON chunk:', data.slice(0, 50));
                }
              }
            }
          }
        }

        // Process any remaining buffer
        if (buffer.trim() && isCurrent()) {
          const trimmedLine = buffer.trim();
          if (trimmedLine.startsWith('data: ')) {
            const data = trimmedLine.slice(6).trim();
            if (data !== '[DONE]') {
              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content || parsed.content;
                if (content && isCurrent()) {
                  fullContent += content;
                  callbacks.onToken(content);
                }
              } catch {
                /* ignore */
              }
            }
          }
        }

        if (isCurrent()) {
          setStreamStatus('complete');
          // Warn if stream ended with no content
          if (!fullContent.trim()) {
            console.warn('[Ghost Inference] Stream completed with empty content - no tokens received');
          }
          callbacks.onComplete(fullContent);
          setLastResponseTime(Date.now() - startTime);
          console.log(`[Ghost Inference] Total time: ${Date.now() - startTime}ms, content length: ${fullContent.length}`);
        }
      } catch (error) {
        const err = error as Error;

        // If this stream is no longer current, ignore all terminal events.
        if (!isCurrent()) return;

        if (err.name === 'AbortError') {
          console.log('[Ghost Inference] Aborted');
          setStreamStatus('idle');
          // IMPORTANT: do NOT call onComplete on abort; it causes blank assistant messages.
          return;
        }

        console.error('[Ghost Inference] Error:', err);
        setStreamStatus('error');
        callbacks.onError(err);
      } finally {
        // Only clear flags if this is still the active request
        if (isCurrent()) {
          setIsStreaming(false);
          abortControllerRef.current = null;
          currentRequestIdRef.current = null;
        }
      }
    },
    []
  );

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
    elapsedTime,
    lastResponseTime,
    lastTokenCount,
  };
}

