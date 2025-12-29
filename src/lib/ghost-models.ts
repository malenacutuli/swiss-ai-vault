// src/lib/ghost-models.ts
// Ghost Chat - Complete Model Catalog (December 2025)

export interface GhostModel {
  id: string;
  name: string;
  provider: string;
  modality: 'text' | 'image' | 'video';
  description: string;
  tags: string[];
  contextWindow?: number;
  maxOutput?: number;
  creditCost: number;
  isPayPerUse: boolean;
  requiresPro?: boolean;
  creditMultiplier?: number;
  enabled: boolean;
  comingSoon?: boolean;
}

// Helper to check if a model supports vision
export function isVisionModel(modelId: string): boolean {
  const allModels = [...TEXT_MODELS, ...IMAGE_MODELS, ...VIDEO_MODELS];
  const model = allModels.find(m => m.id === modelId);
  return model?.tags.includes('vision') ?? false;
}

// ==============================================
// TEXT MODELS - December 2025
// ==============================================

export const TEXT_MODELS: GhostModel[] = [
  // ============================================
  // SWISSVAULT BRANDED (Privacy-first, Swiss jurisdiction)
  // Backend: OpenAI (hidden for reliability until Swiss GPU proven)
  // ============================================
  {
    id: 'swissvault-1.0',
    name: 'SwissVault 1.0',
    provider: 'SwissVault',
    modality: 'text',
    description: 'Swiss-hosted private AI • Fast & reliable • Vision',
    tags: ['private', 'default', 'swiss', 'vision'],
    contextWindow: 128000,
    maxOutput: 4096,
    creditCost: 1,
    creditMultiplier: 1,
    isPayPerUse: false,
    enabled: true,
  },
  {
    id: 'swissvault-pro',
    name: 'SwissVault Pro',
    provider: 'SwissVault',
    modality: 'text',
    description: 'Advanced reasoning • Complex analysis',
    tags: ['private', 'swiss', 'vision', 'reasoning'],
    contextWindow: 128000,
    maxOutput: 4096,
    creditCost: 2,
    creditMultiplier: 2,
    isPayPerUse: false,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'swissvault-code',
    name: 'SwissVault Code',
    provider: 'SwissVault',
    modality: 'text',
    description: 'Optimized for code generation & review',
    tags: ['private', 'swiss', 'code'],
    contextWindow: 128000,
    maxOutput: 4096,
    creditCost: 1,
    creditMultiplier: 1,
    isPayPerUse: false,
    enabled: true,
  },
  {
    id: 'swissvault-fast',
    name: 'SwissVault Fast',
    provider: 'SwissVault',
    modality: 'text',
    description: 'Ultra-fast responses • Quick tasks',
    tags: ['private', 'swiss', 'fast'],
    contextWindow: 32000,
    maxOutput: 2048,
    creditCost: 0.5,
    creditMultiplier: 0.5,
    isPayPerUse: false,
    enabled: true,
  },

  // ============================================
  // OPEN SOURCE via Modal (axessible-labs workspace)
  // True Swiss-hosted, zero data retention
  // ============================================
  
  // --- Currently Deployed ---
  {
    id: 'qwen2.5-3b',
    name: 'Qwen 2.5 3B',
    provider: 'Open Source',
    modality: 'text',
    description: 'Fast & efficient • Great for quick tasks • Swiss-hosted',
    tags: ['swiss', 'fast', 'open-source', 'efficient'],
    contextWindow: 32768,
    maxOutput: 4096,
    creditCost: 0.5,
    creditMultiplier: 0.5,
    isPayPerUse: false,
    enabled: false, // Temporarily disabled for beta
  },
  {
    id: 'qwen2.5-coder-7b',
    name: 'Qwen 2.5 Coder 7B',
    provider: 'Open Source',
    modality: 'text',
    description: 'Specialized code generation • Swiss-hosted',
    tags: ['swiss', 'code', 'open-source'],
    contextWindow: 32768,
    maxOutput: 4096,
    creditCost: 1,
    creditMultiplier: 1,
    isPayPerUse: false,
    enabled: false, // Temporarily disabled for beta
  },
  {
    id: 'llama3.1-8b',
    name: 'Llama 3.1 8B',
    provider: 'Open Source',
    modality: 'text',
    description: 'Meta\'s efficient model • Great all-rounder • Swiss-hosted',
    tags: ['swiss', 'general', 'open-source'],
    contextWindow: 8192,
    maxOutput: 2048,
    creditCost: 1,
    creditMultiplier: 1,
    isPayPerUse: false,
    enabled: false, // Temporarily disabled for beta
  },
  {
    id: 'mistral-7b',
    name: 'Mistral 7B',
    provider: 'Open Source',
    modality: 'text',
    description: 'European AI • Multilingual • Swiss-hosted',
    tags: ['swiss', 'multilingual', 'open-source'],
    contextWindow: 8192,
    maxOutput: 2048,
    creditCost: 1,
    creditMultiplier: 1,
    isPayPerUse: false,
    enabled: true,
  },
  
  // --- Premium Open Source (Deploy when ready) ---
  {
    id: 'qwen2.5-72b',
    name: 'Qwen 2.5 72B',
    provider: 'Open Source',
    modality: 'text',
    description: 'Best open-source • Rivals GPT-4 • Swiss-hosted',
    tags: ['swiss', 'flagship', 'open-source', 'premium'],
    contextWindow: 131072,
    maxOutput: 8192,
    creditCost: 3,
    creditMultiplier: 3,
    isPayPerUse: false,
    requiresPro: true,
    enabled: false,
    comingSoon: true,
  },
  {
    id: 'llama3.3-70b',
    name: 'Llama 3.3 70B',
    provider: 'Open Source',
    modality: 'text',
    description: 'Meta\'s flagship • Top-tier reasoning • Swiss-hosted',
    tags: ['swiss', 'flagship', 'open-source', 'premium'],
    contextWindow: 131072,
    maxOutput: 4096,
    creditCost: 3,
    creditMultiplier: 3,
    isPayPerUse: false,
    requiresPro: true,
    enabled: false,
    comingSoon: true,
  },
  {
    id: 'deepseek-v3-oss',
    name: 'DeepSeek V3 (Open)',
    provider: 'Open Source',
    modality: 'text',
    description: 'MoE 671B params • State-of-art • Swiss-hosted',
    tags: ['swiss', 'flagship', 'reasoning', 'open-source', 'premium'],
    contextWindow: 65536,
    maxOutput: 8192,
    creditCost: 4,
    creditMultiplier: 4,
    isPayPerUse: false,
    requiresPro: true,
    enabled: false,
    comingSoon: true,
  },
  {
    id: 'mixtral-8x22b',
    name: 'Mixtral 8x22B',
    provider: 'Open Source',
    modality: 'text',
    description: 'Mistral MoE • Fast inference • Swiss-hosted',
    tags: ['swiss', 'fast', 'open-source', 'premium'],
    contextWindow: 65536,
    maxOutput: 4096,
    creditCost: 2,
    creditMultiplier: 2,
    isPayPerUse: false,
    requiresPro: true,
    enabled: false,
    comingSoon: true,
  },

  // ============================================
  // OPENAI (Commercial)
  // ============================================
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    provider: 'OpenAI',
    modality: 'text',
    description: 'OpenAI flagship • Multimodal • Vision',
    tags: ['commercial', 'vision', 'flagship'],
    contextWindow: 128000,
    maxOutput: 4096,
    creditCost: 5,
    creditMultiplier: 2,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    provider: 'OpenAI',
    modality: 'text',
    description: 'Fast & affordable • Vision enabled',
    tags: ['commercial', 'vision', 'fast'],
    contextWindow: 128000,
    maxOutput: 4096,
    creditCost: 1,
    creditMultiplier: 1,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'o1',
    name: 'o1',
    provider: 'OpenAI',
    modality: 'text',
    description: 'Deep reasoning • PhD-level problems',
    tags: ['commercial', 'reasoning', 'flagship'],
    contextWindow: 200000,
    maxOutput: 100000,
    creditCost: 12,
    creditMultiplier: 10,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'o1-mini',
    name: 'o1 Mini',
    provider: 'OpenAI',
    modality: 'text',
    description: 'Efficient reasoning • STEM focus',
    tags: ['commercial', 'reasoning'],
    contextWindow: 128000,
    maxOutput: 65536,
    creditCost: 4,
    creditMultiplier: 3,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'o3-mini',
    name: 'o3 Mini',
    provider: 'OpenAI',
    modality: 'text',
    description: 'Latest reasoning • Advanced math',
    tags: ['commercial', 'reasoning', 'new'],
    contextWindow: 200000,
    maxOutput: 100000,
    creditCost: 8,
    creditMultiplier: 5,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'o3',
    name: 'o3',
    provider: 'OpenAI',
    modality: 'text',
    description: 'Full o3 reasoning • PhD-level problems',
    tags: ['commercial', 'reasoning', 'flagship', 'new'],
    contextWindow: 200000,
    maxOutput: 100000,
    creditCost: 15,
    creditMultiplier: 10,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'o4-mini',
    name: 'o4 Mini',
    provider: 'OpenAI',
    modality: 'text',
    description: 'Next-gen reasoning • Efficient',
    tags: ['commercial', 'reasoning', 'new'],
    contextWindow: 200000,
    maxOutput: 100000,
    creditCost: 10,
    creditMultiplier: 6,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'gpt-5.2',
    name: 'GPT-5.2',
    provider: 'OpenAI',
    modality: 'text',
    description: 'Latest GPT flagship • Vision • 256K context',
    tags: ['commercial', 'vision', 'flagship', 'new'],
    contextWindow: 256000,
    maxOutput: 16384,
    creditCost: 8,
    creditMultiplier: 4,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'gpt-5.2-mini',
    name: 'GPT-5.2 Mini',
    provider: 'OpenAI',
    modality: 'text',
    description: 'Fast GPT-5.2 • Vision • Great value',
    tags: ['commercial', 'vision', 'fast', 'new'],
    contextWindow: 256000,
    maxOutput: 16384,
    creditCost: 3,
    creditMultiplier: 2,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },

  // ============================================
  // ANTHROPIC (Commercial)
  // ============================================
  {
    id: 'claude-3.5-sonnet',
    name: 'Claude 3.5 Sonnet',
    provider: 'Anthropic',
    modality: 'text',
    description: 'Best for analysis & writing • Vision',
    tags: ['commercial', 'vision', 'writing'],
    contextWindow: 200000,
    maxOutput: 8192,
    creditCost: 3,
    creditMultiplier: 2,
    isPayPerUse: true,
    requiresPro: true,
    enabled: false, // Temporarily disabled for beta
  },
  {
    id: 'claude-3.5-haiku',
    name: 'Claude 3.5 Haiku',
    provider: 'Anthropic',
    modality: 'text',
    description: 'Fast & efficient • Great value',
    tags: ['commercial', 'fast'],
    contextWindow: 200000,
    maxOutput: 4096,
    creditCost: 1,
    creditMultiplier: 1,
    isPayPerUse: true,
    requiresPro: true,
    enabled: false, // Temporarily disabled for beta
  },
  {
    id: 'claude-opus-4.5',
    name: 'Claude Opus 4.5',
    provider: 'Anthropic',
    modality: 'text',
    description: 'Most capable Claude • Deep analysis',
    tags: ['commercial', 'flagship', 'reasoning'],
    contextWindow: 200000,
    maxOutput: 8192,
    creditCost: 15,
    creditMultiplier: 5,
    isPayPerUse: true,
    requiresPro: true,
    enabled: false, // Temporarily disabled for beta
  },
  {
    id: 'claude-sonnet-4',
    name: 'Claude Sonnet 4',
    provider: 'Anthropic',
    modality: 'text',
    description: 'Balanced performance • Reliable',
    tags: ['commercial', 'vision'],
    contextWindow: 200000,
    maxOutput: 8192,
    creditCost: 5,
    creditMultiplier: 2,
    isPayPerUse: true,
    requiresPro: true,
    enabled: false, // Temporarily disabled for beta
  },

  // ============================================
  // GOOGLE (Commercial)
  // ============================================
  {
    id: 'gemini-3-pro',
    name: 'Gemini 3 Pro',
    provider: 'Google',
    modality: 'text',
    description: 'Next-gen flagship • Outperforms GPT-5 on benchmarks',
    tags: ['commercial', 'vision', 'reasoning', 'frontier', 'new'],
    contextWindow: 2097152,
    maxOutput: 65536,
    creditCost: 8,
    creditMultiplier: 5,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    provider: 'Google',
    modality: 'text',
    description: 'Frontier intelligence at lightning speed',
    tags: ['commercial', 'vision', 'fast', 'frontier', 'new'],
    contextWindow: 1048576,
    maxOutput: 65536,
    creditCost: 4,
    creditMultiplier: 2,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    provider: 'Google',
    modality: 'text',
    description: 'Most intelligent Gemini • Enhanced reasoning',
    tags: ['commercial', 'vision', 'reasoning', 'multimodal', 'new'],
    contextWindow: 1048576,
    maxOutput: 65536,
    creditCost: 5,
    creditMultiplier: 3,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    provider: 'Google',
    modality: 'text',
    description: 'Fast & efficient with thinking capabilities',
    tags: ['commercial', 'vision', 'fast', 'thinking', 'new'],
    contextWindow: 1048576,
    maxOutput: 65536,
    creditCost: 2,
    creditMultiplier: 1,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    provider: 'Google',
    modality: 'text',
    description: 'Lowest latency & cost in 2.5 family',
    tags: ['commercial', 'fast', 'cheap', 'high-throughput'],
    contextWindow: 1048576,
    maxOutput: 65536,
    creditCost: 1,
    creditMultiplier: 0.5,
    isPayPerUse: true,
    requiresPro: false,
    enabled: true,
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    provider: 'Google',
    modality: 'text',
    description: 'Fastest multimodal • 1M context',
    tags: ['commercial', 'vision', 'fast'],
    contextWindow: 1000000,
    maxOutput: 8192,
    creditCost: 1,
    creditMultiplier: 1,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'gemini-2.0-pro',
    name: 'Gemini 2.0 Pro',
    provider: 'Google',
    modality: 'text',
    description: 'Google\'s previous flagship • Deep reasoning',
    tags: ['commercial', 'vision', 'flagship'],
    contextWindow: 1000000,
    maxOutput: 8192,
    creditCost: 5,
    creditMultiplier: 3,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'gemini-1.5-pro',
    name: 'Gemini 1.5 Pro',
    provider: 'Google',
    modality: 'text',
    description: '2M context • Document analysis',
    tags: ['commercial', 'vision', 'documents'],
    contextWindow: 2000000,
    maxOutput: 8192,
    creditCost: 4,
    creditMultiplier: 2,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },

  // ============================================
  // xAI GROK (Commercial)
  // ============================================
  {
    id: 'grok-2',
    name: 'Grok 2',
    provider: 'xAI',
    modality: 'text',
    description: 'Real-time knowledge • Uncensored',
    tags: ['commercial', 'realtime'],
    contextWindow: 131072,
    maxOutput: 4096,
    creditCost: 2,
    creditMultiplier: 2,
    isPayPerUse: true,
    requiresPro: true,
    enabled: false, // Temporarily disabled for beta
  },
  {
    id: 'grok-2-vision',
    name: 'Grok 2 Vision',
    provider: 'xAI',
    modality: 'text',
    description: 'Multimodal Grok • Image understanding',
    tags: ['commercial', 'vision'],
    contextWindow: 131072,
    maxOutput: 4096,
    creditCost: 2,
    creditMultiplier: 2,
    isPayPerUse: true,
    requiresPro: true,
    enabled: false, // Temporarily disabled for beta
  },
  {
    id: 'grok-3',
    name: 'Grok 3',
    provider: 'xAI',
    modality: 'text',
    description: 'Latest Grok • Advanced reasoning',
    tags: ['commercial', 'reasoning', 'new'],
    contextWindow: 131072,
    maxOutput: 4096,
    creditCost: 4,
    creditMultiplier: 3,
    isPayPerUse: true,
    requiresPro: true,
    enabled: false, // Temporarily disabled for beta
  },

  // ============================================
  // DEEPSEEK (Commercial API - Affordable)
  // ============================================
  {
    id: 'deepseek-chat',
    name: 'DeepSeek Chat',
    provider: 'DeepSeek',
    modality: 'text',
    description: 'Affordable & capable • Great value',
    tags: ['commercial', 'value'],
    contextWindow: 65536,
    maxOutput: 4096,
    creditCost: 0.5,
    creditMultiplier: 0.5,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'deepseek-coder',
    name: 'DeepSeek Coder',
    provider: 'DeepSeek',
    modality: 'text',
    description: 'Code specialist • Competitive pricing',
    tags: ['commercial', 'code'],
    contextWindow: 65536,
    maxOutput: 4096,
    creditCost: 0.5,
    creditMultiplier: 0.5,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
  {
    id: 'deepseek-reasoner',
    name: 'DeepSeek Reasoner',
    provider: 'DeepSeek',
    modality: 'text',
    description: 'R1-style reasoning • Math & logic',
    tags: ['commercial', 'reasoning'],
    contextWindow: 65536,
    maxOutput: 8192,
    creditCost: 1,
    creditMultiplier: 1,
    isPayPerUse: true,
    requiresPro: true,
    enabled: true,
  },
];

// ==============================================
// IMAGE MODELS - December 2025
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
    tags: ['new', 'pay-per-use', 'premium'],
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
    tags: ['new', 'pay-per-use', 'fast'],
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
    tags: ['new', 'pay-per-use', 'premium'],
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
    tags: ['pay-per-use'],
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
    tags: ['pay-per-use'],
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
// VIDEO MODELS - December 2025
// ==============================================

export const VIDEO_MODELS: GhostModel[] = [
  // ========== Google Veo ==========
  {
    id: 'veo-3.1',
    name: 'Veo 3.1',
    provider: 'google',
    modality: 'video',
    description: 'Latest Google video. Up to 60s, audio support.',
    tags: ['new', 'pay-per-use', 'audio', 'premium'],
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
    tags: ['new', 'pay-per-use', 'audio'],
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
    tags: ['pay-per-use'],
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
    tags: ['pay-per-use', 'fast'],
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
    tags: ['pay-per-use', 'premium'],
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
    tags: ['pay-per-use'],
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
    tags: ['pay-per-use', 'fast'],
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
    tags: ['pay-per-use'],
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
    tags: ['new', 'pay-per-use'],
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

export function getSwissModels(): GhostModel[] {
  return TEXT_MODELS.filter(m => m.tags.includes('swiss') && m.enabled);
}

export function getCommercialModels(): GhostModel[] {
  return TEXT_MODELS.filter(m => m.tags.includes('commercial') && m.enabled);
}

export function getOpenSourceModels(): GhostModel[] {
  return TEXT_MODELS.filter(m => m.tags.includes('open-source') && m.enabled);
}

export function getFreeModels(): GhostModel[] {
  return TEXT_MODELS.filter(m => !m.requiresPro && m.enabled);
}

export function requiresPro(id: string): boolean {
  const model = getModelById(id);
  return model?.requiresPro ?? false;
}

export function getCreditMultiplier(id: string): number {
  const model = getModelById(id);
  return model?.creditMultiplier ?? 1;
}

// Model categories for UI grouping
export const MODEL_CATEGORIES = {
  'SwissVault': TEXT_MODELS.filter(m => m.provider === 'SwissVault'),
  'Open Source': TEXT_MODELS.filter(m => m.provider === 'Open Source'),
  'OpenAI': TEXT_MODELS.filter(m => m.provider === 'OpenAI'),
  'Anthropic': TEXT_MODELS.filter(m => m.provider === 'Anthropic'),
  'Google': TEXT_MODELS.filter(m => m.provider === 'Google'),
  'xAI': TEXT_MODELS.filter(m => m.provider === 'xAI'),
  'DeepSeek': TEXT_MODELS.filter(m => m.provider === 'DeepSeek'),
};

// Model routing configuration for edge functions
export const MODEL_ROUTES = {
  // Swiss-Hosted (Modal - axessible-labs workspace)
  modal: {
    models: ['swissvault-fast', 'swissvault-code', 'qwen2.5-3b', 'qwen2.5-coder-7b', 'llama3.1-8b', 'mistral-7b'],
    endpoint: 'https://axessible-labs--swissvault-main-main-chat.modal.run',
  },
  
  // SwissVault branded -> OpenAI (hidden)
  swissvault: {
    models: ['swissvault-1.0', 'swissvault-pro'],
    endpoint: 'https://api.openai.com/v1/chat/completions',
  },
  
  // OpenAI
  openai: {
    models: ['gpt-4o', 'gpt-4o-mini', 'o1', 'o1-mini', 'o3-mini', 'o3', 'o4-mini', 'gpt-5.2', 'gpt-5.2-mini'],
    endpoint: 'https://api.openai.com/v1/chat/completions',
  },
  
  // Anthropic
  anthropic: {
    models: ['claude-opus-4.5', 'claude-sonnet-4', 'claude-3.5-sonnet', 'claude-3.5-haiku'],
    endpoint: 'https://api.anthropic.com/v1/messages',
  },
  
  // Google
  google: {
    models: ['gemini-2.0-flash', 'gemini-2.0-pro', 'gemini-1.5-pro'],
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
  },
  
  // xAI
  xai: {
    models: ['grok-2', 'grok-2-vision', 'grok-3'],
    endpoint: 'https://api.x.ai/v1/chat/completions',
  },
  
  // DeepSeek (commercial API)
  deepseek: {
    models: ['deepseek-chat', 'deepseek-coder', 'deepseek-reasoner'],
    endpoint: 'https://api.deepseek.com/chat/completions',
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
