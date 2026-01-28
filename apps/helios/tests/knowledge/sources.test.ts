import { describe, it, expect, beforeAll } from 'vitest';
import { rxnormSource } from '../../src/knowledge/sources/terminology/rxnorm.js';
import { icd10Source } from '../../src/knowledge/sources/terminology/icd10.js';

describe('RxNorm Source', () => {
  beforeAll(async () => {
    // Check if API is available
    const available = await rxnormSource.isAvailable();
    if (!available) {
      console.warn('RxNorm API not available - skipping tests');
    }
  });

  it('should search for medications', async () => {
    const results = await rxnormSource.search('metoprolol');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name.toLowerCase()).toContain('metoprolol');
  });

  it('should get concept by RxCUI', async () => {
    // 866924 is metoprolol tartrate
    const concept = await rxnormSource.getByCode('RxNorm', '866924');
    expect(concept).not.toBeNull();
    expect(concept?.preferredTerm.toLowerCase()).toContain('metoprolol');
  });

  it('should have correct coverage metadata', () => {
    const coverage = rxnormSource.getCoverage();
    expect(coverage.medications).toBe(1.0);
    expect(coverage.diagnoses).toBe(0);
  });
});

describe('ICD-10 Source', () => {
  beforeAll(async () => {
    const available = await icd10Source.isAvailable();
    if (!available) {
      console.warn('ICD-10 API not available - skipping tests');
    }
  });

  it('should search for diagnoses', async () => {
    const results = await icd10Source.search('hypertension');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name.toLowerCase()).toContain('hypertension');
  });

  it('should get concept by code', async () => {
    // I10 is Essential hypertension
    const concept = await icd10Source.getByCode('ICD-10-CM', 'I10');
    expect(concept).not.toBeNull();
    expect(concept?.id).toBe('I10');
  });

  it('should validate known codes', async () => {
    const result = await icd10Source.validate({
      id: 'I10',
      preferredTerm: 'Essential hypertension',
      synonyms: [],
      codes: { 'ICD-10-CM': 'I10' },
      category: 'diagnosis',
      confidence: 1,
      source: 'test',
    });
    expect(result.valid).toBe(true);
  });
});
