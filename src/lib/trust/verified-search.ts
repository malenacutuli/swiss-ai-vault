/**
 * Verified Web Search System
 * Ensures web search results are from authoritative sources
 * For users without uploaded documents
 */

export type TrustLevel = 'authoritative' | 'reliable' | 'moderate' | 'low' | 'unknown';
export type SourceType = 'government' | 'academic' | 'medical' | 'legal' | 'news' | 'corporate' | 'wiki' | 'blog' | 'forum' | 'unknown';

export interface WebSource {
  url: string;
  domain: string;
  title: string;
  snippet: string;
  trustLevel: TrustLevel;
  sourceType: SourceType;
  trustScore: number;
  publishedDate?: string;
  author?: string;
  warnings?: string[];
}

export interface VerifiedClaim {
  claim: string;
  supportingSources: WebSource[];
  conflictingSources: WebSource[];
  confidence: 'high' | 'medium' | 'low' | 'contested';
}

export interface VerifiedSearchResult {
  query: string;
  answer: string;
  claims: VerifiedClaim[];
  sources: WebSource[];
  overallTrust: TrustLevel;
  methodology: string;
  searchTimestamp: number;
  warnings: string[];
}

/**
 * Domain trust database
 */
const AUTHORITATIVE_DOMAINS: Record<string, { trustScore: number; sourceType: SourceType; description: string }> = {
  // Government
  'gov': { trustScore: 0.95, sourceType: 'government', description: 'US Government' },
  'gov.uk': { trustScore: 0.95, sourceType: 'government', description: 'UK Government' },
  'admin.ch': { trustScore: 0.95, sourceType: 'government', description: 'Swiss Government' },
  'europa.eu': { trustScore: 0.95, sourceType: 'government', description: 'European Union' },
  'who.int': { trustScore: 0.95, sourceType: 'medical', description: 'World Health Organization' },
  
  // Academic
  'edu': { trustScore: 0.90, sourceType: 'academic', description: 'US Educational Institution' },
  'ac.uk': { trustScore: 0.90, sourceType: 'academic', description: 'UK Academic Institution' },
  'ethz.ch': { trustScore: 0.95, sourceType: 'academic', description: 'ETH Zurich' },
  'epfl.ch': { trustScore: 0.95, sourceType: 'academic', description: 'EPFL' },
  'mit.edu': { trustScore: 0.95, sourceType: 'academic', description: 'MIT' },
  'harvard.edu': { trustScore: 0.95, sourceType: 'academic', description: 'Harvard University' },
  'stanford.edu': { trustScore: 0.95, sourceType: 'academic', description: 'Stanford University' },
  'nature.com': { trustScore: 0.95, sourceType: 'academic', description: 'Nature Publishing' },
  'sciencedirect.com': { trustScore: 0.90, sourceType: 'academic', description: 'Elsevier' },
  'pubmed.ncbi.nlm.nih.gov': { trustScore: 0.95, sourceType: 'medical', description: 'PubMed' },
  
  // Medical
  'nih.gov': { trustScore: 0.95, sourceType: 'medical', description: 'National Institutes of Health' },
  'cdc.gov': { trustScore: 0.95, sourceType: 'medical', description: 'Centers for Disease Control' },
  'fda.gov': { trustScore: 0.95, sourceType: 'medical', description: 'Food and Drug Administration' },
  'mayoclinic.org': { trustScore: 0.90, sourceType: 'medical', description: 'Mayo Clinic' },
  'webmd.com': { trustScore: 0.70, sourceType: 'medical', description: 'WebMD (verify with primary sources)' },
  
  // Legal
  'law.cornell.edu': { trustScore: 0.95, sourceType: 'legal', description: 'Cornell Law School' },
  'uscourts.gov': { trustScore: 0.95, sourceType: 'legal', description: 'US Courts' },
  'supremecourt.gov': { trustScore: 0.95, sourceType: 'legal', description: 'US Supreme Court' },
  
  // News (major outlets)
  'reuters.com': { trustScore: 0.85, sourceType: 'news', description: 'Reuters' },
  'apnews.com': { trustScore: 0.85, sourceType: 'news', description: 'Associated Press' },
  'bbc.com': { trustScore: 0.85, sourceType: 'news', description: 'BBC' },
  'bbc.co.uk': { trustScore: 0.85, sourceType: 'news', description: 'BBC UK' },
  'swissinfo.ch': { trustScore: 0.85, sourceType: 'news', description: 'SwissInfo' },
  
  // Financial
  'sec.gov': { trustScore: 0.95, sourceType: 'government', description: 'SEC' },
  'finma.ch': { trustScore: 0.95, sourceType: 'government', description: 'Swiss FINMA' },
  
  // Reference
  'wikipedia.org': { trustScore: 0.70, sourceType: 'wiki', description: 'Wikipedia (verify citations)' },
  'britannica.com': { trustScore: 0.85, sourceType: 'academic', description: 'Encyclopedia Britannica' },
};

/**
 * Low-trust domain patterns
 */
const LOW_TRUST_PATTERNS = [
  /medium\.com/i,
  /blogspot\./i,
  /wordpress\.com/i,
  /quora\.com/i,
  /reddit\.com/i,
  /twitter\.com|x\.com/i,
  /facebook\.com/i,
  /linkedin\.com/i,
  /tiktok\.com/i,
  /youtube\.com/i, // Good for demos, not authoritative sources
];

/**
 * Analyze a web source for trust level
 */
export function analyzeSource(url: string, title: string, snippet: string): WebSource {
  const urlObj = new URL(url);
  const domain = urlObj.hostname.replace('www.', '');
  const warnings: string[] = [];
  
  // Check authoritative domains
  let trustScore = 0.50; // Default moderate
  let sourceType: SourceType = 'unknown';
  let trustLevel: TrustLevel = 'moderate';
  
  // Check TLD-based trust
  const tld = domain.split('.').pop() || '';
  if (AUTHORITATIVE_DOMAINS[tld]) {
    trustScore = AUTHORITATIVE_DOMAINS[tld].trustScore;
    sourceType = AUTHORITATIVE_DOMAINS[tld].sourceType;
  }
  
  // Check full domain match
  for (const [pattern, info] of Object.entries(AUTHORITATIVE_DOMAINS)) {
    if (domain.includes(pattern) || domain.endsWith(pattern)) {
      trustScore = Math.max(trustScore, info.trustScore);
      sourceType = info.sourceType;
      break;
    }
  }
  
  // Check low-trust patterns
  for (const pattern of LOW_TRUST_PATTERNS) {
    if (pattern.test(url)) {
      trustScore = Math.min(trustScore, 0.40);
      sourceType = 'blog';
      warnings.push('User-generated content - verify with authoritative sources');
      break;
    }
  }
  
  // Determine trust level
  if (trustScore >= 0.90) trustLevel = 'authoritative';
  else if (trustScore >= 0.75) trustLevel = 'reliable';
  else if (trustScore >= 0.50) trustLevel = 'moderate';
  else if (trustScore >= 0.30) trustLevel = 'low';
  else trustLevel = 'unknown';
  
  // Add warnings based on content
  if (snippet.toLowerCase().includes('opinion') || snippet.toLowerCase().includes('editorial')) {
    warnings.push('This may be an opinion piece, not factual reporting');
    trustScore *= 0.8;
  }
  
  if (snippet.toLowerCase().includes('sponsored') || snippet.toLowerCase().includes('advertisement')) {
    warnings.push('This content may be sponsored');
    trustScore *= 0.5;
  }
  
  return {
    url,
    domain,
    title,
    snippet,
    trustLevel,
    sourceType,
    trustScore,
    warnings: warnings.length > 0 ? warnings : undefined,
  };
}

/**
 * Domain-specific search strategies
 */
export const DOMAIN_SEARCH_STRATEGIES: Record<string, {
  prioritySites: string[];
  requiredSourceTypes: SourceType[];
  warningIfMissing: string;
}> = {
  medical: {
    prioritySites: ['*.gov', 'nih.gov', 'cdc.gov', 'who.int', 'pubmed.ncbi.nlm.nih.gov', 'mayoclinic.org'],
    requiredSourceTypes: ['government', 'medical', 'academic'],
    warningIfMissing: 'No authoritative medical sources found. Consult healthcare professionals.',
  },
  legal: {
    prioritySites: ['*.gov', 'law.cornell.edu', 'uscourts.gov', '*.edu'],
    requiredSourceTypes: ['government', 'legal', 'academic'],
    warningIfMissing: 'No authoritative legal sources found. Consult legal professionals.',
  },
  financial: {
    prioritySites: ['sec.gov', 'finma.ch', '*.gov', 'reuters.com'],
    requiredSourceTypes: ['government', 'news'],
    warningIfMissing: 'No authoritative financial sources found. Consult financial professionals.',
  },
  tax: {
    prioritySites: ['irs.gov', '*.gov', 'admin.ch'],
    requiredSourceTypes: ['government'],
    warningIfMissing: 'No official tax authority sources found. Consult tax professionals.',
  },
};

/**
 * Generate search queries targeting authoritative sources
 */
export function generateAuthoritySearchQueries(query: string, domain?: string): string[] {
  const queries: string[] = [query];
  
  // Add site-specific searches for high-trust domains
  if (domain && DOMAIN_SEARCH_STRATEGIES[domain]) {
    const strategy = DOMAIN_SEARCH_STRATEGIES[domain];
    for (const site of strategy.prioritySites.slice(0, 2)) {
      queries.push(`${query} site:${site.replace('*.', '')}`);
    }
  }
  
  // Add general authoritative source searches
  queries.push(`${query} site:gov OR site:edu`);
  
  return queries;
}

/**
 * Build verification prompt for AI
 */
export function buildVerificationPrompt(
  query: string,
  sources: WebSource[],
  hasUserDocuments: boolean
): string {
  const authoritativeSources = sources.filter(s => s.trustLevel === 'authoritative' || s.trustLevel === 'reliable');
  const moderateSources = sources.filter(s => s.trustLevel === 'moderate');
  const lowSources = sources.filter(s => s.trustLevel === 'low' || s.trustLevel === 'unknown');
  
  let prompt = `
=== VERIFIED SEARCH MODE ===

You are answering a query with web search results. Follow these rules strictly:

1. PRIORITIZE AUTHORITATIVE SOURCES:
${authoritativeSources.length > 0 
  ? authoritativeSources.map(s => `   - [${s.trustLevel.toUpperCase()}] ${s.domain}: "${s.title}"`).join('\n')
  : '   ⚠️ No highly authoritative sources found'}

2. USE WITH CAUTION (verify claims):
${moderateSources.length > 0 
  ? moderateSources.map(s => `   - [${s.sourceType}] ${s.domain}: "${s.title}"`).join('\n')
  : '   None'}

3. LOW TRUST (use only for context, not facts):
${lowSources.length > 0 
  ? lowSources.map(s => `   - [${s.sourceType}] ${s.domain}`).join('\n')
  : '   None'}

4. CITATION RULES:
   - Cite sources using [Source: domain.com] format
   - Prefer authoritative sources over others
   - If only low-trust sources available, clearly state this limitation
   - Never invent or fabricate source information

5. UNCERTAINTY DISCLOSURE:
   - If authoritative sources disagree, present both views
   - If only low-trust sources available, prefix response with disclaimer
   - State "I could not verify this claim" when appropriate

${!hasUserDocuments ? `
6. NO USER DOCUMENTS:
   - All information comes from web search only
   - Cannot reference user-uploaded documents
   - For regulated industries, recommend consulting professionals
` : ''}

=== END VERIFICATION RULES ===
`;

  return prompt;
}

/**
 * Calculate overall trust level for search results
 */
export function calculateOverallTrust(sources: WebSource[]): TrustLevel {
  if (sources.length === 0) return 'unknown';
  
  const avgTrust = sources.reduce((sum, s) => sum + s.trustScore, 0) / sources.length;
  const authoritativeCount = sources.filter(s => s.trustLevel === 'authoritative').length;
  
  if (authoritativeCount >= 2 && avgTrust >= 0.80) return 'authoritative';
  if (authoritativeCount >= 1 && avgTrust >= 0.70) return 'reliable';
  if (avgTrust >= 0.50) return 'moderate';
  if (avgTrust >= 0.30) return 'low';
  return 'unknown';
}

/**
 * Generate methodology explanation
 */
export function generateMethodology(sources: WebSource[], query: string): string {
  const sourceTypes = [...new Set(sources.map(s => s.sourceType))];
  const avgTrust = sources.length > 0 
    ? (sources.reduce((sum, s) => sum + s.trustScore, 0) / sources.length * 100).toFixed(0)
    : 0;
  
  return `Searched for "${query.slice(0, 50)}..." across ${sources.length} sources. ` +
    `Source types: ${sourceTypes.join(', ')}. ` +
    `Average trust score: ${avgTrust}%. ` +
    `${sources.filter(s => s.trustLevel === 'authoritative').length} authoritative sources identified.`;
}
