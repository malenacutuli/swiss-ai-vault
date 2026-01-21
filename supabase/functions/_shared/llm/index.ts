// LLM Integration Module
// Provides unified interface for calling language models

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  tool_name?: string;
}

export interface LLMResponse {
  choices: Array<{
    message: {
      role: string;
      content: string | null;
      tool_calls?: Array<{
        id: string;
        type: string;
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface LLMOptions {
  messages: LLMMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: {
    type: string;
    json_schema?: {
      name: string;
      strict?: boolean;
      schema: Record<string, unknown>;
    };
  };
  tools?: Array<{
    type: string;
    function: {
      name: string;
      description: string;
      parameters: Record<string, unknown>;
    };
  }>;
}

// Main LLM invocation function
export async function invokeLLM(options: LLMOptions): Promise<LLMResponse> {
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY environment variable not set');
  }

  // Use current Claude model (claude-sonnet-4-20250514 is the latest as of 2025)
  const model = options.model || 'claude-sonnet-4-20250514';

  // Convert to Anthropic format
  const messages = options.messages.map(msg => ({
    role: msg.role === 'system' ? 'user' : msg.role,
    content: msg.content,
  }));

  // System message handling (Anthropic requires system as separate parameter)
  const systemMessages = options.messages.filter(m => m.role === 'system');
  const system = systemMessages.length > 0 ? systemMessages[0].content : undefined;
  const nonSystemMessages = options.messages.filter(m => m.role !== 'system');

  const requestBody: Record<string, unknown> = {
    model,
    messages: nonSystemMessages.map(msg => ({
      role: msg.role === 'tool' ? 'user' : msg.role,
      content: msg.content,
    })),
    max_tokens: options.max_tokens || 4096,
    temperature: options.temperature ?? 1.0,
  };

  if (system) {
    requestBody.system = system;
  }

  // Handle JSON schema response format
  if (options.response_format?.type === 'json_schema' && options.response_format.json_schema) {
    // Anthropic doesn't support JSON schema directly, so we'll add it to the system prompt
    const schemaInstruction = `\n\nYou must respond with valid JSON matching this schema:\n${JSON.stringify(options.response_format.json_schema.schema, null, 2)}`;
    if (requestBody.system) {
      requestBody.system = `${requestBody.system}${schemaInstruction}`;
    } else {
      requestBody.system = schemaInstruction.trim();
    }
  }

  // Make API call to Anthropic
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Anthropic API error: ${response.status} ${error}`);
  }

  const data = await response.json();

  // Convert Anthropic response to OpenAI-compatible format
  return {
    choices: [{
      message: {
        role: 'assistant',
        content: data.content[0]?.text || null,
      },
      finish_reason: data.stop_reason || 'stop',
    }],
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
  };
}

// Helper function to extract JSON from LLM response
export function extractJSON(content: string): Record<string, unknown> | null {
  try {
    // Try to parse directly
    return JSON.parse(content);
  } catch {
    // Try to extract JSON from markdown code block
    const match = content.match(/```json\n([\s\S]*?)\n```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  }
}
