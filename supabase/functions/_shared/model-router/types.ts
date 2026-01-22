// supabase/functions/_shared/model-router/types.ts

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'function';
  content: string;
  name?: string;
  function_call?: {
    name: string;
    arguments: string;
  };
}

export interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  functions?: FunctionDefinition[];
  user_id?: string;
  run_id?: string;
  capability?: string;
}

export interface FunctionDefinition {
  name: string;
  description: string;
  parameters: Record<string, any>;
}

export interface ChatResponse {
  id: string;
  model: string;
  provider: string;
  content: string;
  finish_reason: string;
  usage: TokenUsage;
  latency_ms: number;
}

export interface TokenUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface ProviderConfig {
  id: string;
  name: string;
  api_base: string;
  api_key_env: string;
  format: 'openai' | 'anthropic' | 'google' | 'custom';
  headers?: Record<string, string>;
}

export interface FallbackChain {
  primary: string;
  fallbacks: string[];
  max_retries: number;
}

export const PROVIDER_CONFIGS: Record<string, ProviderConfig> = {
  google: {
    id: 'google',
    name: 'Google',
    api_base: 'https://generativelanguage.googleapis.com/v1beta',
    api_key_env: 'GEMINI_API_KEY',
    format: 'google'
  },
  openai: {
    id: 'openai',
    name: 'OpenAI',
    api_base: 'https://api.openai.com/v1',
    api_key_env: 'OPENAI_API_KEY',
    format: 'openai'
  },
  anthropic: {
    id: 'anthropic',
    name: 'Anthropic',
    api_base: 'https://api.anthropic.com/v1',
    api_key_env: 'ANTHROPIC_API_KEY',
    format: 'anthropic'
  },
  deepseek: {
    id: 'deepseek',
    name: 'DeepSeek',
    api_base: 'https://api.deepseek.com/v1',
    api_key_env: 'DEEPSEEK_API_KEY',
    format: 'openai'
  },
  xai: {
    id: 'xai',
    name: 'xAI',
    api_base: 'https://api.x.ai/v1',
    api_key_env: 'XAI_API_KEY',
    format: 'openai'
  }
};

export const FALLBACK_CHAINS: Record<string, FallbackChain> = {
  default: {
    primary: 'gemini-2.5-flash',
    fallbacks: ['gpt-4o-mini', 'claude-3-5-haiku', 'deepseek-chat'],
    max_retries: 3
  },
  vision: {
    primary: 'gemini-2.5-flash',
    fallbacks: ['gpt-4o', 'claude-3-5-sonnet'],
    max_retries: 2
  },
  code: {
    primary: 'gemini-2.5-flash',
    fallbacks: ['claude-3-5-sonnet', 'deepseek-chat', 'gpt-4o-mini'],
    max_retries: 3
  },
  reasoning: {
    primary: 'gemini-2.5-pro',
    fallbacks: ['claude-3-5-sonnet', 'gpt-4o', 'deepseek-reasoner'],
    max_retries: 2
  }
};
