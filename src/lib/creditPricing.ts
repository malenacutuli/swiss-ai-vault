export interface CreditCost {
  base: number;
  perSecond?: number;
  perPage?: number;
  multipliers: {
    resolution?: Record<string, number>;
    detailLevel?: Record<string, number>;
    style?: Record<string, number>;
  };
}

export const CREDIT_COSTS: Record<string, CreditCost> = {
  // Text-based (low cost)
  summary: { base: 1, multipliers: {} },
  quiz: { base: 2, multipliers: { detailLevel: { concise: 0.5, standard: 1, detailed: 1.5 } } },
  flashcards: { base: 2, multipliers: {} },
  faq: { base: 2, multipliers: {} },
  
  // Structured (medium cost)
  mindmap: { base: 5, multipliers: { detailLevel: { concise: 0.5, standard: 1, detailed: 2 } } },
  slides: { base: 8, perPage: 1, multipliers: {} },
  report: { base: 10, multipliers: { detailLevel: { concise: 0.5, standard: 1, detailed: 2 } } },
  timeline: { base: 5, multipliers: {} },
  data_table: { base: 3, multipliers: {} },
  
  // Visual (high cost)
  infographic: { 
    base: 15, 
    multipliers: { 
      resolution: { standard: 1, high: 1.5, ultra: 2 },
      detailLevel: { concise: 0.7, standard: 1, detailed: 1.5 }
    } 
  },
  
  // Audio (high cost)
  audio_summary: { 
    base: 10, 
    perSecond: 0.5, 
    multipliers: { 
      detailLevel: { brief: 0.5, standard: 1, deep: 2 } 
    } 
  },
  
  // Video (very high cost)
  video_summary: { 
    base: 20, 
    perSecond: 1, 
    multipliers: { 
      resolution: { '720p': 1, '1080p': 2.5, '4K': 4 },
      style: { simple: 0.8, standard: 1, cinematic: 1.5 }
    } 
  }
};

export function calculateCreditCost(
  artifactType: string,
  options: {
    duration?: number;
    pageCount?: number;
    resolution?: string;
    detailLevel?: string;
    style?: string;
  }
): number {
  const pricing = CREDIT_COSTS[artifactType];
  if (!pricing) return 10;
  
  let cost = pricing.base;
  
  if (pricing.perSecond && options.duration) {
    cost += pricing.perSecond * options.duration;
  }
  
  if (pricing.perPage && options.pageCount) {
    cost += pricing.perPage * options.pageCount;
  }
  
  if (pricing.multipliers.resolution && options.resolution) {
    cost *= pricing.multipliers.resolution[options.resolution] || 1;
  }
  
  if (pricing.multipliers.detailLevel && options.detailLevel) {
    cost *= pricing.multipliers.detailLevel[options.detailLevel] || 1;
  }
  
  if (pricing.multipliers.style && options.style) {
    cost *= pricing.multipliers.style[options.style] || 1;
  }
  
  return Math.ceil(cost);
}

export const ARTIFACT_CREDIT_RANGES: Record<string, string> = {
  audio_summary: '10-50',
  video_summary: '80-300',
  infographic: '15-30',
  mindmap: '5-10',
  slides: '8-20',
  quiz: '2',
  flashcards: '2',
  summary: '1',
  faq: '2',
  report: '10-20',
  timeline: '5',
  data_table: '3',
};
