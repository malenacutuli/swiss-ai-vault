/**
 * Knowledge System Integration Tests
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  knowledgeAggregator,
  initializeKnowledge,
  checkKnowledgeHealth
} from '../../src/knowledge/index.js';

describe('Knowledge System Integration', () => {
  beforeAll(() => {
    initializeKnowledge();
  });

  it('should have healthy knowledge sources', async () => {
    const health = await checkKnowledgeHealth();
    expect(health.sources.length).toBeGreaterThan(0);
    // At least one source should be available
    expect(health.sources.some(s => s.available)).toBe(true);
  }, 10000);

  it('should query RxNorm for medications', async () => {
    const result = await knowledgeAggregator.queryWithConsensus({
      type: 'medication',
      terms: ['metoprolol'],
      language: 'en',
    }, { minSources: 1 });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].preferredTerm.toLowerCase()).toContain('metoprolol');
  }, 15000);

  it('should query ICD-10 for diagnoses', async () => {
    const result = await knowledgeAggregator.queryWithConsensus({
      type: 'diagnosis',
      terms: ['hypertension'],
      language: 'en',
    }, { minSources: 1 });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].codes['ICD-10-CM']).toBeDefined();
  }, 15000);

  it('should verify medication claims', async () => {
    const result = await knowledgeAggregator.verifyClaim(
      'aspirin',
      'medication',
      'en'
    );

    // verifyClaim returns a result with confidence score
    expect(result).toBeDefined();
    expect(typeof result.verified).toBe('boolean');
    expect(typeof result.confidence).toBe('number');
    expect(result.confidence).toBeGreaterThanOrEqual(0);
  }, 15000);

  it('should lookup ICD-10 code directly', async () => {
    const concept = await knowledgeAggregator.lookupCode('ICD-10-CM', 'I10');

    expect(concept).not.toBeNull();
    expect(concept?.preferredTerm.toLowerCase()).toContain('hypertension');
  }, 10000);
});
