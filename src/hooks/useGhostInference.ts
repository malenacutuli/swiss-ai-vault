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

export type StreamStatus = 'idle' | 'connecting' | 'generating' | 'complete' | 'error' | 'timeout' | 'stuck';

// Timeout constants
const MAX_STREAM_TIMEOUT_MS = 120000; // 2 minutes max for entire stream
const STUCK_DETECTION_MS = 30000; // 30 seconds without tokens = stuck
const CONNECTION_TIMEOUT_MS = 45000; // 45 seconds to connect (for Edge Function cold starts)

export function useGhostInference() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>('idle');
  const [elapsedTime, setElapsedTime] = useState(0);
  const [lastResponseTime, setLastResponseTime] = useState<number | null>(null);
  const [lastTokenCount, setLastTokenCount] = useState<number | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const streamStartRef = useRef<number | null>(null);
  const currentRequestIdRef = useRef<string | null>(null);
  const lastTokenTimeRef = useRef<number | null>(null);
  const stuckCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const maxTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // IMPORTANT: avoid stale closures inside intervals/timeouts
  const streamStatusRef = useRef<StreamStatus>('idle');
  useEffect(() => {
    streamStatusRef.current = streamStatus;
  }, [streamStatus]);

  // Cleanup function to clear all timers
  const cleanup = useCallback(() => {
    if (stuckCheckIntervalRef.current) {
      clearInterval(stuckCheckIntervalRef.current);
      stuckCheckIntervalRef.current = null;
    }
    if (maxTimeoutRef.current) {
      clearTimeout(maxTimeoutRef.current);
      maxTimeoutRef.current = null;
    }
  }, []);

  // Timer effect for elapsed time during streaming
  // Throttled to 1000ms to reduce re-renders and prevent sidebar flickering
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isStreaming && streamStartRef.current) {
      interval = setInterval(() => {
        setElapsedTime((Date.now() - streamStartRef.current!) / 1000);
      }, 1000); // Reduced from 100ms to 1000ms to prevent UI flickering
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [cleanup]);

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

      // Capture the request ID at this point for closure
      const capturedRequestId = thisRequestId;
      const isCurrent = () => currentRequestIdRef.current === capturedRequestId;

      console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Starting request for model: ${model}`);

      // Abort any existing request first
      if (abortControllerRef.current) {
        console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Aborting previous request`);
        abortControllerRef.current.abort();
      }

      // Clean up previous timers
      cleanup();

      setIsStreaming(true);
      setStreamStatus('connecting');
      setElapsedTime(0);
      setLastResponseTime(null);
      setLastTokenCount(null);
      streamStartRef.current = Date.now();
      lastTokenTimeRef.current = null;

      let fullContent = '';
      const startTime = Date.now();
      let firstTokenTime: number | null = null;
      let tokenCount = 0;
      let hasCompleted = false;

      // Helper to mark completion (ensures we only complete once)
      const markComplete = (content: string, status: StreamStatus = 'complete') => {
        if (hasCompleted) {
          console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Already completed, ignoring duplicate`);
          return;
        }
        hasCompleted = true;
        cleanup();
        
        console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Marking complete with status: ${status}, content length: ${content.length}`);
        
        setStreamStatus(status);
        setIsStreaming(false);
        setLastResponseTime(Date.now() - startTime);
        abortControllerRef.current = null;
        
        // Always call onComplete, even for stale requests (to update UI state)
        callbacks.onComplete(content);
      };

      // Helper to mark error
      const markError = (error: Error) => {
        if (hasCompleted) return;
        hasCompleted = true;
        cleanup();
        
        console.error(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Error:`, error.message);
        
        setStreamStatus('error');
        setIsStreaming(false);
        abortControllerRef.current = null;
        callbacks.onError(error);
      };

      // Create abort controller for cancellation
      abortControllerRef.current = new AbortController();

      // Set up max timeout
      maxTimeoutRef.current = setTimeout(() => {
        if (!hasCompleted && isCurrent()) {
          console.warn(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Max timeout (${MAX_STREAM_TIMEOUT_MS}ms) reached`);
          setStreamStatus('timeout');
          
          if (abortControllerRef.current) {
            abortControllerRef.current.abort();
          }
          
          // Complete with whatever we have, or error message
          const content = fullContent.trim() || 'Request timed out. Please try again.';
          markComplete(content, 'timeout');
        }
      }, MAX_STREAM_TIMEOUT_MS);

      // Set up stuck detection (checks every 5 seconds)
      stuckCheckIntervalRef.current = setInterval(() => {
        if (hasCompleted || !isCurrent()) {
          cleanup();
          return;
        }

        const now = Date.now();
        const lastActivity = lastTokenTimeRef.current || startTime;
        const timeSinceActivity = now - lastActivity;
        const currentStatus = streamStatusRef.current;

        // Check for stuck state (no tokens for STUCK_DETECTION_MS)
        if (currentStatus === 'generating' && timeSinceActivity > STUCK_DETECTION_MS) {
          console.warn(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Stuck detected: ${timeSinceActivity}ms without tokens`);
          setStreamStatus('stuck');

          // If we have content, complete with it; otherwise, error
          if (fullContent.trim()) {
            markComplete(fullContent, 'stuck');
          } else {
            markError(new Error('Response stalled. Please try again.'));
          }
        }

        // Check for connection timeout
        if (currentStatus === 'connecting' && timeSinceActivity > CONNECTION_TIMEOUT_MS) {
          console.warn(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Connection timeout: ${timeSinceActivity}ms`);
          markError(new Error('Connection timeout. Please check your network and try again.'));
        }
      }, 5000);

      try {
        const { data: { session } } = await supabase.auth.getSession();
        const isAnonymous = !session;
        
        if (!isCurrent()) {
          console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Request became stale after auth`);
          return;
        }

        console.log('[Ghost Inference] Sending request:', {
          requestId: capturedRequestId.slice(0, 8),
          model,
          messageCount: messages.length,
          stream: true,
          isAnonymous,
        });

        // Build headers
        // - apikey is always required
        // - Authorization is required because backend functions validate JWT by default
        //   (anonymous users use the publishable "anon" JWT; authenticated users use their session JWT)
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          Authorization: session
            ? `Bearer ${session.access_token}`
            : `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          'X-Request-ID': capturedRequestId,
        };

        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ghost-inference`,
          {
            method: 'POST',
            headers,
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

        if (!isCurrent()) {
          console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Request became stale after fetch`);
          return;
        }

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
        console.log('[Ghost Inference] Response content-type:', contentType, 'requestId:', capturedRequestId.slice(0, 8));

        // ==========================================
        // HANDLE NON-STREAMING JSON RESPONSE
        // ==========================================
        if (contentType.includes('application/json')) {
          console.log('[Ghost Inference] Detected JSON response (non-streaming)');
          setStreamStatus('generating');
          lastTokenTimeRef.current = Date.now();

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
          callbacks.onToken(content);
          
          if (data.usage?.total_tokens) {
            setLastTokenCount(data.usage.total_tokens);
          }

          console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] JSON response complete in ${Date.now() - startTime}ms`);
          markComplete(fullContent);
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
        lastTokenTimeRef.current = Date.now();

        let buffer = '';

        while (true) {
          if (!isCurrent()) {
            console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Request became stale during stream`);
            try {
              await reader.cancel();
            } catch {
              // ignore
            }
            // Still complete with what we have if stale
            if (fullContent.trim()) {
              markComplete(fullContent);
            }
            return;
          }

          if (hasCompleted) {
            console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Already completed, breaking stream loop`);
            break;
          }

          const { done, value } = await reader.read();
          if (done) {
            console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Stream reader done, total tokens: ${tokenCount}`);
            break;
          }

          // Update last token time on any data received
          lastTokenTimeRef.current = Date.now();

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
                console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Received [DONE] marker`);
                markComplete(fullContent);
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
                    console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] First token in ${firstTokenTime - startTime}ms`);
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
        if (buffer.trim() && isCurrent() && !hasCompleted) {
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

        // Stream ended without [DONE] - still complete
        if (!hasCompleted && isCurrent()) {
          // Warn if stream ended with no content
          if (!fullContent.trim()) {
            console.warn(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Stream completed with empty content`);
          }
          console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Total time: ${Date.now() - startTime}ms, content length: ${fullContent.length}`);
          markComplete(fullContent);
        }
      } catch (error) {
        const err = error as Error;

        if (err.name === 'AbortError') {
          console.log(`[Ghost Inference] [${capturedRequestId.slice(0, 8)}] Aborted`);
          cleanup();
          setStreamStatus('idle');
          setIsStreaming(false);
          // IMPORTANT: do NOT call onComplete on user-initiated abort; it causes blank assistant messages.
          return;
        }

        markError(err);
      }
    },
    [cleanup]
  );

  const cancelStream = useCallback(() => {
    cleanup();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsStreaming(false);
    setStreamStatus('idle');
  }, [cleanup]);

  // Force reset streaming state (for recovery)
  const resetStreamState = useCallback(() => {
    cleanup();
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    currentRequestIdRef.current = null;
    setIsStreaming(false);
    setStreamStatus('idle');
    setElapsedTime(0);
  }, [cleanup]);

  return {
    streamResponse,
    cancelStream,
    resetStreamState,
    isStreaming,
    streamStatus,
    elapsedTime,
    lastResponseTime,
    lastTokenCount,
  };
}
