export interface GhostModel {
  id: string;
  name: string;
  provider: 'modal' | 'openai' | 'anthropic' | 'google' | 'replicate' | 'runway' | 'sora';
  modality: 'text' | 'image' | 'video';
  
  // Display
  icon?: string;  // Lucide icon name or custom SVG
  description: string;
  
  // Capabilities
  tags: Array<'private' | 'default' | 'new' | 'pay-per-use' | 'anonymized' | 'beta' | 'vision' | 'reasoning' | 'audio' | 'uncensored' | 'mature'>;
  contextWindow?: number;
  
  // Pricing
  creditCost: number;  // Per 1K tokens (text) or per generation (image/video)
  isPayPerUse: boolean;
  
  // Availability
  enabled: boolean;
  comingSoon?: boolean;
}

// ==============================================
// TEXT MODELS
// ==============================================

export const TEXT_MODELS: GhostModel[] = [
  // Swiss-Hosted (Modal vLLM) - Private
  {
    id: 'qwen2.5-3b',
    name: 'Qwen 2.5 3B',
    provider: 'modal',
    modality: 'text',
    description: 'Fast general-purpose model. Swiss-hosted, zero logging.',
    tags: ['private', 'default'],
    contextWindow: 4096,
    creditCost: 0.5,
    isPayPerUse: false,
    enabled: true,
  },
  {
    id: 'qwen2.5-7b',
    name: 'Qwen 2.5 7B',
    provider: 'modal',
    modality: 'text',
    description: 'Balanced performance. Swiss-hosted.',
    tags: ['private'],
    contextWindow: 8192,
    creditCost: 1,
    isPayPerUse: false,
    enabled: true,
  },
  {
    id: 'llama3.1-8b',
    name: 'Llama 3.1 8B',
    provider: 'modal',
    modality: 'text',
    description: 'Meta\'s latest. Excellent reasoning. Swiss-hosted.',
    tags: ['private'],
    contextWindow: 8192,
    creditCost: 1.5,
    isPayPerUse: false,
    enabled: true,
  },
  {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    provider: 'modal',
    modality: 'text',
    description: 'European model. Great all-rounder. Swiss-hosted.',
    tags: ['private'],
    contextWindow: 8192,
    creditCost: 1,
    isPayPerUse: false,
    enabled: true,
  },
  {
    id: 'qwen2.5-coder-7b',
    name: 'Qwen Coder 7B',
    provider: 'modal',
    modality: 'text',
    description: 'Optimized for code generation. Swiss-hosted.',
    tags: ['private'],
    contextWindow: 8192,
    creditCost: 1.5,
    isPayPerUse: false,
    enabled: true,
  },
  
  // Commercial APIs (Pay Per Use, Anonymized)
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'openai',
    modality: 'text',
    description: 'OpenAI\'s multimodal flagship.',
    tags: ['pay-per-use', 'anonymized', 'vision', 'reasoning'],
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
    tags: ['pay-per-use', 'anonymized', 'vision'],
    contextWindow: 128000,
    creditCost: 1,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'claude-opus-4',
    name: 'Claude Opus 4',
    provider: 'anthropic',
    modality: 'text',
    description: 'Anthropic\'s most capable model.',
    tags: ['beta', 'pay-per-use', 'anonymized', 'vision', 'reasoning'],
    contextWindow: 200000,
    creditCost: 8,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'anthropic',
    modality: 'text',
    description: 'Balanced intelligence and speed.',
    tags: ['pay-per-use', 'anonymized', 'vision'],
    contextWindow: 200000,
    creditCost: 3,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'gemini-2.0-pro',
    name: 'Gemini 2.0 Pro',
    provider: 'google',
    modality: 'text',
    description: 'Google\'s latest multimodal.',
    tags: ['beta', 'pay-per-use', 'anonymized', 'vision', 'reasoning'],
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
    tags: ['new', 'pay-per-use', 'anonymized', 'vision'],
    contextWindow: 1000000,
    creditCost: 1,
    isPayPerUse: true,
    enabled: true,
  },
];

// ==============================================
// IMAGE MODELS
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
  
  // Replicate Models
  {
    id: 'flux-1.1-pro',
    name: 'Flux 1.1 Pro',
    provider: 'replicate',
    modality: 'image',
    description: 'Black Forest Labs\' flagship. Best quality.',
    tags: ['new', 'pay-per-use', 'anonymized'],
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
    tags: ['private'],
    creditCost: 1,
    isPayPerUse: false,
    enabled: true,
  },
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
  
  // OpenAI
  {
    id: 'dall-e-3',
    name: 'DALL·E 3',
    provider: 'openai',
    modality: 'image',
    description: 'OpenAI\'s image model. Great prompt adherence.',
    tags: ['pay-per-use', 'anonymized'],
    creditCost: 4,
    isPayPerUse: true,
    enabled: true,
  },
  
  // Google
  {
    id: 'imagen-3',
    name: 'Imagen 3',
    provider: 'google',
    modality: 'image',
    description: 'Google\'s state-of-the-art image model.',
    tags: ['new', 'pay-per-use', 'anonymized'],
    creditCost: 5,
    isPayPerUse: true,
    enabled: true,
  },
];

// ==============================================
// VIDEO MODELS
// ==============================================

export const VIDEO_MODELS: GhostModel[] = [
  // Image to Video
  {
    id: 'runway-gen3-turbo',
    name: 'Gen-3 Alpha Turbo',
    provider: 'runway',
    modality: 'video',
    description: 'Runway\'s fast video generation.',
    tags: ['pay-per-use', 'anonymized'],
    creditCost: 20,
    isPayPerUse: true,
    enabled: true,
  },
  {
    id: 'runway-gen3',
    name: 'Gen-3 Alpha',
    provider: 'runway',
    modality: 'video',
    description: 'Runway\'s highest quality video.',
    tags: ['pay-per-use', 'anonymized'],
    creditCost: 40,
    isPayPerUse: true,
    enabled: true,
  },
  
  // Google Veo
  {
    id: 'veo-2',
    name: 'Veo 2',
    provider: 'google',
    modality: 'video',
    description: 'Google\'s video generation model.',
    tags: ['new', 'pay-per-use', 'anonymized', 'audio'],
    creditCost: 50,
    isPayPerUse: true,
    enabled: true,
  },
  
  // Sora
  {
    id: 'sora',
    name: 'Sora',
    provider: 'sora',
    modality: 'video',
    description: 'OpenAI\'s video generation.',
    tags: ['beta', 'pay-per-use', 'anonymized'],
    creditCost: 100,
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
