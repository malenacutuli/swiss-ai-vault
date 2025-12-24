export interface GhostModel {
  id: string;
  name: string;
  provider: 'modal' | 'openai' | 'anthropic' | 'google' | 'xai' | 'deepseek' | 'qwen' | 'replicate' | 'runway' | 'luma' | 'pika';
  modality: 'text' | 'image' | 'video';
  
  // Display
  icon?: string;  // Lucide icon name or custom SVG
  description: string;
  
  // Capabilities
  tags: Array<'private' | 'default' | 'new' | 'pay-per-use' | 'anonymized' | 'beta' | 'vision' | 'reasoning' | 'audio' | 'uncensored' | 'mature' | 'fast' | 'premium' | 'swiss' | 'code'>;
  contextWindow?: number;
  
  // Pricing
  creditCost: number;  // Per 1K tokens (text) or per generation (image/video)
  isPayPerUse: boolean;
  
  // Availability
  enabled: boolean;
  comingSoon?: boolean;
}

// ==============================================
// TEXT MODELS - Updated December 2025
// ==============================================

export const TEXT_MODELS: GhostModel[] = [
  // ========== SwissVault Branded Models (Swiss-Hosted, Zero Logging) ==========
  {
    id: 'swissvault-1.0',
    name: 'SwissVault 1.0',
    provider: 'modal',
    modality: 'text',
    description: 'Balanced performance. Swiss-hosted, zero logging.',
    tags: ['private', 'default', 'swiss'],
    contextWindow: 128000,
    creditCost: 1,
    isPayPerUse: false,
    enabled: true,
  },
  {
    id: 'swissvault-fast',
    name: 'SwissVault Fast',
    provider: 'modal',
    modality: 'text',
    description: 'Ultra-fast responses. Swiss-hosted.',
    tags: ['private', 'fast', 'swiss'],
    contextWindow: 32000,
    creditCost: 0.5,
    isPayPerUse: false,
    enabled: true,
  },
  {
    id: 'swissvault-code',
    name: 'SwissVault Code',
    provider: 'modal',
    modality: 'text',
    description: 'Optimized for coding. Swiss-hosted.',
    tags: ['private', 'code', 'swiss'],
    contextWindow: 128000,
    creditCost: 1.5,
    isPayPerUse: false,
    enabled: true,
  },
  {
    id: 'llama3.1-8b',
    name: 'Llama 3.1 8B',
    provider: 'modal',
    modality: 'text',
    description: "Meta's flagship 8B model. Swiss-hosted.",
    tags: ['private', 'swiss'],
    contextWindow: 128000,
    creditCost: 2,
    isPayPerUse: false,
    enabled: true,
  },
  {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    provider: 'modal',
    modality: 'text',
    description: 'European model, multilingual. Swiss-hosted.',
    tags: ['private', 'swiss'],
    contextWindow: 32000,
    creditCost: 1.5,
    isPayPerUse: false,
    enabled: true,
  },
  
  // ========== OpenAI - December 2025 ==========
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'openai',
    modality: 'text',
    description: 'Latest GPT. Function calling, reasoning.',
    tags: ['new', 'pay-per-use', 'anonymized', 'vision', 'reasoning'],
    contextWindow: 256000,
    creditCost: 10,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'gpt-5.2-mini',
    name: 'GPT-5.2 Mini',
    provider: 'openai',
    modality: 'text',
    description: 'Fast version of GPT-5.2.',
    tags: ['new', 'pay-per-use', 'anonymized', 'vision', 'fast'],
    contextWindow: 256000,
    creditCost: 3,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'o3',
    name: 'O3',
    provider: 'openai',
    modality: 'text',
    description: 'Newest reasoning model.',
    tags: ['new', 'pay-per-use', 'anonymized', 'reasoning', 'premium'],
    contextWindow: 200000,
    creditCost: 15,
    isPayPerUse: true,
    enabled: true,
    comingSoon: true,
  },
  {
    id: 'o1',
    name: 'O1',
    provider: 'openai',
    modality: 'text',
    description: 'Deep reasoning model.',
    tags: ['pay-per-use', 'anonymized', 'reasoning'],
    contextWindow: 200000,
    creditCost: 12,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'o1-mini',
    name: 'O1 Mini',
    provider: 'openai',
    modality: 'text',
    description: 'Fast reasoning model.',
    tags: ['pay-per-use', 'anonymized', 'reasoning', 'fast'],
    contextWindow: 128000,
    creditCost: 4,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    modality: 'text',
    description: 'OpenAI\'s multimodal flagship.',
    tags: ['pay-per-use', 'anonymized', 'vision', 'audio'],
    contextWindow: 128000,
    creditCost: 5,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'openai',
    modality: 'text',
    description: 'Fast and affordable multimodal.',
    tags: ['pay-per-use', 'anonymized', 'vision', 'fast'],
    contextWindow: 128000,
    creditCost: 1,
    isPayPerUse: true,
    enabled: true,
  },
  
  // ========== Anthropic - December 2025 ==========
  {
    id: 'claude-opus-4.5',
    name: 'Claude Opus 4.5',
    provider: 'anthropic',
    modality: 'text',
    description: 'Most intelligent Claude model.',
    tags: ['new', 'pay-per-use', 'anonymized', 'vision', 'reasoning', 'premium'],
    contextWindow: 200000,
    creditCost: 15,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    provider: 'anthropic',
    modality: 'text',
    description: 'Great balance of speed and intelligence.',
    tags: ['new', 'pay-per-use', 'anonymized', 'vision'],
    contextWindow: 200000,
    creditCost: 5,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    modality: 'text',
    description: 'Ultra fast Claude.',
    tags: ['new', 'pay-per-use', 'anonymized', 'fast'],
    contextWindow: 200000,
    creditCost: 1,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    modality: 'text',
    description: 'Vision and code specialist.',
    tags: ['pay-per-use', 'anonymized', 'vision'],
    contextWindow: 200000,
    creditCost: 3,
    isPayPerUse: true,
    enabled: true,
  },
  
  // ========== Google - December 2025 ==========
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    provider: 'google',
    modality: 'text',
    description: 'Latest Google model. Vision, reasoning.',
    tags: ['new', 'pay-per-use', 'anonymized', 'vision', 'reasoning'],
    contextWindow: 2000000,
    creditCost: 6,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'google',
    modality: 'text',
    description: 'Very capable multimodal.',
    tags: ['pay-per-use', 'anonymized', 'vision', 'reasoning'],
    contextWindow: 1000000,
    creditCost: 4,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'google',
    modality: 'text',
    description: 'Ultra-fast Google model.',
    tags: ['pay-per-use', 'anonymized', 'vision', 'fast'],
    contextWindow: 1000000,
    creditCost: 1,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'gemini-2.0-pro',
    name: 'Gemini 2.0 Pro',
    provider: 'google',
    modality: 'text',
    description: 'High quality multimodal.',
    tags: ['pay-per-use', 'anonymized', 'vision'],
    contextWindow: 1000000,
    creditCost: 5,
    isPayPerUse: true,
    enabled: true,
  },
  
  // ========== xAI - December 2025 ==========
  {
    id: 'grok-4.1',
    name: 'Grok 4.1',
    provider: 'xai',
    modality: 'text',
    description: 'Function calling, reasoning, vision.',
    tags: ['new', 'pay-per-use', 'anonymized', 'vision', 'reasoning'],
    contextWindow: 128000,
    creditCost: 3,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'grok-3',
    name: 'Grok 3',
    provider: 'xai',
    modality: 'text',
    description: 'Very capable xAI model.',
    tags: ['pay-per-use', 'anonymized', 'vision'],
    contextWindow: 128000,
    creditCost: 4,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'grok-2',
    name: 'Grok 2',
    provider: 'xai',
    modality: 'text',
    description: 'Good balance of quality and speed.',
    tags: ['pay-per-use', 'anonymized'],
    contextWindow: 128000,
    creditCost: 2,
    isPayPerUse: true,
    enabled: true,
  },
  
  // ========== DeepSeek - December 2025 ==========
  {
    id: 'deepseek-v3.2',
    name: 'DeepSeek V3.2',
    provider: 'deepseek',
    modality: 'text',
    description: 'Reasoning, very cheap.',
    tags: ['new', 'pay-per-use', 'anonymized', 'reasoning', 'fast'],
    contextWindow: 128000,
    creditCost: 1,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'deepseek-v3',
    name: 'DeepSeek V3',
    provider: 'deepseek',
    modality: 'text',
    description: 'Previous version, still capable.',
    tags: ['pay-per-use', 'anonymized', 'reasoning'],
    contextWindow: 128000,
    creditCost: 1,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'deepseek-coder-v2',
    name: 'DeepSeek Coder V2',
    provider: 'deepseek',
    modality: 'text',
    description: 'Code specialist.',
    tags: ['pay-per-use', 'anonymized'],
    contextWindow: 128000,
    creditCost: 0.5,
    isPayPerUse: true,
    enabled: true,
  },
  
  // ========== Qwen - December 2025 ==========
  {
    id: 'qwen3-235b',
    name: 'Qwen 3 235B',
    provider: 'qwen',
    modality: 'text',
    description: 'Function calling, very capable.',
    tags: ['new', 'pay-per-use', 'anonymized'],
    contextWindow: 128000,
    creditCost: 2,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'qwen3-235b-thinking',
    name: 'Qwen 3 235B Thinking',
    provider: 'qwen',
    modality: 'text',
    description: 'Reasoning variant.',
    tags: ['new', 'pay-per-use', 'anonymized', 'reasoning'],
    contextWindow: 128000,
    creditCost: 5,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'qwen3-coder-480b',
    name: 'Qwen 3 Coder 480B',
    provider: 'qwen',
    modality: 'text',
    description: 'Code specialist.',
    tags: ['new', 'pay-per-use', 'anonymized', 'premium'],
    contextWindow: 128000,
    creditCost: 4,
    isPayPerUse: true,
    enabled: true,
  },
];

// ==============================================
// IMAGE MODELS - Updated December 2025
// ==============================================

export const IMAGE_MODELS: GhostModel[] = [
  // Auto selector
  {
    id: 'auto-image',
    name: 'Auto',
    provider: 'replicate',
    modality: 'image',
    description: 'Selects the best model based on your prompt.',
    tags: ['default'],
    creditCost: 2,
    isPayPerUse: false,
    enabled: true,
  },
  
  // ========== Google Imagen ==========
  {
    id: 'imagen-3',
    name: 'Imagen 3',
    provider: 'google',
    modality: 'image',
    description: 'Best photorealism from Google.',
    tags: ['new', 'pay-per-use', 'anonymized', 'premium'],
    creditCost: 5,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'imagen-3-fast',
    name: 'Imagen 3 Fast',
    provider: 'google',
    modality: 'image',
    description: 'Faster version of Imagen 3.',
    tags: ['new', 'pay-per-use', 'anonymized', 'fast'],
    creditCost: 3,
    isPayPerUse: true,
    enabled: true,
  },
  
  // ========== Black Forest Labs (Flux) ==========
  {
    id: 'flux-1.1-pro-ultra',
    name: 'Flux 1.1 Pro Ultra',
    provider: 'replicate',
    modality: 'image',
    description: 'Up to 4K resolution. Best quality.',
    tags: ['new', 'pay-per-use', 'anonymized', 'premium'],
    creditCost: 8,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'flux-1.1-pro',
    name: 'Flux 1.1 Pro',
    provider: 'replicate',
    modality: 'image',
    description: 'Black Forest Labs flagship.',
    tags: ['pay-per-use', 'anonymized'],
    creditCost: 5,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'flux-schnell',
    name: 'Flux Schnell',
    provider: 'replicate',
    modality: 'image',
    description: 'Fast Flux variant. Great for iteration.',
    tags: ['private', 'fast'],
    creditCost: 1,
    isPayPerUse: false,
    enabled: true,
  },
  
  // ========== OpenAI ==========
  {
    id: 'dall-e-3',
    name: 'DALL·E 3',
    provider: 'openai',
    modality: 'image',
    description: 'Great prompt adherence.',
    tags: ['pay-per-use', 'anonymized'],
    creditCost: 4,
    isPayPerUse: true,
    enabled: true,
  },
  
  // ========== Stability AI ==========
  {
    id: 'sdxl',
    name: 'SDXL',
    provider: 'replicate',
    modality: 'image',
    description: 'Stable Diffusion XL. Industry standard.',
    tags: ['private'],
    creditCost: 1,
    isPayPerUse: false,
    enabled: true,
  },
  {
    id: 'sd3-medium',
    name: 'SD3 Medium',
    provider: 'replicate',
    modality: 'image',
    description: 'Stable Diffusion 3. Better text rendering.',
    tags: ['private'],
    creditCost: 2,
    isPayPerUse: false,
    enabled: true,
  },
];

// ==============================================
// VIDEO MODELS - Updated December 2025
// ==============================================

export const VIDEO_MODELS: GhostModel[] = [
  // ========== Google Veo ==========
  {
    id: 'veo-3.1',
    name: 'Veo 3.1',
    provider: 'google',
    modality: 'video',
    description: 'Latest Google video. Up to 60s, audio support.',
    tags: ['new', 'pay-per-use', 'anonymized', 'audio', 'premium'],
    creditCost: 150,
    isPayPerUse: true,
    enabled: true,
    comingSoon: true,
  },
  {
    id: 'veo-3',
    name: 'Veo 3',
    provider: 'google',
    modality: 'video',
    description: 'High quality video with audio. Up to 30s.',
    tags: ['new', 'pay-per-use', 'anonymized', 'audio'],
    creditCost: 120,
    isPayPerUse: true,
    enabled: true,
    comingSoon: true,
  },
  {
    id: 'veo-2',
    name: 'Veo 2',
    provider: 'google',
    modality: 'video',
    description: 'Previous Veo version. Up to 15s.',
    tags: ['pay-per-use', 'anonymized'],
    creditCost: 80,
    isPayPerUse: true,
    enabled: true,
    comingSoon: true,
  },
  
  // ========== Runway ==========
  {
    id: 'runway-gen3-alpha-turbo',
    name: 'Gen-3 Alpha Turbo',
    provider: 'runway',
    modality: 'video',
    description: 'Fast video generation. 5-10s.',
    tags: ['pay-per-use', 'anonymized', 'fast'],
    creditCost: 25,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'runway-gen3-alpha',
    name: 'Gen-3 Alpha',
    provider: 'runway',
    modality: 'video',
    description: 'Highest quality Runway video.',
    tags: ['pay-per-use', 'anonymized', 'premium'],
    creditCost: 50,
    isPayPerUse: true,
    enabled: true,
  },
  
  // ========== OpenAI Sora ==========
  {
    id: 'sora',
    name: 'Sora',
    provider: 'openai',
    modality: 'video',
    description: 'Text-to-video. Up to 20s.',
    tags: ['pay-per-use', 'anonymized'],
    creditCost: 100,
    isPayPerUse: true,
    enabled: true,
    comingSoon: true,
  },
  {
    id: 'sora-turbo',
    name: 'Sora Turbo',
    provider: 'openai',
    modality: 'video',
    description: 'Faster Sora. Up to 10s.',
    tags: ['pay-per-use', 'anonymized', 'fast'],
    creditCost: 50,
    isPayPerUse: true,
    enabled: true,
    comingSoon: true,
  },
  
  // ========== Luma ==========
  {
    id: 'dream-machine-1.5',
    name: 'Dream Machine 1.5',
    provider: 'luma',
    modality: 'video',
    description: 'Cinematic video generation.',
    tags: ['pay-per-use', 'anonymized'],
    creditCost: 35,
    isPayPerUse: true,
    enabled: true,
  },
  
  // ========== Pika ==========
  {
    id: 'pika-2.0',
    name: 'Pika 2.0',
    provider: 'pika',
    modality: 'video',
    description: 'Creative effects and motion.',
    tags: ['new', 'pay-per-use', 'anonymized'],
    creditCost: 30,
    isPayPerUse: true,
    enabled: true,
    comingSoon: true,
  },
];

// ==============================================
// HELPER FUNCTIONS
// ==============================================

/**
 * Get all models, optionally filtered by mature content filter
 */
export function getAllModels(matureFilterEnabled: boolean = true): GhostModel[] {
  const allModels = [...TEXT_MODELS, ...IMAGE_MODELS, ...VIDEO_MODELS];
  
  if (matureFilterEnabled) {
    return allModels.filter(m => 
      !m.tags.includes('uncensored') && !m.tags.includes('mature')
    );
  }
  
  return allModels;
}

/**
 * Get models by modality, optionally filtered by mature content filter
 */
export function getModelsByModality(
  modality: 'text' | 'image' | 'video',
  matureFilterEnabled: boolean = true
): GhostModel[] {
  let models: GhostModel[];
  
  switch (modality) {
    case 'text': models = TEXT_MODELS; break;
    case 'image': models = IMAGE_MODELS; break;
    case 'video': models = VIDEO_MODELS; break;
  }
  
  return models.filter(m => {
    if (!m.enabled) return false;
    if (matureFilterEnabled) {
      return !m.tags.includes('uncensored') && !m.tags.includes('mature');
    }
    return true;
  });
}

export function getModelById(id: string): GhostModel | undefined {
  return [...TEXT_MODELS, ...IMAGE_MODELS, ...VIDEO_MODELS].find(m => m.id === id);
}

export function getDefaultModel(
  modality: 'text' | 'image' | 'video',
  matureFilterEnabled: boolean = true
): GhostModel | undefined {
  const models = getModelsByModality(modality, matureFilterEnabled);
  return models.find(m => m.tags.includes('default')) || models[0];
}

export function getPrivateModels(matureFilterEnabled: boolean = true): GhostModel[] {
  return getAllModels(matureFilterEnabled).filter(m => m.tags.includes('private') && m.enabled);
}

export function getPayPerUseModels(matureFilterEnabled: boolean = true): GhostModel[] {
  return getAllModels(matureFilterEnabled).filter(m => m.isPayPerUse && m.enabled);
}

// Model routing configuration for edge functions
export const MODEL_ROUTES = {
  // Swiss-Hosted (Modal)
  modal: {
    models: ['qwen2.5-3b', 'qwen2.5-7b', 'llama3.1-8b', 'mistral-7b', 'qwen2.5-coder-7b'],
    endpoint: 'https://swissvault--swissvault-inference-chat-completions.modal.run',
  },
  
  // OpenAI
  openai: {
    models: ['gpt-5.2', 'gpt-5.2-mini', 'o3', 'o1', 'o1-mini', 'gpt-4o', 'gpt-4o-mini'],
    endpoint: 'https://api.openai.com/v1/chat/completions',
  },
  
  // Anthropic
  anthropic: {
    models: ['claude-opus-4.5', 'claude-sonnet-4.5', 'claude-haiku-4.5', 'claude-sonnet-4'],
    endpoint: 'https://api.anthropic.com/v1/messages',
  },
  
  // Google
  google: {
    models: ['gemini-3-pro', 'gemini-2.5-pro', 'gemini-2.0-flash', 'gemini-2.0-pro'],
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
  },
  
  // xAI
  xai: {
    models: ['grok-4.1', 'grok-3', 'grok-2'],
    endpoint: 'https://api.x.ai/v1/chat/completions',
  },
  
  // DeepSeek
  deepseek: {
    models: ['deepseek-v3.2', 'deepseek-v3', 'deepseek-coder-v2'],
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
  },
  
  // Qwen (via API)
  qwen: {
    models: ['qwen3-235b', 'qwen3-235b-thinking', 'qwen3-coder-480b'],
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
  },
};

export function getProviderForModel(modelId: string): string {
  for (const [provider, config] of Object.entries(MODEL_ROUTES)) {
    if (config.models.includes(modelId)) {
      return provider;
    }
  }
  return 'modal'; // Default to Swiss-hosted
}
