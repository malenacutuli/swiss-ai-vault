// src/lib/agents/core/llm.ts
// LLM invocation for Swiss Agents

import { supabase } from '@/integrations/supabase/client';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
}

export interface LLMRequest {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  maxTokens?: number;
  responseFormat?: 'text' | 'json';
  tools?: ToolDefinition[];
  toolChoice?: 'auto' | 'required' | 'none';
}

export interface LLMResponse {
  content: string;
  toolCalls?: Array<{
    name: string;
    parameters: Record<string, unknown>;
  }>;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export async function invokeLLM(request: LLMRequest): Promise<string> {
  try {
    // Use the ghost-inference edge function for LLM calls
    const { data, error } = await supabase.functions.invoke('ghost-inference', {
      body: {
        messages: request.messages,
        model: request.model || 'google/gemini-2.5-flash',
        temperature: request.temperature ?? 0.7,
        max_tokens: request.maxTokens ?? 4096,
        response_format: request.responseFormat === 'json' 
          ? { type: 'json_object' } 
          : undefined,
        tools: request.tools?.map(t => ({
          type: 'function',
          function: {
            name: t.name,
            description: t.description,
            parameters: t.parameters
          }
        })),
        tool_choice: request.toolChoice
      }
    });

    if (error) {
      console.error('LLM invocation error:', error);
      throw new Error(`LLM error: ${error.message}`);
    }

    // Handle response format
    if (data?.choices?.[0]?.message?.content) {
      return data.choices[0].message.content;
    }

    if (data?.content) {
      return data.content;
    }

    if (data?.text) {
      return data.text;
    }

    // Handle tool calls
    if (data?.choices?.[0]?.message?.tool_calls) {
      const toolCall = data.choices[0].message.tool_calls[0];
      return JSON.stringify({
        tool: toolCall.function.name,
        parameters: JSON.parse(toolCall.function.arguments || '{}')
      });
    }

    // Fallback
    return typeof data === 'string' ? data : JSON.stringify(data);
  } catch (err) {
    console.error('Failed to invoke LLM:', err);
    throw err;
  }
}

export async function invokeLLMStreaming(
  request: LLMRequest,
  onChunk: (chunk: string) => void
): Promise<string> {
  // For streaming, we'd use SSE or WebSocket
  // For now, fall back to non-streaming
  const result = await invokeLLM(request);
  onChunk(result);
  return result;
}
