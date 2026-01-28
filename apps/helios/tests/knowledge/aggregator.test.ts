import { describe, it, expect, beforeAll } from 'vitest';
import { knowledgeAggregator, initializeKnowledge } from '../../src/knowledge/index.js';

describe('Knowledge Aggregator', () => {
  beforeAll(() => {
    initializeKnowledge();
  });

  it('should have registered sources', () => {
    const sources = knowledgeAggregator.listSources();
    expect(sources.length).toBeGreaterThanOrEqual(2);
    expect(sources.some(s => s.id === 'rxnorm')).toBe(true);
    expect(sources.some(s => s.id === 'icd10')).toBe(true);
  });

  it('should query medications with consensus', async () => {
    const result = await knowledgeAggregator.queryWithConsensus({
      type: 'medication',
      terms: ['aspirin'],
      language: 'en',
    }, {
      minSources: 1, // Only RxNorm covers medications
    });

    expect(result.results.length).toBeGreaterThan(0);
  });

  it('should query diagnoses with consensus', async () => {
    const result = await knowledgeAggregator.queryWithConsensus({
      type: 'diagnosis',
      terms: ['diabetes'],
      language: 'en',
    }, {
      minSources: 1, // Only ICD-10 covers diagnoses
    });

    expect(result.results.length).toBeGreaterThan(0);
    expect(result.results[0].codes['ICD-10-CM']).toBeDefined();
  });

  it('should verify medication claims', async () => {
    const result = await knowledgeAggregator.verifyClaim(
      'metoprolol is a beta blocker',
      'medication',
      'en'
    );

    // With only 1 medication source (RxNorm), consensus can't be achieved
    // (default minSources: 2), but details should still contain search results
    expect(result.details.length).toBeGreaterThan(0);
    expect(result.details.some(d => d.concept === 'metoprolol')).toBe(true);
    // The warning should indicate partial verification
    expect(result.warning).toBeDefined();
  });

  it('should lookup codes directly', async () => {
    // E11.9 is a specific billable code (Type 2 diabetes without complications)
    // Parent codes like E11 are category codes not directly returned by the API
    const concept = await knowledgeAggregator.lookupCode('ICD-10-CM', 'E11.9');
    expect(concept).not.toBeNull();
    expect(concept?.preferredTerm.toLowerCase()).toContain('diabetes');
  });
});
