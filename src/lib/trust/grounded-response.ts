/**
 * Grounded Response System
 * Ensures AI responses are backed by verifiable sources
 * Critical for regulated industries: legal, healthcare, finance
 */

export type ConfidenceLevel = 'high' | 'medium' | 'low' | 'unverified';

export interface SourceCitation {
  id: string;
  documentId: string;
  documentName: string;
  pageNumber?: number;
  chunkIndex?: number;
  excerpt: string;
  relevanceScore: number;
  timestamp: number;
}

export interface GroundedClaim {
  claim: string;
  confidence: ConfidenceLevel;
  citations: SourceCitation[];
  verificationStatus: 'verified' | 'partial' | 'unverified' | 'conflicting';
  warnings?: string[];
}

export interface GroundedResponse {
  content: string;
  claims: GroundedClaim[];
  overallConfidence: ConfidenceLevel;
  sourcesUsed: SourceCitation[];
  warnings: string[];
  auditLog: AuditEntry[];
  metadata: {
    queryType: 'factual' | 'analytical' | 'creative' | 'conversational';
    domainDetected: string[];
    processingTime: number;
    modelUsed: string;
  };
}

export interface AuditEntry {
  timestamp: number;
  action: string;
  details: Record<string, unknown>;
}

/**
 * Query types that require strict grounding
 */
const FACTUAL_QUERY_PATTERNS = [
  // Legal
  /what (?:does|is) the law/i,
  /(?:case|statute|regulation|article|section) (?:\d|[A-Z])/i,
  /legal (?:requirement|obligation|precedent)/i,
  /court (?:held|ruled|decided)/i,
  
  // Medical/Healthcare
  /(?:dose|dosage|contraindication|interaction)/i,
  /(?:diagnosis|symptom|treatment|prognosis)/i,
  /clinical (?:trial|study|evidence)/i,
  /(?:FDA|EMA|WHO) (?:approved|guideline)/i,
  
  // Financial
  /(?:rate|return|yield|ratio) (?:is|was|of)/i,
  /(?:regulation|compliance|requirement)/i,
  /(?:tax|deduction|credit|exemption)/i,
  /(?:audit|reporting|disclosure)/i,
  
  // General factual
  /(?:what|when|where|who) (?:is|was|are|were)/i,
  /according to/i,
  /(?:study|research|data) (?:shows|suggests|indicates)/i,
  /(?:percentage|number|amount|figure)/i
];

/**
 * Hallucination warning patterns
 */
const HALLUCINATION_INDICATORS = [
  // Vague citations
  { pattern: /(?:studies show|research indicates|experts say)/i, warning: 'Vague attribution without specific source' },
  { pattern: /(?:it is well known|commonly believed|generally accepted)/i, warning: 'Appeal to common knowledge without verification' },
  { pattern: /(?:approximately|roughly|about) \d/i, warning: 'Imprecise numbers may indicate estimation' },
  
  // Fake-sounding citations
  { pattern: /(?:Smith v\.|Jones v\.|Doe v\.)/i, warning: 'Generic case name - verify this citation exists' },
  { pattern: /\d{4}\s*WL\s*\d+/i, warning: 'Westlaw citation format - verify authenticity' },
  { pattern: /\d+\s*U\.?S\.?\s*\d+/i, warning: 'US Reporter citation - verify case exists' },
  
  // Confidence red flags
  { pattern: /I believe|I think|probably|likely|might be/i, warning: 'AI expressing uncertainty - verify independently' },
  { pattern: /based on my (?:knowledge|training|understanding)/i, warning: 'AI referencing training data, not your documents' },
];

/**
 * Domain-specific verification rules
 */
const DOMAIN_RULES: Record<string, {
  requiresCitation: boolean;
  minimumConfidence: ConfidenceLevel;
  specialWarnings: string[];
}> = {
  legal: {
    requiresCitation: true,
    minimumConfidence: 'high',
    specialWarnings: [
      'Legal information is not legal advice. Consult a qualified attorney.',
      'Laws vary by jurisdiction. Verify applicability to your location.',
      'Regulations change frequently. Verify current status.'
    ]
  },
  medical: {
    requiresCitation: true,
    minimumConfidence: 'high',
    specialWarnings: [
      'Medical information is not medical advice. Consult a healthcare professional.',
      'Drug interactions and dosages must be verified by a pharmacist.',
      'Clinical guidelines may have been updated since document creation.'
    ]
  },
  financial: {
    requiresCitation: true,
    minimumConfidence: 'high',
    specialWarnings: [
      'Financial information is not financial advice. Consult a qualified advisor.',
      'Market conditions and regulations change. Verify current applicability.',
      'Tax implications vary by jurisdiction and individual circumstances.'
    ]
  },
  tax: {
    requiresCitation: true,
    minimumConfidence: 'high',
    specialWarnings: [
      'Tax laws change annually. Verify against current year regulations.',
      'Consult a tax professional for your specific situation.',
      'Deadlines and rates may vary by jurisdiction.'
    ]
  }
};

/**
 * Classify query type
 */
export function classifyQuery(query: string): {
  type: 'factual' | 'analytical' | 'creative' | 'conversational';
  domains: string[];
  requiresGrounding: boolean;
} {
  const isFactual = FACTUAL_QUERY_PATTERNS.some(p => p.test(query));
  
  // Detect domains
  const domains: string[] = [];
  if (/legal|law|court|statute|regulation|contract|litigation/i.test(query)) {
    domains.push('legal');
  }
  if (/medical|health|diagnosis|treatment|drug|patient|clinical/i.test(query)) {
    domains.push('medical');
  }
  if (/financial|investment|stock|bond|portfolio|market|return/i.test(query)) {
    domains.push('financial');
  }
  if (/tax|deduction|credit|irs|hmrc|filing|audit/i.test(query)) {
    domains.push('tax');
  }
  
  // Determine if grounding is required
  const requiresGrounding = isFactual || domains.length > 0;
  
  let type: 'factual' | 'analytical' | 'creative' | 'conversational' = 'conversational';
  if (isFactual) type = 'factual';
  else if (/analyze|compare|evaluate|assess/i.test(query)) type = 'analytical';
  else if (/write|create|draft|compose/i.test(query)) type = 'creative';
  
  return { type, domains, requiresGrounding };
}

/**
 * Check response for hallucination indicators
 */
export function detectHallucinationRisks(response: string): {
  warnings: string[];
  riskLevel: 'low' | 'medium' | 'high';
} {
  const warnings: string[] = [];
  
  for (const { pattern, warning } of HALLUCINATION_INDICATORS) {
    if (pattern.test(response)) {
      warnings.push(warning);
    }
  }
  
  // Check for suspiciously specific but unverifiable claims
  const specificNumbers = response.match(/\d+\.?\d*%|\$\d+|\d+ (?:million|billion|thousand)/gi) || [];
  if (specificNumbers.length > 3) {
    warnings.push('Multiple specific figures - verify each against source documents');
  }
  
  // Check for date claims
  const dateClaims = response.match(/(?:in|on|since|as of) (?:January|February|March|April|May|June|July|August|September|October|November|December|\d{4})/gi) || [];
  if (dateClaims.length > 0) {
    warnings.push('Date-specific claims should be verified against source documents');
  }
  
  let riskLevel: 'low' | 'medium' | 'high' = 'low';
  if (warnings.length >= 3) riskLevel = 'high';
  else if (warnings.length >= 1) riskLevel = 'medium';
  
  return { warnings, riskLevel };
}

/**
 * Calculate confidence based on source quality
 */
export function calculateConfidence(
  citations: SourceCitation[],
  queryType: string,
  domains: string[]
): ConfidenceLevel {
  if (citations.length === 0) return 'unverified';
  
  // Average relevance score
  const avgRelevance = citations.reduce((sum, c) => sum + c.relevanceScore, 0) / citations.length;
  
  // Check if we have high-quality sources
  const highQualitySources = citations.filter(c => c.relevanceScore > 0.8).length;
  
  // Domain-specific requirements
  const strictDomains = domains.filter(d => DOMAIN_RULES[d]?.minimumConfidence === 'high');
  
  if (highQualitySources >= 2 && avgRelevance > 0.75) {
    return 'high';
  } else if (highQualitySources >= 1 && avgRelevance > 0.6) {
    return strictDomains.length > 0 ? 'medium' : 'high';
  } else if (citations.length > 0 && avgRelevance > 0.4) {
    return 'medium';
  }
  
  return 'low';
}

/**
 * Generate grounding prompt for AI
 * This is injected into system prompt to enforce grounded responses
 */
export function generateGroundingPrompt(
  domains: string[],
  availableSources: { name: string; type: string }[]
): string {
  const domainWarnings = domains
    .map(d => DOMAIN_RULES[d]?.specialWarnings || [])
    .flat();
  
  return `
=== GROUNDED RESPONSE REQUIREMENTS ===

You are operating in GROUNDED MODE for regulated industry use. Follow these rules strictly:

1. CITATION REQUIREMENT:
   - Every factual claim MUST be supported by a citation from the user's documents
   - Format citations as: [Source: document_name, page/section if available]
   - If you cannot find a source for a claim, explicitly state "I could not find verification for this in your documents"

2. UNCERTAINTY DISCLOSURE:
   - If information is not in the provided documents, say "Based on general knowledge, not your documents: ..."
   - Never present unverified information as fact
   - Use phrases like "Your document states..." rather than definitive claims

3. NO HALLUCINATION:
   - Do NOT invent case names, statute numbers, or regulatory citations
   - Do NOT fabricate statistics, percentages, or specific numbers
   - Do NOT make up drug names, dosages, or medical claims
   - If asked about something not in the documents, say "I don't have information about this in your uploaded documents"

4. AVAILABLE SOURCES:
${availableSources.map(s => `   - ${s.name} (${s.type})`).join('\n')}

5. DOMAIN-SPECIFIC WARNINGS:
${domainWarnings.map(w => `   ⚠️ ${w}`).join('\n')}

6. RESPONSE FORMAT FOR FACTUAL QUERIES:
   - Start with the direct answer
   - Provide supporting citations
   - Note any limitations or caveats
   - Include relevant warnings for this domain

Remember: In regulated industries, a wrong answer is worse than "I don't know."

=== END GROUNDING REQUIREMENTS ===
`;
}

/**
 * Post-process AI response to add verification markers
 */
export function processResponseForVerification(
  response: string,
  citations: SourceCitation[],
  queryClassification: ReturnType<typeof classifyQuery>
): GroundedResponse {
  const auditLog: AuditEntry[] = [];
  const warnings: string[] = [];
  
  // Start audit
  auditLog.push({
    timestamp: Date.now(),
    action: 'response_processing_started',
    details: { queryType: queryClassification.type, domains: queryClassification.domains }
  });
  
  // Detect hallucination risks
  const hallucinationCheck = detectHallucinationRisks(response);
  warnings.push(...hallucinationCheck.warnings);
  
  auditLog.push({
    timestamp: Date.now(),
    action: 'hallucination_check',
    details: { riskLevel: hallucinationCheck.riskLevel, warningCount: hallucinationCheck.warnings.length }
  });
  
  // Add domain-specific warnings
  for (const domain of queryClassification.domains) {
    const domainRules = DOMAIN_RULES[domain];
    if (domainRules) {
      warnings.push(...domainRules.specialWarnings);
    }
  }
  
  // Calculate confidence
  const overallConfidence = calculateConfidence(
    citations,
    queryClassification.type,
    queryClassification.domains
  );
  
  auditLog.push({
    timestamp: Date.now(),
    action: 'confidence_calculated',
    details: { confidence: overallConfidence, citationCount: citations.length }
  });
  
  // Extract claims (simplified - in production, use NLP)
  const claims: GroundedClaim[] = [];
  const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 20);
  
  for (const sentence of sentences.slice(0, 10)) {
    const relevantCitations = citations.filter(c => 
      sentence.toLowerCase().includes(c.excerpt.toLowerCase().slice(0, 50))
    );
    
    claims.push({
      claim: sentence.trim(),
      confidence: relevantCitations.length > 0 ? 'high' : 'unverified',
      citations: relevantCitations,
      verificationStatus: relevantCitations.length > 0 ? 'verified' : 'unverified'
    });
  }
  
  auditLog.push({
    timestamp: Date.now(),
    action: 'response_processing_complete',
    details: { claimsExtracted: claims.length, warningsGenerated: warnings.length }
  });
  
  return {
    content: response,
    claims,
    overallConfidence,
    sourcesUsed: citations,
    warnings: [...new Set(warnings)],
    auditLog,
    metadata: {
      queryType: queryClassification.type,
      domainDetected: queryClassification.domains,
      processingTime: Date.now(),
      modelUsed: 'unknown'
    }
  };
}

/**
 * Generate "I don't know" response when appropriate
 */
export function generateUncertaintyResponse(
  query: string,
  searchResults: SourceCitation[],
  domains: string[]
): string | null {
  // If no relevant sources found for factual query
  if (searchResults.length === 0 || searchResults.every(r => r.relevanceScore < 0.3)) {
    const domainContext = domains.length > 0 
      ? ` in the ${domains.join('/')} domain` 
      : '';
    
    return `I don't have enough information in your uploaded documents to answer this question${domainContext} with confidence.

**What I searched:**
- Looked through your document library for relevant information
- Found no sufficiently relevant sources (relevance threshold: 30%)

**Recommendations:**
1. Upload relevant documents that might contain this information
2. Try rephrasing your question
3. For ${domains[0] || 'specialized'} questions, consult a qualified professional

**Why this matters:** In ${domains[0] || 'professional'} contexts, providing unverified information could lead to serious consequences. I'd rather admit uncertainty than risk giving you incorrect information.`;
  }
  
  return null;
}

/**
 * Get domain rules for a specific domain
 */
export function getDomainRules(domain: string) {
  return DOMAIN_RULES[domain] || null;
}
