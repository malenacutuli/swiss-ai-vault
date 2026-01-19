// Source Citations Module - Manus Parity Implementation
// Provides citation creation, verification, and claim tracking

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export interface Citation {
  id?: string;
  source_url: string;
  source_title?: string;
  source_domain?: string;
  source_type?: 'web' | 'academic' | 'news' | 'database' | 'api';
  citation_key: string;
  access_date?: string;
  publication_date?: string;
  author?: string;
  excerpt?: string;
  relevance_score?: number;
  credibility_score?: number;
  verified?: boolean;
  metadata?: Record<string, any>;
}

export interface Claim {
  id?: string;
  citation_id: string;
  claim_text: string;
  claim_type?: 'fact' | 'statistic' | 'quote' | 'opinion';
  context_before?: string;
  context_after?: string;
  position_in_output?: number;
  verification_status?: 'unverified' | 'verified' | 'disputed' | 'false';
  confidence_score?: number;
  source_excerpt?: string;
  match_quality?: 'exact' | 'paraphrase' | 'inferred';
}

export interface CitationResult {
  citations: Citation[];
  claims: Claim[];
  inline_references: Map<string, string>; // Map of citation_key to source_url
}

// Domain credibility scores
const DOMAIN_CREDIBILITY: Record<string, number> = {
  'arxiv.org': 0.95,
  'nature.com': 0.98,
  'science.org': 0.98,
  'pubmed.ncbi.nlm.nih.gov': 0.97,
  'scholar.google.com': 0.90,
  'wikipedia.org': 0.75,
  'gov': 0.90,
  'edu': 0.85,
  'reuters.com': 0.88,
  'apnews.com': 0.88,
  'bbc.com': 0.85,
  'nytimes.com': 0.82,
  'washingtonpost.com': 0.82,
};

/**
 * Extract domain from URL
 */
export function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return '';
  }
}

/**
 * Calculate credibility score for a source
 */
export function calculateCredibility(url: string, sourceType: string): number {
  const domain = extractDomain(url);

  // Check known domains
  for (const [knownDomain, score] of Object.entries(DOMAIN_CREDIBILITY)) {
    if (domain.includes(knownDomain) || domain.endsWith(`.${knownDomain}`)) {
      return score;
    }
  }

  // Check TLD-based scoring
  if (domain.endsWith('.gov')) return 0.90;
  if (domain.endsWith('.edu')) return 0.85;
  if (domain.endsWith('.org')) return 0.70;

  // Source type based scoring
  if (sourceType === 'academic') return 0.85;
  if (sourceType === 'news') return 0.70;
  if (sourceType === 'database') return 0.80;

  return 0.60; // Default score
}

/**
 * Create a citation key (e.g., "[1]", "[Smith2024]")
 */
export function createCitationKey(index: number, style: 'numeric' | 'author-year' = 'numeric', author?: string, year?: string): string {
  if (style === 'author-year' && author && year) {
    const lastName = author.split(' ').pop() || author;
    return `[${lastName}${year}]`;
  }
  return `[${index}]`;
}

/**
 * Extract citations from search results
 */
export function extractCitationsFromResults(
  results: Array<{ url: string; title: string; snippet: string; source?: string; relevance_score?: number }>,
  runId?: string,
  userId?: string
): CitationResult {
  const citations: Citation[] = [];
  const claims: Claim[] = [];
  const inlineReferences = new Map<string, string>();

  let citationIndex = 1;

  for (const result of results) {
    if (!result.url) continue;

    const domain = extractDomain(result.url);
    const sourceType = inferSourceType(domain, result.source);
    const credibility = calculateCredibility(result.url, sourceType);
    const citationKey = createCitationKey(citationIndex);

    const citation: Citation = {
      source_url: result.url,
      source_title: result.title,
      source_domain: domain,
      source_type: sourceType,
      citation_key: citationKey,
      access_date: new Date().toISOString(),
      excerpt: result.snippet,
      relevance_score: result.relevance_score || 0.5,
      credibility_score: credibility,
      verified: false,
      metadata: {
        original_source: result.source,
        run_id: runId,
        user_id: userId,
      },
    };

    citations.push(citation);
    inlineReferences.set(citationKey, result.url);
    citationIndex++;
  }

  return { citations, claims, inline_references: inlineReferences };
}

/**
 * Infer source type from domain
 */
function inferSourceType(domain: string, source?: string): 'web' | 'academic' | 'news' | 'database' | 'api' {
  const academicDomains = ['arxiv.org', 'pubmed', 'scholar.google', 'nature.com', 'science.org', 'doi.org', 'researchgate.net'];
  const newsDomains = ['reuters.com', 'apnews.com', 'bbc.com', 'cnn.com', 'nytimes.com', 'washingtonpost.com', 'theguardian.com'];

  if (academicDomains.some(d => domain.includes(d))) return 'academic';
  if (newsDomains.some(d => domain.includes(d))) return 'news';
  if (domain.endsWith('.edu')) return 'academic';
  if (domain.endsWith('.gov')) return 'database';
  if (source === 'perplexity-academic') return 'academic';
  if (source === 'perplexity-news') return 'news';

  return 'web';
}

/**
 * Extract factual claims from text with citation markers
 */
export function extractClaimsFromText(
  text: string,
  citations: Citation[]
): Claim[] {
  const claims: Claim[] = [];

  // Pattern to match sentences with citation markers
  const citationPattern = /\[(\d+)\]/g;
  const sentences = text.split(/(?<=[.!?])\s+/);

  let position = 0;

  for (const sentence of sentences) {
    const matches = [...sentence.matchAll(citationPattern)];

    if (matches.length > 0) {
      for (const match of matches) {
        const citationNum = parseInt(match[1]);
        const citation = citations.find(c => c.citation_key === `[${citationNum}]`);

        if (citation && citation.id) {
          // Extract the claim (sentence without citation marker)
          const claimText = sentence.replace(/\[\d+\]/g, '').trim();

          if (claimText.length > 20) {
            claims.push({
              citation_id: citation.id,
              claim_text: claimText,
              claim_type: inferClaimType(claimText),
              position_in_output: position + (match.index || 0),
              verification_status: 'unverified',
              confidence_score: citation.credibility_score || 0.5,
              match_quality: 'inferred',
            });
          }
        }
      }
    }

    position += sentence.length + 1;
  }

  return claims;
}

/**
 * Infer claim type from text
 */
function inferClaimType(text: string): 'fact' | 'statistic' | 'quote' | 'opinion' {
  // Statistics pattern
  if (/\d+%|\d+\s*(million|billion|thousand|percent)/i.test(text)) {
    return 'statistic';
  }

  // Quote pattern
  if (/"[^"]+"|'[^']+'/i.test(text) || /according to|said|stated/i.test(text)) {
    return 'quote';
  }

  // Opinion indicators
  if (/believe|think|suggest|may|might|could|possibly|likely/i.test(text)) {
    return 'opinion';
  }

  return 'fact';
}

/**
 * Store citations in database
 */
export async function storeCitations(
  supabase: SupabaseClient,
  citations: Citation[],
  runId?: string,
  userId?: string
): Promise<Citation[]> {
  if (citations.length === 0) return [];

  const citationsToInsert = citations.map(c => ({
    user_id: userId,
    run_id: runId,
    source_url: c.source_url,
    source_title: c.source_title,
    source_domain: c.source_domain,
    source_type: c.source_type,
    citation_key: c.citation_key,
    access_date: c.access_date || new Date().toISOString(),
    publication_date: c.publication_date,
    author: c.author,
    excerpt: c.excerpt,
    relevance_score: c.relevance_score,
    credibility_score: c.credibility_score,
    verified: c.verified || false,
    metadata: c.metadata || {},
  }));

  const { data, error } = await supabase
    .from('source_citations')
    .insert(citationsToInsert)
    .select();

  if (error) {
    console.error('[citations] Failed to store citations:', error);
    return citations;
  }

  return data || citations;
}

/**
 * Store claims in database
 */
export async function storeClaims(
  supabase: SupabaseClient,
  claims: Claim[],
  runId?: string,
  userId?: string
): Promise<void> {
  if (claims.length === 0) return;

  const claimsToInsert = claims.map(c => ({
    user_id: userId,
    run_id: runId,
    citation_id: c.citation_id,
    claim_text: c.claim_text,
    claim_type: c.claim_type,
    context_before: c.context_before,
    context_after: c.context_after,
    position_in_output: c.position_in_output,
    verification_status: c.verification_status || 'unverified',
    confidence_score: c.confidence_score,
    source_excerpt: c.source_excerpt,
    match_quality: c.match_quality,
  }));

  const { error } = await supabase
    .from('citation_claims')
    .insert(claimsToInsert);

  if (error) {
    console.error('[citations] Failed to store claims:', error);
  }
}

/**
 * Verify citation URL is accessible
 */
export async function verifyCitationUrl(
  supabase: SupabaseClient,
  citation: Citation
): Promise<{ verified: boolean; status?: number; error?: string }> {
  try {
    const response = await fetch(citation.source_url, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'SwissBrain Citation Verifier/1.0',
      },
    });

    const verified = response.ok;

    // Log verification attempt
    if (citation.id) {
      await supabase.from('citation_verification_logs').insert({
        citation_id: citation.id,
        verification_type: 'url_accessible',
        verification_result: verified,
        http_status: response.status,
        verification_details: {
          status_text: response.statusText,
          content_type: response.headers.get('content-type'),
        },
      });

      // Update citation
      await supabase
        .from('source_citations')
        .update({
          verified,
          verification_method: 'url_check',
          verification_date: new Date().toISOString(),
        })
        .eq('id', citation.id);
    }

    return { verified, status: response.status };
  } catch (error: any) {
    if (citation.id) {
      await supabase.from('citation_verification_logs').insert({
        citation_id: citation.id,
        verification_type: 'url_accessible',
        verification_result: false,
        error_message: error.message,
      });
    }

    return { verified: false, error: error.message };
  }
}

/**
 * Format citations for display
 */
export function formatCitationsForDisplay(
  citations: Citation[],
  style: 'inline' | 'footnote' | 'bibliography' = 'bibliography'
): string {
  if (style === 'bibliography') {
    return citations
      .map((c, i) => {
        const num = c.citation_key || `[${i + 1}]`;
        const title = c.source_title || 'Untitled';
        const domain = c.source_domain || extractDomain(c.source_url);
        const date = c.access_date ? new Date(c.access_date).toLocaleDateString() : '';
        return `${num} ${title}. ${domain}. Accessed ${date}. ${c.source_url}`;
      })
      .join('\n');
  }

  if (style === 'footnote') {
    return citations
      .map((c, i) => {
        const num = i + 1;
        return `^${num}. ${c.source_title || c.source_url}`;
      })
      .join('\n');
  }

  // Inline style - just return citation keys
  return citations.map(c => c.citation_key).join(', ');
}

/**
 * Get citations for a run
 */
export async function getCitationsForRun(
  supabase: SupabaseClient,
  runId: string
): Promise<{ citations: Citation[]; claims: Claim[] }> {
  const { data: citations, error: citationsError } = await supabase
    .from('source_citations')
    .select('*')
    .eq('run_id', runId)
    .order('created_at', { ascending: true });

  if (citationsError) {
    console.error('[citations] Failed to get citations:', citationsError);
    return { citations: [], claims: [] };
  }

  const { data: claims, error: claimsError } = await supabase
    .from('citation_claims')
    .select('*')
    .eq('run_id', runId)
    .order('position_in_output', { ascending: true });

  if (claimsError) {
    console.error('[citations] Failed to get claims:', claimsError);
    return { citations: citations || [], claims: [] };
  }

  return { citations: citations || [], claims: claims || [] };
}

/**
 * Inject citation markers into text based on sources
 */
export function injectCitationMarkers(
  text: string,
  citations: Citation[]
): string {
  let result = text;

  // Build a map of domain to citation key
  const domainToCitation = new Map<string, string>();
  for (const c of citations) {
    if (c.source_domain) {
      domainToCitation.set(c.source_domain, c.citation_key);
    }
  }

  // Find URLs in text and add citation markers
  const urlPattern = /https?:\/\/[^\s]+/g;
  result = result.replace(urlPattern, (url) => {
    const domain = extractDomain(url);
    const citationKey = domainToCitation.get(domain);
    if (citationKey) {
      return `${url} ${citationKey}`;
    }
    return url;
  });

  return result;
}

export default {
  extractCitationsFromResults,
  extractClaimsFromText,
  storeCitations,
  storeClaims,
  verifyCitationUrl,
  formatCitationsForDisplay,
  getCitationsForRun,
  injectCitationMarkers,
  calculateCredibility,
  createCitationKey,
  extractDomain,
};
