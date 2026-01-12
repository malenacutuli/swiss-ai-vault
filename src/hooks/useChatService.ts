// src/hooks/useChatService.ts
import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  model?: string;
  temperature?: number;
  max_tokens?: number;
  capability?: string;
}

export interface ChatResponse {
  id: string;
  model: string;
  provider: string;
  content: string;
  finish_reason: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  latency_ms: number;
}

export function useChatService() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResponse, setLastResponse] = useState<ChatResponse | null>(null);

  const sendMessage = useCallback(async (
    messages: ChatMessage[],
    options: ChatOptions = {}
  ): Promise<ChatResponse | null> => {
    setIsLoading(true);
    setError(null);

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('chat', {
        body: {
          messages,
          model: options.model,
          temperature: options.temperature ?? 0.7,
          max_tokens: options.max_tokens ?? 4096,
          capability: options.capability
        }
      });

      if (invokeError) throw invokeError;

      setLastResponse(data);
      return data;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    sendMessage,
    isLoading,
    error,
    lastResponse
  };
}
