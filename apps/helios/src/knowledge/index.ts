/**
 * HELIOS Knowledge Module
 * Exports knowledge sources and aggregator
 */

// Types
export * from './types.js';

// Aggregator
export { KnowledgeAggregator, knowledgeAggregator } from './aggregator/index.js';

// Sources
export { RxNormSource, rxnormSource } from './sources/terminology/rxnorm.js';
export { ICD10Source, icd10Source } from './sources/terminology/icd10.js';

// Initialize default sources
import { knowledgeAggregator } from './aggregator/index.js';
import { rxnormSource } from './sources/terminology/rxnorm.js';
import { icd10Source } from './sources/terminology/icd10.js';

/**
 * Initialize knowledge system with default sources
 */
export function initializeKnowledge(): void {
  // Register FREE API sources (no keys required)
  knowledgeAggregator.registerSource(rxnormSource);
  knowledgeAggregator.registerSource(icd10Source);

  console.log('🧠 HELIOS Knowledge System initialized');
  console.log(`   Sources: ${knowledgeAggregator.listSources().map(s => s.name).join(', ')}`);
}

/**
 * Check all knowledge sources availability
 */
export async function checkKnowledgeHealth(): Promise<{
  healthy: boolean;
  sources: Array<{ id: string; name: string; available: boolean }>;
}> {
  const sources = knowledgeAggregator.listSources();

  const results = await Promise.all(
    sources.map(async s => ({
      id: s.id,
      name: s.name,
      available: await s.isAvailable(),
    }))
  );

  return {
    healthy: results.every(r => r.available),
    sources: results,
  };
}
