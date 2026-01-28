/**
 * RxNorm Knowledge Source
 * National Library of Medicine - FREE API
 * https://rxnav.nlm.nih.gov/
 */

import type {
  KnowledgeSource, KnowledgeQuery, KnowledgeResult,
  MedicalConcept, SearchResult, ValidationResult,
  KnowledgeCoverage, CodingSystem, DrugInfo, DrugInteraction
} from '../../types.js';
import { logger } from '../../../utils/logger.js';
import { withRetry } from '../../../utils/index.js';

export class RxNormSource implements KnowledgeSource {
  id = 'rxnorm';
  name = 'RxNorm (NLM)';
  type = 'terminology' as const;
  version = '2024-01';
  lastUpdated = new Date();

  private baseUrl = 'https://rxnav.nlm.nih.gov/REST';

  // ========================================
  // QUERY IMPLEMENTATION
  // ========================================

  async query(params: KnowledgeQuery): Promise<KnowledgeResult[]> {
    if (params.type !== 'medication') return [];

    const results: KnowledgeResult[] = [];

    for (const term of params.terms) {
      try {
        const searchResults = await this.search(term, { maxResults: 5 });

        for (const sr of searchResults) {
          const concept = await this.getConceptByRxcui(sr.id);
          if (concept) {
            results.push({
              concept,
              relevanceScore: sr.score,
              matchType: sr.score === 1 ? 'exact' : 'fuzzy',
            });
          }
        }
      } catch (error) {
        logger.warn('RxNorm query failed for term', { term, error });
      }
    }

    return results;
  }

  // ========================================
  // SEARCH IMPLEMENTATION
  // ========================================

  async search(text: string, options?: { maxResults?: number }): Promise<SearchResult[]> {
    const maxResults = options?.maxResults || 10;

    try {
      // Try approximate match first (handles typos)
      const response = await withRetry(
        () => fetch(`${this.baseUrl}/approximateTerm.json?term=${encodeURIComponent(text)}&maxEntries=${maxResults}`),
        3,
        500
      );

      const data = await response.json() as {
        approximateGroup?: {
          candidate?: Array<{ rxcui: string; name?: string; score?: string }>;
        };
      };
      const candidates = data.approximateGroup?.candidate || [];

      return candidates.map((c, i) => ({
        id: c.rxcui,
        name: c.name || text,
        score: c.score ? parseFloat(c.score) / 100 : (1 - i * 0.1),
        source: this.id,
        codes: { RxNorm: c.rxcui },
      }));
    } catch (error) {
      logger.error('RxNorm search failed', { text, error });
      return [];
    }
  }

  // ========================================
  // GET BY CODE
  // ========================================

  async getByCode(system: CodingSystem, code: string): Promise<MedicalConcept | null> {
    if (system !== 'RxNorm') return null;
    return this.getConceptByRxcui(code);
  }

  // ========================================
  // CORE RXCUI LOOKUP
  // ========================================

  async getConceptByRxcui(rxcui: string): Promise<DrugInfo | null> {
    try {
      interface RxProperties {
        properties?: {
          name?: string;
          drugclass?: string;
        };
      }
      interface RxRelated {
        allRelatedGroup?: {
          conceptGroup?: Array<{
            tty?: string;
            conceptProperties?: Array<{ name: string }>;
          }>;
        };
      }

      const [properties, allRelated] = await Promise.all([
        this.fetchJson(`${this.baseUrl}/rxcui/${rxcui}/properties.json`) as Promise<RxProperties>,
        this.fetchJson(`${this.baseUrl}/rxcui/${rxcui}/allrelated.json`) as Promise<RxRelated>,
      ]);

      const props = properties.properties;
      if (!props) return null;

      // Extract related concepts (brand names, ingredients, etc.)
      const related = allRelated.allRelatedGroup?.conceptGroup || [];
      const brandNames: string[] = [];
      const synonyms: string[] = [];

      for (const group of related) {
        const concepts = group.conceptProperties || [];
        for (const c of concepts) {
          if (group.tty === 'BN' || group.tty === 'SBD') {
            brandNames.push(c.name);
          } else {
            synonyms.push(c.name);
          }
        }
      }

      return {
        id: rxcui,
        preferredTerm: props.name || rxcui,
        synonyms: [...new Set(synonyms)],
        codes: { RxNorm: rxcui },
        category: 'medication',
        confidence: 1.0,
        source: this.id,
        citations: [{
          source: 'National Library of Medicine - RxNorm',
          url: `https://mor.nlm.nih.gov/RxNav/search?searchBy=RXCUI&searchTerm=${rxcui}`,
        }],
        // Drug-specific fields
        genericName: props.name,
        brandNames: [...new Set(brandNames)],
        drugClass: props.drugclass,
      };
    } catch (error) {
      logger.error('RxNorm getConceptByRxcui failed', { rxcui, error });
      return null;
    }
  }

  // ========================================
  // DRUG INTERACTIONS
  // ========================================

  async getInteractions(rxcui: string): Promise<DrugInteraction[]> {
    try {
      interface InteractionData {
        interactionTypeGroup?: Array<{
          sourceName?: string;
          sourceDisclaimer?: string;
          interactionType?: Array<{
            interactionPair?: Array<{
              severity?: string;
              description?: string;
              interactionConcept?: Array<{
                minConceptItem?: { rxcui?: string; name?: string };
              }>;
            }>;
          }>;
        }>;
      }

      const data = await this.fetchJson(
        `${this.baseUrl}/interaction/interaction.json?rxcui=${rxcui}`
      ) as InteractionData;

      const interactions: DrugInteraction[] = [];
      const groups = data.interactionTypeGroup || [];

      for (const group of groups) {
        for (const type of group.interactionType || []) {
          for (const pair of type.interactionPair || []) {
            interactions.push({
              drug1: {
                id: rxcui,
                preferredTerm: pair.interactionConcept?.[0]?.minConceptItem?.name || '',
                synonyms: [],
                codes: { RxNorm: rxcui },
                category: 'medication',
                confidence: 1,
                source: this.id,
              },
              drug2: {
                id: pair.interactionConcept?.[1]?.minConceptItem?.rxcui || '',
                preferredTerm: pair.interactionConcept?.[1]?.minConceptItem?.name || '',
                synonyms: [],
                codes: { RxNorm: pair.interactionConcept?.[1]?.minConceptItem?.rxcui },
                category: 'medication',
                confidence: 1,
                source: this.id,
              },
              severity: this.mapSeverity(pair.severity),
              description: pair.description || 'Drug interaction detected',
              citations: [{
                source: group.sourceName || 'RxNorm',
                url: group.sourceDisclaimer,
              }],
            });
          }
        }
      }

      return interactions;
    } catch (error) {
      logger.error('RxNorm getInteractions failed', { rxcui, error });
      return [];
    }
  }

  // ========================================
  // VALIDATION
  // ========================================

  async validate(concept: MedicalConcept): Promise<ValidationResult> {
    if (concept.category !== 'medication') {
      return { valid: false, reason: 'Not a medication concept' };
    }

    if (!concept.codes.RxNorm) {
      // Try to find by name
      const results = await this.search(concept.preferredTerm, { maxResults: 1 });
      if (results.length > 0) {
        return {
          valid: true,
          reason: 'Found in RxNorm by name',
          confidence: results[0].score,
          corrections: results[0].id !== concept.id ? [`Suggested RxCUI: ${results[0].id}`] : undefined,
        };
      }
      return { valid: false, reason: 'No RxNorm code and not found by name' };
    }

    const found = await this.getConceptByRxcui(concept.codes.RxNorm);
    return {
      valid: found !== null,
      reason: found ? 'Verified in RxNorm' : 'RxCUI not found',
      confidence: found ? 1.0 : 0,
    };
  }

  // ========================================
  // METADATA
  // ========================================

  getCoverage(): KnowledgeCoverage {
    return {
      medications: 1.0,
      diagnoses: 0,
      procedures: 0,
      symptoms: 0,
      guidelines: 0,
    };
  }

  getConfidence(): number {
    return 0.98; // Very high - authoritative US source
  }

  async isAvailable(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/version.json`);
      return response.ok;
    } catch {
      return false;
    }
  }

  // ========================================
  // HELPERS
  // ========================================

  private async fetchJson<T = Record<string, unknown>>(url: string): Promise<T> {
    const response = await withRetry(() => fetch(url), 3, 500);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json() as Promise<T>;
  }

  private mapSeverity(severity?: string): 'major' | 'moderate' | 'minor' {
    if (!severity) return 'moderate';
    const lower = severity.toLowerCase();
    if (lower.includes('high') || lower.includes('major') || lower.includes('severe')) return 'major';
    if (lower.includes('low') || lower.includes('minor')) return 'minor';
    return 'moderate';
  }
}

// Export singleton
export const rxnormSource = new RxNormSource();
