/**
 * ICD-10-CM Knowledge Source
 * National Library of Medicine - Clinical Tables API
 * https://clinicaltables.nlm.nih.gov/
 */

import type {
  KnowledgeSource, KnowledgeQuery, KnowledgeResult,
  MedicalConcept, SearchResult, ValidationResult,
  KnowledgeCoverage, CodingSystem
} from '../../types.js';
import { logger } from '../../../utils/logger.js';
import { withRetry } from '../../../utils/index.js';

export class ICD10Source implements KnowledgeSource {
  id = 'icd10';
  name = 'ICD-10-CM (NLM Clinical Tables)';
  type = 'terminology' as const;
  version = '2024';
  lastUpdated = new Date();

  private baseUrl = 'https://clinicaltables.nlm.nih.gov/api/icd10cm/v3';

  // ========================================
  // QUERY IMPLEMENTATION
  // ========================================

  async query(params: KnowledgeQuery): Promise<KnowledgeResult[]> {
    if (params.type !== 'diagnosis' && params.type !== 'symptom') return [];

    const results: KnowledgeResult[] = [];

    for (const term of params.terms) {
      try {
        const searchResults = await this.search(term, {
          maxResults: params.maxResults || 10
        });

        for (const sr of searchResults) {
          results.push({
            concept: {
              id: sr.id,
              preferredTerm: sr.name,
              synonyms: [],
              codes: { 'ICD-10-CM': sr.id },
              category: 'diagnosis',
              confidence: sr.score,
              source: this.id,
              citations: [{
                source: 'National Library of Medicine',
                url: 'https://clinicaltables.nlm.nih.gov/',
              }],
            },
            relevanceScore: sr.score,
            matchType: sr.score >= 0.95 ? 'exact' : 'fuzzy',
          });
        }
      } catch (error) {
        logger.warn('ICD-10 query failed for term', { term, error });
      }
    }

    return results;
  }

  // ========================================
  // SEARCH IMPLEMENTATION
  // ========================================

  async search(text: string, options?: { maxResults?: number }): Promise<SearchResult[]> {
    const maxResults = options?.maxResults || 20;

    try {
      const response = await withRetry(
        () => fetch(
          `${this.baseUrl}/search?sf=code,name&terms=${encodeURIComponent(text)}&maxList=${maxResults}`
        ),
        3,
        500
      );

      // Response format: [total, codes, extra_data, display_strings]
      // display_strings is an array of [code, name] tuples
      const data = await response.json() as [number, string[], unknown, Array<[string, string]>];
      const [_total, codes, , displayStrings] = data;

      if (!codes || codes.length === 0) return [];

      return codes.map((code: string, i: number) => ({
        id: code,
        name: displayStrings?.[i]?.[1] || code,
        score: Math.max(0.5, 1 - (i / Math.max(codes.length, 1)) * 0.5),
        source: this.id,
        codes: { 'ICD-10-CM': code },
      }));
    } catch (error) {
      logger.error('ICD-10 search failed', { text, error });
      return [];
    }
  }

  // ========================================
  // GET BY CODE
  // ========================================

  async getByCode(system: CodingSystem, code: string): Promise<MedicalConcept | null> {
    if (system !== 'ICD-10-CM' && system !== 'ICD-10') return null;

    try {
      // Search for exact code match
      const response = await fetch(
        `${this.baseUrl}/search?sf=code&terms=${encodeURIComponent(code)}&maxList=1`
      );

      // Response format: [total, codes, extra_data, display_strings]
      // display_strings is an array of [code, name] tuples
      const data = await response.json() as [number, string[], unknown, Array<[string, string]>];
      const [_total, codes, , displayStrings] = data;

      if (!codes || codes.length === 0) return null;

      // Verify it's an exact match
      if (codes[0].toUpperCase() !== code.toUpperCase()) return null;

      return {
        id: codes[0],
        preferredTerm: displayStrings?.[0]?.[1] || codes[0],
        synonyms: [],
        codes: { 'ICD-10-CM': codes[0] },
        category: 'diagnosis',
        confidence: 1.0,
        source: this.id,
        citations: [{
          source: 'National Library of Medicine',
          url: 'https://clinicaltables.nlm.nih.gov/',
        }],
      };
    } catch (error) {
      logger.error('ICD-10 getByCode failed', { code, error });
      return null;
    }
  }

  // ========================================
  // HIERARCHICAL LOOKUP
  // ========================================

  async getParentCodes(code: string): Promise<string[]> {
    // ICD-10 has hierarchical structure
    // E.g., I21.0 -> I21 -> I20-I25 -> I00-I99
    const parents: string[] = [];

    // Remove trailing characters to get parent
    if (code.includes('.')) {
      parents.push(code.split('.')[0]);
    }

    // Get chapter (first letter or range)
    if (code.length >= 1) {
      const letter = code[0].toUpperCase();
      // Map to chapter ranges
      const chapters: Record<string, string> = {
        'A': 'A00-B99', 'B': 'A00-B99',
        'C': 'C00-D49', 'D': 'C00-D49',
        'E': 'E00-E89',
        'F': 'F01-F99',
        'G': 'G00-G99',
        'H': 'H00-H59',
        'I': 'I00-I99',
        'J': 'J00-J99',
        'K': 'K00-K95',
        'L': 'L00-L99',
        'M': 'M00-M99',
        'N': 'N00-N99',
        'O': 'O00-O9A',
        'P': 'P00-P96',
        'Q': 'Q00-Q99',
        'R': 'R00-R99',
        'S': 'S00-T88', 'T': 'S00-T88',
        'V': 'V00-Y99', 'W': 'V00-Y99', 'X': 'V00-Y99', 'Y': 'V00-Y99',
        'Z': 'Z00-Z99',
      };
      if (chapters[letter]) {
        parents.push(chapters[letter]);
      }
    }

    return parents;
  }

  // ========================================
  // VALIDATION
  // ========================================

  async validate(concept: MedicalConcept): Promise<ValidationResult> {
    if (concept.category !== 'diagnosis') {
      return { valid: false, reason: 'Not a diagnosis concept' };
    }

    const code = concept.codes['ICD-10-CM'] || concept.codes['ICD-10'];

    if (!code) {
      // Try to find by name
      const results = await this.search(concept.preferredTerm, { maxResults: 1 });
      if (results.length > 0) {
        return {
          valid: true,
          reason: 'Found in ICD-10 by name',
          confidence: results[0].score,
          corrections: [`Suggested code: ${results[0].id}`],
        };
      }
      return { valid: false, reason: 'No ICD-10 code and not found by name' };
    }

    const found = await this.getByCode('ICD-10-CM', code);
    return {
      valid: found !== null,
      reason: found ? 'Verified in ICD-10-CM' : 'Code not found',
      confidence: found ? 1.0 : 0,
    };
  }

  // ========================================
  // METADATA
  // ========================================

  getCoverage(): KnowledgeCoverage {
    return {
      medications: 0,
      diagnoses: 1.0,
      procedures: 0,
      symptoms: 0.4, // R-codes cover symptoms
      guidelines: 0,
    };
  }

  getConfidence(): number {
    return 0.98; // Authoritative source
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/search?terms=test&maxList=1`);
      return response.ok;
    } catch {
      return false;
    }
  }
}

// Export singleton
export const icd10Source = new ICD10Source();
