/**
 * Manus API Client
 * Direct integration with Manus.im API for full parity
 */

export interface ManusConfig {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface ManusMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ManusToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export interface ManusCompletionRequest {
  model: string;
  messages: ManusMessage[];
  tools?: ManusToolDefinition[];
  tool_choice?: 'auto' | 'none' | { type: 'function'; function: { name: string } };
  max_tokens?: number;
  temperature?: number;
  stream?: boolean;
}

export interface ManusToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface ManusCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string | null;
      tool_calls?: ManusToolCall[];
    };
    finish_reason: 'stop' | 'tool_calls' | 'length';
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ManusStreamChunk {
  id: string;
  object: 'chat.completion.chunk';
  created: number;
  model: string;
  choices: Array<{
    index: number;
    delta: {
      role?: 'assistant';
      content?: string;
      tool_calls?: Array<{
        index: number;
        id?: string;
        type?: 'function';
        function?: {
          name?: string;
          arguments?: string;
        };
      }>;
    };
    finish_reason: 'stop' | 'tool_calls' | 'length' | null;
  }>;
}

export class ManusClient {
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(config: ManusConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://api.manus.im/v1';
    this.timeout = config.timeout || 120000;
  }

  /**
   * Create a chat completion (non-streaming)
   */
  async createCompletion(request: ManusCompletionRequest): Promise<ManusCompletionResponse> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        stream: false,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ManusAPIError(response.status, error);
    }

    return response.json();
  }

  /**
   * Create a streaming chat completion
   */
  async *createStreamingCompletion(
    request: ManusCompletionRequest
  ): AsyncGenerator<ManusStreamChunk, void, unknown> {
    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...request,
        stream: true,
      }),
      signal: AbortSignal.timeout(this.timeout),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new ManusAPIError(response.status, error);
    }

    if (!response.body) {
      throw new ManusAPIError(500, 'No response body');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const chunk = JSON.parse(trimmed.slice(6)) as ManusStreamChunk;
              yield chunk;
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

export class ManusAPIError extends Error {
  constructor(
    public statusCode: number,
    public details: string
  ) {
    super(`Manus API Error (${statusCode}): ${details}`);
    this.name = 'ManusAPIError';
  }
}

// ===========================================
// TOOL DEFINITIONS (Manus-parity)
// ===========================================

export const MANUS_TOOLS: ManusToolDefinition[] = [
  {
    name: 'message',
    description: 'Send a message to the user',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['info', 'ask', 'result'],
          description: 'Message type',
        },
        text: {
          type: 'string',
          description: 'Message content',
        },
        attachments: {
          type: 'array',
          items: { type: 'string' },
          description: 'File paths to attach',
        },
      },
      required: ['type', 'text'],
    },
  },
  {
    name: 'plan',
    description: 'Create or update the task execution plan',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['update', 'advance'],
          description: 'Plan action',
        },
        goal: {
          type: 'string',
          description: 'Task goal',
        },
        phases: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'number' },
              title: { type: 'string' },
              capabilities: { type: 'object' },
            },
          },
          description: 'Execution phases',
        },
        current_phase_id: { type: 'number' },
        next_phase_id: { type: 'number' },
      },
      required: ['action', 'current_phase_id'],
    },
  },
  {
    name: 'shell',
    description: 'Execute shell commands in the sandbox',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['exec', 'view', 'wait', 'send', 'kill'],
        },
        session: { type: 'string' },
        command: { type: 'string' },
        timeout: { type: 'number' },
        input: { type: 'string' },
        brief: { type: 'string' },
      },
      required: ['action', 'session', 'brief'],
    },
  },
  {
    name: 'file',
    description: 'Read, write, or edit files',
    parameters: {
      type: 'object',
      properties: {
        action: {
          type: 'string',
          enum: ['view', 'read', 'write', 'append', 'edit'],
        },
        path: { type: 'string' },
        text: { type: 'string' },
        range: {
          type: 'array',
          items: { type: 'number' },
        },
        edits: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              find: { type: 'string' },
              replace: { type: 'string' },
              all: { type: 'boolean' },
            },
          },
        },
        brief: { type: 'string' },
      },
      required: ['action', 'path', 'brief'],
    },
  },
  {
    name: 'search',
    description: 'Search for information',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['info', 'image', 'api', 'news', 'tool', 'data', 'research'],
        },
        queries: {
          type: 'array',
          items: { type: 'string' },
        },
        time: {
          type: 'string',
          enum: ['all', 'past_day', 'past_week', 'past_month', 'past_year'],
        },
        brief: { type: 'string' },
      },
      required: ['type', 'queries', 'brief'],
    },
  },
  {
    name: 'browser_navigate',
    description: 'Navigate browser to a URL',
    parameters: {
      type: 'object',
      properties: {
        url: { type: 'string' },
        intent: {
          type: 'string',
          enum: ['navigational', 'informational', 'transactional'],
        },
        focus: { type: 'string' },
        brief: { type: 'string' },
      },
      required: ['url', 'intent', 'brief'],
    },
  },
  {
    name: 'browser_click',
    description: 'Click an element on the page',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number' },
        coordinate_x: { type: 'number' },
        coordinate_y: { type: 'number' },
        brief: { type: 'string' },
      },
      required: ['brief'],
    },
  },
  {
    name: 'browser_input',
    description: 'Input text into a field',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'number' },
        text: { type: 'string' },
        press_enter: { type: 'boolean' },
        brief: { type: 'string' },
      },
      required: ['text', 'press_enter', 'brief'],
    },
  },
];

// Default export for convenience
export default ManusClient;
