/**
 * HELIOS ICD-10 Validation Service
 *
 * Integrates with NLM Clinical Tables API for ICD-10-CM code validation.
 * Implements two-tier caching (in-memory + Supabase) for performance.
 *
 * API Documentation: https://clinicaltables.nlm.nih.gov/apidoc/icd10cm/v3/doc.html
 */

import { supabase } from '@/integrations/supabase/client';
import type { ICD10Code, DifferentialDiagnosis } from '@/types/medical-triage';

// ============================================
// TYPES
// ============================================

/**
 * Search options for ICD-10 queries
 */
export interface SearchOptions {
  /** Maximum results to return (default: 10) */
  maxResults?: number;
  /** Search fields: 'code', 'name', or 'both' (default: 'both') */
  searchFields?: 'code' | 'name' | 'both';
  /** Minimum confidence threshold for results */
  minConfidence?: number;
}

/**
 * Individual ICD-10 search result item
 */
export interface ICD10SearchItem {
  /** ICD-10-CM code (e.g., "J06.9") */
  code: string;
  /** Code description/name */
  name: string;
  /** Relevance score from API (0-1) */
  relevanceScore?: number;
}

/**
 * Full search result from NLM API
 */
export interface ICD10SearchResult {
  /** Total matching codes found */
  totalCount: number;
  /** Array of matching codes */
  items: ICD10SearchItem[];
  /** Query that was searched */
  query: string;
  /** Whether result came from cache */
  cached: boolean;
  /** Response time in ms */
  responseTimeMs: number;
}

/**
 * Validation result for a diagnosis text
 */
export interface ValidationResult {
  /** Whether a valid ICD-10 match was found */
  isValid: boolean;
  /** Best matching ICD-10 code, if found */
  bestMatch: ICD10Code | null;
  /** Confidence in the match (0-1) */
  confidence: number;
  /** All potential matches above threshold */
  alternatives?: ICD10Code[];
  /** Original diagnosis text that was validated */
  originalText: string;
}

/**
 * Grounded diagnosis with validated ICD-10 code
 */
export interface GroundedDiagnosis {
  /** Original diagnosis text from AI */
  originalDiagnosis: string;
  /** Validated ICD-10 code */
  icd10: ICD10Code;
  /** Grounding confidence (0-1) */
  groundingConfidence: number;
  /** Whether code was successfully validated */
  validated: boolean;
}

/**
 * Cache entry structure
 */
interface CacheEntry {
  result: ICD10SearchResult;
  timestamp: number;
  expiresAt: number;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Normalize query text for consistent searching and caching
 */
export function normalizeQuery(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[^\w\s.-]/g, '');
}

/**
 * Calculate Jaccard similarity between two strings
 * Returns value between 0 (no similarity) and 1 (identical)
 */
export function calculateJaccardSimilarity(text1: string, text2: string): number {
  const normalize = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2) // Filter out small words
    );

  const set1 = normalize(text1);
  const set2 = normalize(text2);

  if (set1.size === 0 && set2.size === 0) return 1;
  if (set1.size === 0 || set2.size === 0) return 0;

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Calculate Levenshtein distance between two strings
 */
export function levenshteinDistance(str1: string, str2: string): number {
  const m = str1.length;
  const n = str2.length;

  // Create matrix
  const dp: number[][] = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(0));

  // Initialize first row and column
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  // Fill matrix
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return dp[m][n];
}

/**
 * Calculate normalized Levenshtein similarity (0-1)
 */
export function calculateLevenshteinSimilarity(text1: string, text2: string): number {
  const s1 = text1.toLowerCase().trim();
  const s2 = text2.toLowerCase().trim();

  if (s1 === s2) return 1;
  if (s1.length === 0 || s2.length === 0) return 0;

  const distance = levenshteinDistance(s1, s2);
  const maxLength = Math.max(s1.length, s2.length);

  return 1 - distance / maxLength;
}

/**
 * Combined similarity score using both Jaccard and Levenshtein
 */
export function calculateSimilarity(text1: string, text2: string): number {
  const jaccard = calculateJaccardSimilarity(text1, text2);
  const levenshtein = calculateLevenshteinSimilarity(text1, text2);

  // Weighted average: Jaccard for concept matching, Levenshtein for exact matching
  return jaccard * 0.6 + levenshtein * 0.4;
}

/**
 * Generate SHA-256 hash of query for cache key
 */
export async function hashQuery(query: string): Promise<string> {
  const normalized = normalizeQuery(query);
  const encoder = new TextEncoder();
  const data = encoder.encode(normalized);

  // Use Web Crypto API
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  return hashHex;
}

/**
 * Synchronous hash for environments without crypto.subtle
 * Uses simple djb2 hash algorithm
 */
export function hashQuerySync(query: string): string {
  const normalized = normalizeQuery(query);
  let hash = 5381;

  for (let i = 0; i < normalized.length; i++) {
    hash = (hash * 33) ^ normalized.charCodeAt(i);
  }

  // Convert to hex string and pad to consistent length
  return (hash >>> 0).toString(16).padStart(16, '0');
}

/**
 * Sleep helper for retry backoff
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================
// ICD-10 CACHE SERVICE
// ============================================

/**
 * Two-tier cache for ICD-10 lookups
 * L1: In-memory Map (1-hour TTL)
 * L2: Supabase icd10_cache table (7-day TTL)
 */
export class ICD10CacheService {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private readonly L1_TTL_MS = 60 * 60 * 1000; // 1 hour
  private readonly L2_TTL_DAYS = 7;

  constructor() {
    // Cleanup expired entries periodically
    if (typeof window !== 'undefined') {
      setInterval(() => this.cleanupMemoryCache(), 10 * 60 * 1000); // Every 10 minutes
    }
  }

  /**
   * Get cached result by query hash
   */
  async get(queryHash: string): Promise<ICD10SearchResult | null> {
    const now = Date.now();

    // Check L1 (memory) cache first
    const memoryEntry = this.memoryCache.get(queryHash);
    if (memoryEntry && memoryEntry.expiresAt > now) {
      return { ...memoryEntry.result, cached: true };
    }

    // Check L2 (Supabase) cache - disabled until icd10_cache table is created
    // For now, only use L1 memory cache
    /*
    try {
      const { data, error } = await (supabase as any)
        .from('icd10_cache')
        .select('response_json, expires_at')
        .eq('query_hash', queryHash)
        .single();

      if (error || !data) return null;

      const expiresAt = new Date(data.expires_at).getTime();
      if (expiresAt < now) {
        await this.delete(queryHash);
        return null;
      }

      const result = data.response_json as ICD10SearchResult;

      this.memoryCache.set(queryHash, {
        result,
        timestamp: now,
        expiresAt: now + this.L1_TTL_MS,
      });

      return { ...result, cached: true };
    } catch (err) {
      console.warn('[ICD10Cache] L2 cache read error:', err);
      return null;
    }
    */
    return null;
  }

  /**
   * Store result in both cache tiers
   */
  async set(queryHash: string, queryText: string, result: ICD10SearchResult): Promise<void> {
    const now = Date.now();

    // Store in L1 (memory)
    this.memoryCache.set(queryHash, {
      result,
      timestamp: now,
      expiresAt: now + this.L1_TTL_MS,
    });

    // Store in L2 (Supabase) - disabled until icd10_cache table is created
    /*
    try {
      await (supabase as any).from('icd10_cache').upsert(
        {
          query_hash: queryHash,
          query_text: queryText,
          response_json: result,
          created_at: new Date().toISOString(),
          expires_at: new Date(now + this.L2_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString(),
        },
        { onConflict: 'query_hash' }
      );
    } catch (err) {
      console.warn('[ICD10Cache] L2 cache write error:', err);
    }
    */
  }

  /**
   * Delete cache entry
   */
  async delete(queryHash: string): Promise<void> {
    this.memoryCache.delete(queryHash);
    // L2 delete disabled until icd10_cache table is created
  }

  /**
   * Cleanup expired L1 entries
   */
  private cleanupMemoryCache(): void {
    const now = Date.now();
    let cleaned = 0;

    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt < now) {
        this.memoryCache.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[ICD10Cache] Cleaned ${cleaned} expired L1 entries`);
    }
  }

  /**
   * Cleanup expired L2 entries (call periodically via cron)
   * Disabled until icd10_cache table is created
   */
  async cleanupExpired(): Promise<number> {
    // L2 cleanup disabled until icd10_cache table is created
    return 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): { l1Size: number; l1MemoryBytes: number } {
    const l1Size = this.memoryCache.size;
    // Rough estimate of memory usage
    const l1MemoryBytes = l1Size * 2048; // ~2KB per entry estimate

    return { l1Size, l1MemoryBytes };
  }

  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.memoryCache.clear();
    // L2 clear disabled until icd10_cache table is created
  }
}

// ============================================
// NLM CLINICAL TABLES CLIENT
// ============================================

/**
 * Client for NLM Clinical Tables ICD-10-CM API
 *
 * API: https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search
 */
export class NLMClinicalTablesClient {
  private readonly baseUrl = 'https://clinicaltables.nlm.nih.gov/api/icd10cm/v3/search';
  private readonly cache: ICD10CacheService;
  private readonly maxRetries = 3;
  private readonly retryDelayMs = 1000;

  constructor(cache?: ICD10CacheService) {
    this.cache = cache || new ICD10CacheService();
  }

  /**
   * Search ICD-10-CM codes by text
   *
   * @param query - Search query (diagnosis name or code)
   * @param options - Search options
   * @returns Search results with matching codes
   */
  async searchICD10(query: string, options: SearchOptions = {}): Promise<ICD10SearchResult> {
    const startTime = Date.now();
    const normalizedQuery = normalizeQuery(query);

    if (!normalizedQuery) {
      return {
        totalCount: 0,
        items: [],
        query: query,
        cached: false,
        responseTimeMs: Date.now() - startTime,
      };
    }

    // Check cache first
    const queryHash = hashQuerySync(normalizedQuery);
    const cached = await this.cache.get(queryHash);
    if (cached) {
      return {
        ...cached,
        responseTimeMs: Date.now() - startTime,
      };
    }

    // Build request URL
    const { maxResults = 10, searchFields = 'both' } = options;

    const params = new URLSearchParams({
      terms: normalizedQuery,
      maxList: maxResults.toString(),
      df: 'code,name', // Display fields
    });

    // Set search fields
    if (searchFields === 'code') {
      params.set('sf', 'code');
    } else if (searchFields === 'name') {
      params.set('sf', 'name');
    } else {
      params.set('sf', 'code,name');
    }

    const url = `${this.baseUrl}?${params.toString()}`;

    // Execute with retry
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            Accept: 'application/json',
          },
        });

        if (!response.ok) {
          throw new Error(`NLM API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // NLM API returns: [totalCount, codes[], null, displayStrings[][]]
        // displayStrings format: [[code1, name1], [code2, name2], ...]
        const [totalCount, codes, , displayStrings] = data as [
          number,
          string[],
          null,
          string[][]
        ];

        const items: ICD10SearchItem[] = (displayStrings || []).map(
          ([code, name]: string[], index: number) => ({
            code,
            name,
            relevanceScore: 1 - index * 0.05, // Decreasing relevance
          })
        );

        const result: ICD10SearchResult = {
          totalCount,
          items,
          query,
          cached: false,
          responseTimeMs: Date.now() - startTime,
        };

        // Cache successful result
        await this.cache.set(queryHash, normalizedQuery, result);

        console.log(
          `[ICD10] Search "${query}" returned ${items.length} results in ${result.responseTimeMs}ms`
        );

        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        console.warn(`[ICD10] Search attempt ${attempt}/${this.maxRetries} failed:`, lastError.message);

        if (attempt < this.maxRetries) {
          await sleep(this.retryDelayMs * Math.pow(2, attempt - 1)); // Exponential backoff
        }
      }
    }

    // All retries failed, return gracefully degraded result
    console.error('[ICD10] Search failed after all retries:', lastError?.message);

    return {
      totalCount: 0,
      items: [],
      query,
      cached: false,
      responseTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Validate a diagnosis text against ICD-10 codes
   *
   * @param diagnosisText - Free-text diagnosis to validate
   * @returns Validation result with best matching code
   */
  async validateDiagnosis(diagnosisText: string): Promise<ValidationResult> {
    const normalized = normalizeQuery(diagnosisText);

    if (!normalized) {
      return {
        isValid: false,
        bestMatch: null,
        confidence: 0,
        originalText: diagnosisText,
      };
    }

    // Search for matching codes
    const searchResult = await this.searchICD10(diagnosisText, {
      maxResults: 5,
      searchFields: 'name',
    });

    if (searchResult.items.length === 0) {
      return {
        isValid: false,
        bestMatch: null,
        confidence: 0,
        originalText: diagnosisText,
      };
    }

    // Calculate similarity scores for each result
    const scoredResults = searchResult.items.map(item => ({
      item,
      similarity: calculateSimilarity(diagnosisText, item.name),
    }));

    // Sort by similarity descending
    scoredResults.sort((a, b) => b.similarity - a.similarity);

    const best = scoredResults[0];
    const confidence = best.similarity;
    const isValid = confidence > 0.3; // Validation threshold

    // Build alternatives list (above 0.2 threshold)
    const alternatives: ICD10Code[] = scoredResults
      .filter(r => r.similarity > 0.2)
      .map(r => ({
        code: r.item.code,
        name: r.item.name,
        confidence: r.similarity,
        validated: r.similarity > 0.3,
      }));

    return {
      isValid,
      bestMatch: isValid
        ? {
            code: best.item.code,
            name: best.item.name,
            confidence,
            validated: true,
          }
        : null,
      confidence,
      alternatives: alternatives.length > 1 ? alternatives.slice(1) : undefined,
      originalText: diagnosisText,
    };
  }

  /**
   * Ground a list of AI-generated diagnoses with validated ICD-10 codes
   *
   * @param aiDiagnoses - Array of diagnosis texts from AI
   * @returns Array of grounded diagnoses, sorted by confidence
   */
  async groundDifferentialList(aiDiagnoses: string[]): Promise<GroundedDiagnosis[]> {
    if (aiDiagnoses.length === 0) return [];

    // Validate all diagnoses in parallel
    const validationPromises = aiDiagnoses.map(async diagnosis => {
      const result = await this.validateDiagnosis(diagnosis);
      return { diagnosis, result };
    });

    const validationResults = await Promise.all(validationPromises);

    // Build grounded list
    const groundedDiagnoses: GroundedDiagnosis[] = validationResults
      .filter(({ result }) => result.isValid && result.bestMatch)
      .map(({ diagnosis, result }) => ({
        originalDiagnosis: diagnosis,
        icd10: result.bestMatch!,
        groundingConfidence: result.confidence,
        validated: true,
      }));

    // Sort by confidence descending
    groundedDiagnoses.sort((a, b) => b.groundingConfidence - a.groundingConfidence);

    // Log grounding results
    const validated = groundedDiagnoses.length;
    const total = aiDiagnoses.length;
    const filtered = total - validated;

    console.log(
      `[ICD10] Grounded ${validated}/${total} diagnoses (filtered ${filtered} unvalidated)`
    );

    return groundedDiagnoses;
  }

  /**
   * Get ICD-10 code details by exact code
   *
   * @param code - Exact ICD-10 code (e.g., "J06.9")
   * @returns Code details or null if not found
   */
  async getCodeDetails(code: string): Promise<ICD10SearchItem | null> {
    const result = await this.searchICD10(code, {
      maxResults: 1,
      searchFields: 'code',
    });

    if (result.items.length === 0) return null;

    const item = result.items[0];

    // Verify exact code match
    if (item.code.toUpperCase() !== code.toUpperCase()) {
      return null;
    }

    return item;
  }

  /**
   * Validate a DifferentialDiagnosis object and attach grounded ICD-10
   *
   * @param differential - Differential diagnosis to validate
   * @returns Validated differential with grounded ICD-10
   */
  async validateDifferentialDiagnosis(
    differential: Partial<DifferentialDiagnosis>
  ): Promise<DifferentialDiagnosis | null> {
    const diagnosisText = differential.diagnosis || differential.icd10?.name;

    if (!diagnosisText) return null;

    const validation = await this.validateDiagnosis(diagnosisText);

    if (!validation.isValid || !validation.bestMatch) {
      return null;
    }

    return {
      rank: differential.rank || 0,
      diagnosis: diagnosisText,
      icd10: validation.bestMatch,
      confidence: differential.confidence || validation.confidence,
      reasoning: differential.reasoning || '',
      supportingEvidence: differential.supportingEvidence || [],
      refutingEvidence: differential.refutingEvidence,
      mustNotMiss: differential.mustNotMiss,
      urgency: differential.urgency,
    };
  }

  /**
   * Get cache service for external management
   */
  getCacheService(): ICD10CacheService {
    return this.cache;
  }
}

// ============================================
// SINGLETON INSTANCE
// ============================================

/** Global cache instance */
export const icd10Cache = new ICD10CacheService();

/** Global client instance */
export const icd10Client = new NLMClinicalTablesClient(icd10Cache);

// ============================================
// CONVENIENCE EXPORTS
// ============================================

/**
 * Quick search function
 */
export async function searchICD10(
  query: string,
  options?: SearchOptions
): Promise<ICD10SearchResult> {
  return icd10Client.searchICD10(query, options);
}

/**
 * Quick validate function
 */
export async function validateDiagnosis(diagnosisText: string): Promise<ValidationResult> {
  return icd10Client.validateDiagnosis(diagnosisText);
}

/**
 * Quick ground function
 */
export async function groundDifferentialList(aiDiagnoses: string[]): Promise<GroundedDiagnosis[]> {
  return icd10Client.groundDifferentialList(aiDiagnoses);
}
