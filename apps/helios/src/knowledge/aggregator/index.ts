/**
 * HELIOS Knowledge Aggregator
 * Queries multiple sources, achieves consensus, prevents hallucination
 */

import type {
  KnowledgeSource, KnowledgeQuery, KnowledgeResult,
  MedicalConcept, ConsensusOptions, ConsensusResult,
  VerificationResult, ConflictInfo, CodingSystem
} from '../types.js';
import type { SupportedLanguage } from '../../config/languages.js';
import { logger } from '../../utils/logger.js';

export class KnowledgeAggregator {
  private sources: Map<string, KnowledgeSource> = new Map();

  // ========================================
  // SOURCE MANAGEMENT
  // ========================================

  registerSource(source: KnowledgeSource): void {
    this.sources.set(source.id, source);
    logger.info('Knowledge source registered', {
      id: source.id,
      name: source.name,
      type: source.type,
    });
  }

  unregisterSource(sourceId: string): boolean {
    return this.sources.delete(sourceId);
  }

  getSource(sourceId: string): KnowledgeSource | undefined {
    return this.sources.get(sourceId);
  }

  listSources(): KnowledgeSource[] {
    return Array.from(this.sources.values());
  }

  // ========================================
  // CONSENSUS QUERY
  // ========================================

  async queryWithConsensus(
    query: KnowledgeQuery,
    options: ConsensusOptions = {}
  ): Promise<ConsensusResult> {
    const {
      minSources = 2,
      consensusThreshold = 0.7,
      requireCitation = true,
      timeout = 10000,
    } = options;

    logger.info('Starting consensus query', { query, options });

    // Get relevant sources for this query type
    const relevantSources = this.getRelevantSources(query);

    if (relevantSources.length < minSources) {
      return {
        achieved: false,
        confidence: 0,
        results: [],
        message: `Insufficient sources: need ${minSources}, have ${relevantSources.length}`,
      };
    }

    // Query all sources in parallel with timeout
    const sourceResults = await Promise.all(
      relevantSources.map(async source => {
        try {
          const results = await Promise.race([
            source.query(query),
            new Promise<KnowledgeResult[]>((_, reject) =>
              setTimeout(() => reject(new Error('Timeout')), timeout)
            ),
          ]);

          return {
            sourceId: source.id,
            confidence: source.getConfidence(),
            results,
          };
        } catch (error) {
          logger.warn('Source query failed', { sourceId: source.id, error });
          return {
            sourceId: source.id,
            confidence: 0,
            results: [],
          };
        }
      })
    );

    // Filter out failed queries
    const validResults = sourceResults.filter(r => r.results.length > 0);

    if (validResults.length < minSources) {
      return {
        achieved: false,
        confidence: 0,
        results: [],
        message: `Only ${validResults.length} sources returned results`,
      };
    }

    // Find consensus across results
    const consensus = this.findConsensus(validResults, consensusThreshold);

    // Filter to cited results if required
    let finalResults = consensus.concepts;
    if (requireCitation) {
      finalResults = finalResults.filter(c => c.citations && c.citations.length > 0);
    }

    return {
      achieved: consensus.achieved,
      confidence: consensus.confidence,
      results: finalResults,
      sources: consensus.agreeSources,
      message: consensus.achieved
        ? `Consensus from ${consensus.agreeSources.length} sources`
        : 'No consensus achieved',
      conflictingInfo: consensus.conflicts,
    };
  }

  // ========================================
  // CLAIM VERIFICATION
  // ========================================

  async verifyClaim(
    claim: string,
    claimType: 'diagnosis' | 'medication' | 'treatment' | 'fact',
    language: SupportedLanguage = 'en'
  ): Promise<VerificationResult> {
    logger.info('Verifying claim', { claim, claimType });

    // Extract key terms from claim
    const terms = this.extractTerms(claim);

    if (terms.length === 0) {
      return {
        claim,
        verified: false,
        confidence: 0,
        details: [],
        warning: 'Could not extract verifiable terms from claim',
      };
    }

    // Query for each term
    const verifications = await Promise.all(
      terms.map(async term => {
        const consensus = await this.queryWithConsensus({
          type: this.mapClaimTypeToQueryType(claimType),
          terms: [term],
          language,
          maxResults: 5,
        });

        return {
          concept: term,
          verified: consensus.achieved,
          confidence: consensus.confidence,
          source: consensus.sources?.join(', '),
        };
      })
    );

    // Calculate overall verification
    const verifiedCount = verifications.filter(v => v.verified).length;
    const confidence = terms.length > 0 ? verifiedCount / terms.length : 0;

    return {
      claim,
      verified: confidence >= 0.7, // 70% of terms must verify
      confidence,
      details: verifications,
      warning: confidence < 0.7
        ? 'Some claims could not be verified against medical knowledge base'
        : undefined,
    };
  }

  // ========================================
  // DIRECT CODE LOOKUP
  // ========================================

  async lookupCode(
    system: CodingSystem,
    code: string
  ): Promise<MedicalConcept | null> {
    for (const source of this.sources.values()) {
      try {
        const concept = await source.getByCode(system, code);
        if (concept) return concept;
      } catch (error) {
        logger.warn('Code lookup failed', { sourceId: source.id, system, code });
      }
    }
    return null;
  }

  // ========================================
  // PRIVATE HELPERS
  // ========================================

  private getRelevantSources(query: KnowledgeQuery): KnowledgeSource[] {
    return Array.from(this.sources.values()).filter(source => {
      const coverage = source.getCoverage();

      switch (query.type) {
        case 'medication':
          return coverage.medications > 0;
        case 'diagnosis':
          return coverage.diagnoses > 0;
        case 'symptom':
          return coverage.symptoms > 0 || coverage.diagnoses > 0;
        case 'procedure':
          return coverage.procedures > 0;
        case 'guideline':
          return coverage.guidelines > 0;
        default:
          return true;
      }
    });
  }

  private findConsensus(
    sourceResults: Array<{
      sourceId: string;
      confidence: number;
      results: KnowledgeResult[];
    }>,
    threshold: number
  ): {
    achieved: boolean;
    confidence: number;
    concepts: MedicalConcept[];
    agreeSources: string[];
    conflicts: ConflictInfo[];
  } {
    // Group concepts by normalized key (preferredTerm lowercase)
    const conceptGroups = new Map<string, {
      concept: MedicalConcept;
      sources: string[];
      totalConfidence: number;
    }>();

    for (const { sourceId, confidence, results } of sourceResults) {
      for (const result of results) {
        const key = result.concept.preferredTerm.toLowerCase().trim();

        const existing = conceptGroups.get(key);
        if (existing) {
          existing.sources.push(sourceId);
          existing.totalConfidence += confidence * result.relevanceScore;
          // Merge codes
          Object.assign(existing.concept.codes, result.concept.codes);
          // Merge citations
          if (result.concept.citations) {
            existing.concept.citations = [
              ...(existing.concept.citations || []),
              ...result.concept.citations,
            ];
          }
        } else {
          conceptGroups.set(key, {
            concept: { ...result.concept },
            sources: [sourceId],
            totalConfidence: confidence * result.relevanceScore,
          });
        }
      }
    }

    // Find concepts with consensus
    const totalSources = sourceResults.length;
    const consensusConcepts: MedicalConcept[] = [];
    const agreeSources = new Set<string>();
    const conflicts: ConflictInfo[] = [];

    for (const [key, group] of conceptGroups) {
      const agreementRatio = group.sources.length / totalSources;

      if (agreementRatio >= threshold) {
        // Consensus achieved for this concept
        group.concept.confidence = group.totalConfidence / group.sources.length;
        consensusConcepts.push(group.concept);
        group.sources.forEach(s => agreeSources.add(s));
      } else if (group.sources.length >= 1 && agreementRatio < threshold) {
        // Potential conflict
        conflicts.push({
          topic: key,
          sources: group.sources.map(s => ({
            source: s,
            value: group.concept.preferredTerm,
            confidence: group.concept.confidence,
          })),
        });
      }
    }

    // Calculate overall confidence
    const overallConfidence = consensusConcepts.length > 0
      ? consensusConcepts.reduce((sum, c) => sum + c.confidence, 0) / consensusConcepts.length
      : 0;

    return {
      achieved: consensusConcepts.length > 0 && overallConfidence >= threshold,
      confidence: overallConfidence,
      concepts: consensusConcepts,
      agreeSources: Array.from(agreeSources),
      conflicts,
    };
  }

  private extractTerms(text: string): string[] {
    // Simple term extraction - in production, use NLP
    return text
      .toLowerCase()
      .split(/[,;.\s]+/)
      .filter(t => t.length > 2)
      .filter(t => !['the', 'and', 'for', 'with', 'this', 'that', 'from'].includes(t));
  }

  private mapClaimTypeToQueryType(
    claimType: 'diagnosis' | 'medication' | 'treatment' | 'fact'
  ): 'diagnosis' | 'medication' | 'symptom' | 'procedure' | 'guideline' {
    switch (claimType) {
      case 'diagnosis': return 'diagnosis';
      case 'medication': return 'medication';
      case 'treatment': return 'guideline';
      default: return 'diagnosis';
    }
  }
}

// Export singleton
export const knowledgeAggregator = new KnowledgeAggregator();
