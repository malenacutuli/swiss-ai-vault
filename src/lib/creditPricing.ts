export interface CreditCost {
  base: number;
  perSecond?: number;
  perPage?: number;
  multipliers: {
    resolution?: Record<string, number>;
    detailLevel?: Record<string, number>;
  };
}

export const CREDIT_COSTS: Record<string, CreditCost> = {
  // Low cost
  summary: { base: 1, multipliers: {} },
  quiz: { base: 2, multipliers: {} },
  flashcards: { base: 2, multipliers: {} },
  faq: { base: 2, multipliers: {} },
  
  // Medium cost
  mindmap: { base: 5, multipliers: { detailLevel: { concise: 0.5, standard: 1, detailed: 2 } } },
  slides: { base: 8, perPage: 1, multipliers: {} },
  report: { base: 10, multipliers: {} },
  timeline: { base: 5, multipliers: {} },
  data_table: { base: 3, multipliers: {} },
  
  // High cost
  infographic: { 
    base: 15, 
    multipliers: { 
      resolution: { standard: 1, high: 1.5, ultra: 2 },
      detailLevel: { concise: 0.7, standard: 1, detailed: 1.5 }
    } 
  },
  
  audio_summary: { 
    base: 10, 
    perSecond: 0.5, 
    multipliers: { detailLevel: { brief: 0.5, standard: 1, deep: 2 } } 
  },
  
  // Very high cost
  video_summary: { 
    base: 20, 
    perSecond: 1, 
    multipliers: { 
      resolution: { '720p': 1, '1080p': 2.5, '4K': 4 }
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
  report: '10',
  timeline: '5',
  data_table: '3',
};
