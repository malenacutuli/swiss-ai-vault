# Manus.im Parity Features Implementation Guide

**Document Type:** Implementation-Ready Technical Guide  
**Author:** Technical Lead  
**Target Audience:** Engineers building Manus-equivalent features  
**Scope:** Source Citations, Follow-up Questions, Workspace Tools, Custom Agents, Content Feed

---

## Table of Contents

1. [Source Citations and References](#1-source-citations-and-references)
2. [Follow-up Questions Generation](#2-follow-up-questions-generation)
3. [AI Docs - Document Generation](#3-ai-docs---document-generation)
4. [AI Slides - Presentation Creation](#4-ai-slides---presentation-creation)
5. [AI Sheets - Data Analysis](#5-ai-sheets---data-analysis)
6. [AI Image - Image Generation](#6-ai-image---image-generation)
7. [AI Video - Video Generation](#7-ai-video---video-generation)
8. [Custom Agent Creation Interface](#8-custom-agent-creation-interface)
9. [Content Feed and Personalization](#9-content-feed-and-personalization)

---

## 1. Source Citations and References

### 1.1 Core Philosophy

Every factual claim must be traceable to its source. Citations are not decorative — they're **trust infrastructure**.

### 1.2 Citation Data Model

```typescript
interface Citation {
  id: string;                        // Unique citation ID (e.g., "cite_abc123")
  index: number;                     // Display number [1], [2], etc.
  source: SourceReference;
  claim: string;                     // The specific claim being cited
  quote?: string;                    // Direct quote from source (if available)
  confidence: number;                // 0-1: How well does source support claim?
  verification_status: 'verified' | 'unverified' | 'disputed';
  accessed_at: number;               // When source was accessed
}

interface SourceReference {
  type: 'webpage' | 'pdf' | 'academic' | 'book' | 'api' | 'database';
  url?: string;
  title: string;
  author?: string;
  publication?: string;
  date?: string;                     // Publication date
  doi?: string;                      // For academic sources
  archive_url?: string;              // Wayback Machine or internal archive
  snippet: string;                   // Relevant excerpt
  full_content_hash?: string;        // For verification
}

interface CitationContext {
  document_id: string;
  citations: Citation[];
  citation_style: 'inline_numeric' | 'inline_author' | 'footnote' | 'endnote';
  bibliography: BibliographyEntry[];
}
```

### 1.3 Citation Extraction Pipeline

```typescript
async function extractAndAttachCitations(
  content: string,
  sources: Source[],
  context: ExecutionContext
): Promise<CitedContent> {
  // STEP 1: Identify factual claims
  const claims = await identifyFactualClaims(content);
  
  // STEP 2: Match claims to sources
  const citationMatches = await matchClaimsToSources(claims, sources);
  
  // STEP 3: Verify matches
  const verifiedCitations = await verifyCitations(citationMatches);
  
  // STEP 4: Insert citation markers
  const citedContent = insertCitationMarkers(content, verifiedCitations);
  
  // STEP 5: Generate bibliography
  const bibliography = generateBibliography(verifiedCitations);
  
  return {
    content: citedContent,
    citations: verifiedCitations,
    bibliography,
    uncited_claims: claims.filter(c => !citationMatches.has(c.id))
  };
}
```

### 1.4 Factual Claim Identification

```typescript
interface FactualClaim {
  id: string;
  text: string;
  start_offset: number;
  end_offset: number;
  claim_type: 'statistic' | 'quote' | 'fact' | 'definition' | 'attribution';
  requires_citation: boolean;
  citation_priority: 'required' | 'recommended' | 'optional';
}

async function identifyFactualClaims(content: string): Promise<FactualClaim[]> {
  // HEURISTIC DETECTION (fast, no LLM)
  const heuristicClaims: FactualClaim[] = [];
  
  // Pattern 1: Statistics and numbers
  const statPattern = /(\d+(?:\.\d+)?%|\$[\d,]+(?:\.\d+)?|\d+(?:,\d{3})*(?:\.\d+)?)\s+(?:of|in|by|per|increase|decrease|growth|decline)/gi;
  let match;
  while ((match = statPattern.exec(content)) !== null) {
    heuristicClaims.push({
      id: `claim_${match.index}`,
      text: extractSentence(content, match.index),
      start_offset: match.index,
      end_offset: match.index + match[0].length,
      claim_type: 'statistic',
      requires_citation: true,
      citation_priority: 'required'
    });
  }
  
  // Pattern 2: Attribution phrases
  const attrPattern = /(?:according to|as reported by|research shows|studies indicate|experts say)/gi;
  while ((match = attrPattern.exec(content)) !== null) {
    heuristicClaims.push({
      id: `claim_${match.index}`,
      text: extractSentence(content, match.index),
      start_offset: match.index,
      end_offset: match.index + match[0].length,
      claim_type: 'attribution',
      requires_citation: true,
      citation_priority: 'required'
    });
  }
  
  // Pattern 3: Definitive statements
  const definitivePattern = /(?:is the|was the|are the|were the)\s+(?:first|largest|smallest|most|least|only|best|worst)/gi;
  while ((match = definitivePattern.exec(content)) !== null) {
    heuristicClaims.push({
      id: `claim_${match.index}`,
      text: extractSentence(content, match.index),
      start_offset: match.index,
      end_offset: match.index + match[0].length,
      claim_type: 'fact',
      requires_citation: true,
      citation_priority: 'required'
    });
  }
  
  // LLM REFINEMENT (for ambiguous cases)
  const llmClaims = await refineClaims(content, heuristicClaims);
  
  return deduplicateClaims([...heuristicClaims, ...llmClaims]);
}
```

### 1.5 Claim-to-Source Matching

```typescript
async function matchClaimsToSources(
  claims: FactualClaim[],
  sources: Source[]
): Promise<Map<string, CitationMatch>> {
  const matches = new Map<string, CitationMatch>();
  
  for (const claim of claims) {
    // Find best matching source
    const candidates = await Promise.all(
      sources.map(async (source) => ({
        source,
        similarity: await computeSemanticSimilarity(claim.text, source.content),
        quote_match: findExactQuote(claim.text, source.content)
      }))
    );
    
    // Sort by match quality
    candidates.sort((a, b) => {
      // Prefer exact quotes
      if (a.quote_match && !b.quote_match) return -1;
      if (!a.quote_match && b.quote_match) return 1;
      return b.similarity - a.similarity;
    });
    
    const best = candidates[0];
    
    // THRESHOLD: Only accept if similarity > 0.6 or exact quote found
    if (best.similarity > 0.6 || best.quote_match) {
      matches.set(claim.id, {
        claim,
        source: best.source,
        confidence: best.quote_match ? 0.95 : best.similarity,
        quote: best.quote_match?.text
      });
    }
  }
  
  return matches;
}
```

### 1.6 Citation Insertion

```typescript
function insertCitationMarkers(
  content: string,
  citations: Citation[]
): string {
  // Sort by offset (descending) to insert from end to start
  const sorted = [...citations].sort((a, b) => b.claim_offset - a.claim_offset);
  
  let result = content;
  for (const citation of sorted) {
    // Find end of sentence containing the claim
    const sentenceEnd = findSentenceEnd(result, citation.claim_offset);
    
    // Insert citation marker
    const marker = `[${citation.index}]`;
    result = result.slice(0, sentenceEnd) + marker + result.slice(sentenceEnd);
  }
  
  return result;
}

function generateBibliography(citations: Citation[]): string {
  const entries = citations.map((c, i) => {
    const s = c.source;
    
    // Format based on source type
    switch (s.type) {
      case 'webpage':
        return `[${i + 1}] ${s.author || 'Unknown'}. "${s.title}." ${s.publication || extractDomain(s.url)}. ${s.date || 'n.d.'}. ${s.url}`;
      
      case 'academic':
        return `[${i + 1}] ${s.author}. "${s.title}." ${s.publication}, ${s.date}. DOI: ${s.doi}`;
      
      case 'book':
        return `[${i + 1}] ${s.author}. *${s.title}*. ${s.publication}, ${s.date}.`;
      
      default:
        return `[${i + 1}] ${s.title}. ${s.url || s.publication || 'Source unavailable'}`;
    }
  });
  
  return '## References\n\n' + entries.join('\n\n');
}
```

### 1.7 Citation Verification

```typescript
interface VerificationResult {
  citation: Citation;
  status: 'verified' | 'unverified' | 'disputed' | 'source_unavailable';
  issues: VerificationIssue[];
}

async function verifyCitation(citation: Citation): Promise<VerificationResult> {
  const issues: VerificationIssue[] = [];
  
  // CHECK 1: Source still accessible
  if (citation.source.url) {
    const accessible = await checkUrlAccessible(citation.source.url);
    if (!accessible) {
      issues.push({
        type: 'source_unavailable',
        severity: 'high',
        message: 'Original source URL is no longer accessible'
      });
      
      // Try archive
      const archiveUrl = await findArchiveUrl(citation.source.url);
      if (archiveUrl) {
        citation.source.archive_url = archiveUrl;
      }
    }
  }
  
  // CHECK 2: Content still matches
  if (citation.source.full_content_hash) {
    const currentContent = await fetchContent(citation.source.url);
    const currentHash = hashContent(currentContent);
    if (currentHash !== citation.source.full_content_hash) {
      issues.push({
        type: 'content_changed',
        severity: 'medium',
        message: 'Source content has changed since citation was created'
      });
    }
  }
  
  // CHECK 3: Quote verification
  if (citation.quote) {
    const currentContent = await fetchContent(citation.source.url);
    if (!currentContent.includes(citation.quote)) {
      issues.push({
        type: 'quote_not_found',
        severity: 'high',
        message: 'Cited quote not found in current source content'
      });
    }
  }
  
  // Determine status
  const highSeverityIssues = issues.filter(i => i.severity === 'high');
  const status = highSeverityIssues.length > 0 ? 'disputed' :
                 issues.length > 0 ? 'unverified' : 'verified';
  
  return { citation, status, issues };
}
```

### 1.8 What NOT To Do

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Cite everything** | Noise, slows reading | Only cite factual claims |
| **Broken links** | Erodes trust | Archive sources, check links |
| **Mismatched citations** | Claim doesn't match source | Verify semantic similarity |
| **Citation at paragraph end** | Unclear what's cited | Cite at sentence level |
| **No quote extraction** | Can't verify claim | Include relevant quote |
| **Trusting LLM citations** | LLM hallucinates sources | Always verify URL exists |

---

## 2. Follow-up Questions Generation

### 2.1 Core Philosophy

Follow-up questions should **anticipate user intent**, not just generate related queries. The goal is to save the user from having to think "what should I ask next?"

### 2.2 Follow-up Question Types

```typescript
type FollowUpType =
  | 'clarification'      // "Did you mean X or Y?"
  | 'depth'              // "Want more details on X?"
  | 'breadth'            // "Related topic: Y"
  | 'application'        // "How to apply this to Z?"
  | 'comparison'         // "How does this compare to W?"
  | 'timeline'           // "What happened before/after?"
  | 'source'             // "Where can I learn more?"
  | 'action'             // "What should I do next?"
  | 'counterpoint';      // "What are the opposing views?"

interface FollowUpQuestion {
  id: string;
  type: FollowUpType;
  question: string;
  context: string;                   // Why this question is relevant
  priority: number;                  // 1-10
  estimated_value: number;           // How useful is this likely to be?
  triggers_new_research: boolean;
}
```

### 2.3 Follow-up Generation Algorithm

```typescript
async function generateFollowUpQuestions(
  response: AgentResponse,
  conversation_history: Message[],
  user_profile: UserProfile
): Promise<FollowUpQuestion[]> {
  // STEP 1: Analyze response for follow-up opportunities
  const opportunities = await identifyFollowUpOpportunities(response);
  
  // STEP 2: Generate candidate questions
  const candidates = await generateCandidates(opportunities, conversation_history);
  
  // STEP 3: Filter and rank
  const ranked = rankFollowUps(candidates, user_profile, conversation_history);
  
  // STEP 4: Deduplicate and select top N
  const selected = selectTopFollowUps(ranked, { max: 4, diversity_threshold: 0.7 });
  
  return selected;
}

async function identifyFollowUpOpportunities(
  response: AgentResponse
): Promise<FollowUpOpportunity[]> {
  const opportunities: FollowUpOpportunity[] = [];
  
  // OPPORTUNITY 1: Unexplained terms
  const technicalTerms = extractTechnicalTerms(response.content);
  for (const term of technicalTerms) {
    if (!isExplainedInContext(term, response.content)) {
      opportunities.push({
        type: 'clarification',
        trigger: term,
        question_template: `What exactly is ${term}?`
      });
    }
  }
  
  // OPPORTUNITY 2: Summarized sections
  const summaries = detectSummarizedContent(response.content);
  for (const summary of summaries) {
    opportunities.push({
      type: 'depth',
      trigger: summary.topic,
      question_template: `Can you explain ${summary.topic} in more detail?`
    });
  }
  
  // OPPORTUNITY 3: Mentioned but not explored
  const mentionedTopics = extractMentionedTopics(response.content);
  for (const topic of mentionedTopics) {
    if (!isExploredInDepth(topic, response.content)) {
      opportunities.push({
        type: 'breadth',
        trigger: topic,
        question_template: `Tell me more about ${topic}`
      });
    }
  }
  
  // OPPORTUNITY 4: Actionable content
  if (response.contains_recommendations) {
    opportunities.push({
      type: 'action',
      trigger: 'recommendations',
      question_template: 'How do I implement these recommendations?'
    });
  }
  
  // OPPORTUNITY 5: Controversial or debated topics
  const controversialClaims = detectControversialClaims(response.content);
  for (const claim of controversialClaims) {
    opportunities.push({
      type: 'counterpoint',
      trigger: claim,
      question_template: `What are the counterarguments to ${claim}?`
    });
  }
  
  return opportunities;
}
```

### 2.4 Question Ranking

```typescript
function rankFollowUps(
  candidates: FollowUpQuestion[],
  user_profile: UserProfile,
  history: Message[]
): FollowUpQuestion[] {
  return candidates.map(q => ({
    ...q,
    priority: calculatePriority(q, user_profile, history)
  })).sort((a, b) => b.priority - a.priority);
}

function calculatePriority(
  question: FollowUpQuestion,
  user: UserProfile,
  history: Message[]
): number {
  let score = 5; // Base score
  
  // BOOST: Matches user's typical interests
  if (matchesUserInterests(question, user)) {
    score += 2;
  }
  
  // BOOST: Fills a gap in the conversation
  if (fillsConversationGap(question, history)) {
    score += 2;
  }
  
  // BOOST: High-value question types
  const typeBoosts: Record<FollowUpType, number> = {
    'action': 2,           // Users often want to know "what next"
    'application': 1.5,    // Practical application is valuable
    'clarification': 1,    // Helps understanding
    'depth': 0.5,          // Good but can be verbose
    'breadth': 0,          // Neutral
    'comparison': 0.5,
    'timeline': 0,
    'source': -0.5,        // Less commonly wanted
    'counterpoint': 1      // Shows balanced thinking
  };
  score += typeBoosts[question.type] || 0;
  
  // PENALIZE: Already asked similar question
  if (similarQuestionAsked(question, history)) {
    score -= 3;
  }
  
  // PENALIZE: Too long/complex
  if (question.question.length > 100) {
    score -= 1;
  }
  
  return Math.max(0, Math.min(10, score));
}
```

### 2.5 Diversity Selection

```typescript
function selectTopFollowUps(
  ranked: FollowUpQuestion[],
  config: { max: number; diversity_threshold: number }
): FollowUpQuestion[] {
  const selected: FollowUpQuestion[] = [];
  const usedTypes = new Set<FollowUpType>();
  
  for (const question of ranked) {
    if (selected.length >= config.max) break;
    
    // Check diversity: Don't select too many of same type
    if (usedTypes.has(question.type) && selected.length >= 2) {
      // Allow max 2 of same type
      const sameTypeCount = selected.filter(q => q.type === question.type).length;
      if (sameTypeCount >= 2) continue;
    }
    
    // Check semantic diversity
    const tooSimilar = selected.some(q => 
      computeQuestionSimilarity(q.question, question.question) > config.diversity_threshold
    );
    if (tooSimilar) continue;
    
    selected.push(question);
    usedTypes.add(question.type);
  }
  
  return selected;
}
```

### 2.6 UI Integration

```typescript
interface FollowUpDisplay {
  questions: FollowUpQuestion[];
  display_mode: 'chips' | 'list' | 'inline';
  position: 'after_response' | 'sidebar' | 'floating';
}

function formatFollowUpsForUI(
  questions: FollowUpQuestion[],
  context: UIContext
): FollowUpDisplay {
  // SHORT QUESTIONS: Display as chips
  if (questions.every(q => q.question.length < 50)) {
    return {
      questions,
      display_mode: 'chips',
      position: 'after_response'
    };
  }
  
  // LONGER QUESTIONS: Display as list
  return {
    questions,
    display_mode: 'list',
    position: 'after_response'
  };
}
```

### 2.7 What NOT To Do

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Generic questions** | "Tell me more" is useless | Be specific to content |
| **Too many questions** | Overwhelms user | Max 4, usually 3 |
| **Repeating user's question** | Annoying | Check conversation history |
| **All same type** | Lacks diversity | Mix depth, breadth, action |
| **Questions user can't answer** | Frustrating | Questions should be askable |
| **Ignoring user profile** | Misses interests | Personalize to user |

---

## 3. AI Docs - Document Generation

### 3.1 Core Philosophy

Document generation is not "write text and format it." It's **structured content creation** with semantic understanding of document types, audience, and purpose.

### 3.2 Document Generation Pipeline

```typescript
interface DocumentRequest {
  type: 'report' | 'proposal' | 'memo' | 'article' | 'manual' | 'letter' | 'contract';
  title: string;
  purpose: string;
  audience: AudienceProfile;
  tone: 'formal' | 'professional' | 'casual' | 'technical';
  length: 'brief' | 'standard' | 'comprehensive';
  outline?: DocumentOutline;
  source_materials?: SourceMaterial[];
  template_id?: string;
  output_format: 'docx' | 'pdf' | 'markdown' | 'html';
}

interface GeneratedDocument {
  id: string;
  content: DocumentContent;
  metadata: DocumentMetadata;
  download_url: string;
  preview_url: string;
  edit_url: string;
}

async function generateDocument(request: DocumentRequest): Promise<GeneratedDocument> {
  // PHASE 1: Structure planning
  const structure = await planDocumentStructure(request);
  
  // PHASE 2: Content generation
  const content = await generateDocumentContent(structure, request);
  
  // PHASE 3: Styling and formatting
  const styled = await applyDocumentStyling(content, request);
  
  // PHASE 4: Quality checks
  const validated = await validateDocument(styled, request);
  
  // PHASE 5: Export
  const exported = await exportDocument(validated, request.output_format);
  
  return exported;
}
```

### 3.3 Document Structure Planning

```typescript
interface DocumentStructure {
  sections: Section[];
  estimated_word_count: number;
  reading_time_minutes: number;
}

interface Section {
  id: string;
  title: string;
  level: number;                     // 1 = H1, 2 = H2, etc.
  purpose: string;                   // Why this section exists
  content_type: 'prose' | 'list' | 'table' | 'figure' | 'mixed';
  estimated_words: number;
  subsections?: Section[];
  required: boolean;
}

async function planDocumentStructure(request: DocumentRequest): Promise<DocumentStructure> {
  // Get template structure if specified
  if (request.template_id) {
    return await getTemplateStructure(request.template_id);
  }
  
  // Use document type defaults
  const typeStructures: Record<DocumentRequest['type'], Section[]> = {
    'report': [
      { id: 'exec_summary', title: 'Executive Summary', level: 1, purpose: 'Key findings for busy readers', content_type: 'prose', estimated_words: 200, required: true },
      { id: 'intro', title: 'Introduction', level: 1, purpose: 'Context and objectives', content_type: 'prose', estimated_words: 300, required: true },
      { id: 'methodology', title: 'Methodology', level: 1, purpose: 'How research was conducted', content_type: 'mixed', estimated_words: 400, required: false },
      { id: 'findings', title: 'Findings', level: 1, purpose: 'Main content', content_type: 'mixed', estimated_words: 1000, required: true },
      { id: 'analysis', title: 'Analysis', level: 1, purpose: 'Interpretation of findings', content_type: 'prose', estimated_words: 500, required: true },
      { id: 'recommendations', title: 'Recommendations', level: 1, purpose: 'Actionable next steps', content_type: 'list', estimated_words: 300, required: true },
      { id: 'conclusion', title: 'Conclusion', level: 1, purpose: 'Summary and closing', content_type: 'prose', estimated_words: 200, required: true },
      { id: 'appendix', title: 'Appendix', level: 1, purpose: 'Supporting materials', content_type: 'mixed', estimated_words: 0, required: false }
    ],
    'proposal': [
      { id: 'cover', title: 'Cover Letter', level: 1, purpose: 'Introduction and hook', content_type: 'prose', estimated_words: 150, required: true },
      { id: 'problem', title: 'Problem Statement', level: 1, purpose: 'Define the challenge', content_type: 'prose', estimated_words: 300, required: true },
      { id: 'solution', title: 'Proposed Solution', level: 1, purpose: 'Your approach', content_type: 'mixed', estimated_words: 500, required: true },
      { id: 'timeline', title: 'Timeline', level: 1, purpose: 'Project schedule', content_type: 'table', estimated_words: 200, required: true },
      { id: 'budget', title: 'Budget', level: 1, purpose: 'Cost breakdown', content_type: 'table', estimated_words: 200, required: true },
      { id: 'team', title: 'Team', level: 1, purpose: 'Who will deliver', content_type: 'mixed', estimated_words: 200, required: false },
      { id: 'next_steps', title: 'Next Steps', level: 1, purpose: 'Call to action', content_type: 'list', estimated_words: 100, required: true }
    ],
    // ... other document types
  };
  
  const baseStructure = typeStructures[request.type] || typeStructures['report'];
  
  // Adjust based on length preference
  const lengthMultipliers = { brief: 0.5, standard: 1, comprehensive: 1.5 };
  const multiplier = lengthMultipliers[request.length];
  
  return {
    sections: baseStructure.map(s => ({
      ...s,
      estimated_words: Math.round(s.estimated_words * multiplier)
    })),
    estimated_word_count: baseStructure.reduce((acc, s) => acc + s.estimated_words, 0) * multiplier,
    reading_time_minutes: Math.ceil((baseStructure.reduce((acc, s) => acc + s.estimated_words, 0) * multiplier) / 200)
  };
}
```

### 3.4 Content Generation

```typescript
async function generateDocumentContent(
  structure: DocumentStructure,
  request: DocumentRequest
): Promise<DocumentContent> {
  const sections: GeneratedSection[] = [];
  
  for (const section of structure.sections) {
    if (!section.required && request.length === 'brief') {
      continue; // Skip optional sections for brief documents
    }
    
    const sectionContent = await generateSectionContent(section, request, sections);
    sections.push(sectionContent);
  }
  
  return {
    title: request.title,
    sections,
    metadata: {
      generated_at: Date.now(),
      word_count: sections.reduce((acc, s) => acc + countWords(s.content), 0),
      document_type: request.type
    }
  };
}

async function generateSectionContent(
  section: Section,
  request: DocumentRequest,
  previousSections: GeneratedSection[]
): Promise<GeneratedSection> {
  // Build context from previous sections
  const context = previousSections.map(s => `${s.title}: ${summarize(s.content, 100)}`).join('\n');
  
  // Generate content based on content type
  let content: string;
  
  switch (section.content_type) {
    case 'prose':
      content = await generateProse(section, request, context);
      break;
    case 'list':
      content = await generateList(section, request, context);
      break;
    case 'table':
      content = await generateTable(section, request, context);
      break;
    case 'figure':
      content = await generateFigurePlaceholder(section, request);
      break;
    case 'mixed':
      content = await generateMixedContent(section, request, context);
      break;
  }
  
  return {
    id: section.id,
    title: section.title,
    level: section.level,
    content,
    word_count: countWords(content)
  };
}

async function generateProse(
  section: Section,
  request: DocumentRequest,
  context: string
): Promise<string> {
  const prompt = `
    Write the "${section.title}" section for a ${request.type}.
    
    Purpose: ${section.purpose}
    Target word count: ${section.estimated_words}
    Tone: ${request.tone}
    Audience: ${request.audience.description}
    
    Document context:
    ${context}
    
    ${request.source_materials ? `Source materials:\n${summarizeSources(request.source_materials)}` : ''}
    
    Write clear, well-structured prose. Use paragraphs, not bullet points unless absolutely necessary.
  `;
  
  const response = await invokeLLM({
    messages: [
      { role: 'system', content: `You are a professional ${request.type} writer. Write in ${request.tone} tone.` },
      { role: 'user', content: prompt }
    ],
    max_tokens: section.estimated_words * 2 // Allow some buffer
  });
  
  return response.choices[0].message.content;
}
```

### 3.5 Document Styling

```typescript
interface DocumentStyle {
  font_family: string;
  font_size: number;
  heading_styles: HeadingStyle[];
  colors: ColorPalette;
  margins: Margins;
  line_spacing: number;
  paragraph_spacing: number;
}

async function applyDocumentStyling(
  content: DocumentContent,
  request: DocumentRequest
): Promise<StyledDocument> {
  // Get style based on document type and tone
  const style = getDocumentStyle(request.type, request.tone);
  
  // Apply styling to each section
  const styledSections = content.sections.map(section => ({
    ...section,
    formatted_content: formatContent(section.content, style, section.level)
  }));
  
  // Add header/footer
  const header = generateHeader(request, style);
  const footer = generateFooter(request, style);
  
  // Add table of contents if needed
  const toc = content.sections.length > 5 ? generateTableOfContents(styledSections) : null;
  
  return {
    ...content,
    sections: styledSections,
    style,
    header,
    footer,
    table_of_contents: toc
  };
}

function getDocumentStyle(type: string, tone: string): DocumentStyle {
  const styles: Record<string, DocumentStyle> = {
    'formal_report': {
      font_family: 'Times New Roman',
      font_size: 12,
      heading_styles: [
        { level: 1, font_size: 18, bold: true, color: '#000000' },
        { level: 2, font_size: 14, bold: true, color: '#333333' },
        { level: 3, font_size: 12, bold: true, color: '#333333' }
      ],
      colors: { primary: '#1a1a1a', secondary: '#666666', accent: '#0066cc' },
      margins: { top: 72, right: 72, bottom: 72, left: 72 }, // points
      line_spacing: 1.5,
      paragraph_spacing: 12
    },
    'professional_proposal': {
      font_family: 'Calibri',
      font_size: 11,
      heading_styles: [
        { level: 1, font_size: 16, bold: true, color: '#2c3e50' },
        { level: 2, font_size: 13, bold: true, color: '#34495e' },
        { level: 3, font_size: 11, bold: true, color: '#34495e' }
      ],
      colors: { primary: '#2c3e50', secondary: '#7f8c8d', accent: '#3498db' },
      margins: { top: 54, right: 54, bottom: 54, left: 54 },
      line_spacing: 1.15,
      paragraph_spacing: 8
    },
    // ... other styles
  };
  
  const key = `${tone}_${type}`;
  return styles[key] || styles['professional_report'];
}
```

### 3.6 Export to Formats

```typescript
async function exportDocument(
  document: StyledDocument,
  format: 'docx' | 'pdf' | 'markdown' | 'html'
): Promise<ExportedDocument> {
  switch (format) {
    case 'docx':
      return await exportToDocx(document);
    case 'pdf':
      return await exportToPdf(document);
    case 'markdown':
      return await exportToMarkdown(document);
    case 'html':
      return await exportToHtml(document);
  }
}

async function exportToDocx(document: StyledDocument): Promise<ExportedDocument> {
  // Use python-docx via shell
  const docxScript = `
import json
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc_data = json.loads('''${JSON.stringify(document)}''')

doc = Document()

# Apply styles
style = doc.styles['Normal']
style.font.name = '${document.style.font_family}'
style.font.size = Pt(${document.style.font_size})

# Add content
for section in doc_data['sections']:
    # Add heading
    doc.add_heading(section['title'], level=section['level'])
    
    # Add content
    for paragraph in section['formatted_content'].split('\\n\\n'):
        if paragraph.strip():
            doc.add_paragraph(paragraph.strip())

# Save
doc.save('/tmp/output.docx')
print('/tmp/output.docx')
  `;
  
  const result = await executePython(docxScript);
  const filePath = result.stdout.trim();
  
  // Upload to S3
  const { url } = await storagePut(`documents/${document.id}.docx`, await readFile(filePath), 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  
  return {
    id: document.id,
    format: 'docx',
    download_url: url,
    size_bytes: (await stat(filePath)).size
  };
}
```

### 3.7 What NOT To Do

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Ignoring document type** | Report ≠ Proposal ≠ Memo | Use type-specific structures |
| **Wall of text** | Unreadable | Use headings, paragraphs, lists |
| **Inconsistent styling** | Unprofessional | Lock in style before content |
| **No executive summary** | Busy readers skip | Always include for long docs |
| **Generic content** | Doesn't fit audience | Tailor to audience profile |
| **No quality check** | Errors slip through | Validate before export |

---

## 4. AI Slides - Presentation Creation

### 4.1 Core Philosophy

Slides are not documents. They're **visual aids for a speaker**. Less text, more impact.

### 4.2 Slide Generation Pipeline

```typescript
interface SlideRequest {
  topic: string;
  purpose: 'inform' | 'persuade' | 'teach' | 'pitch';
  audience: AudienceProfile;
  duration_minutes: number;
  style: 'minimal' | 'corporate' | 'creative' | 'academic';
  include_speaker_notes: boolean;
  source_content?: string;           // Content to convert to slides
  template_id?: string;
}

interface GeneratedPresentation {
  id: string;
  slides: Slide[];
  theme: PresentationTheme;
  speaker_notes: SpeakerNote[];
  download_url: string;
  preview_url: string;
}

async function generatePresentation(request: SlideRequest): Promise<GeneratedPresentation> {
  // PHASE 1: Narrative construction (from Part 8)
  const narrative = await constructNarrative(request);
  
  // PHASE 2: Slide planning
  const slideOutline = await planSlides(narrative, request);
  
  // PHASE 3: Content generation
  const slides = await generateSlideContent(slideOutline, request);
  
  // PHASE 4: Visual design
  const designedSlides = await applySlideDesign(slides, request);
  
  // PHASE 5: Speaker notes
  const withNotes = request.include_speaker_notes 
    ? await generateSpeakerNotes(designedSlides, narrative)
    : designedSlides;
  
  // PHASE 6: Export
  return await exportPresentation(withNotes, request);
}
```

### 4.3 Slide Content Rules

```typescript
interface SlideContentRules {
  max_title_words: number;
  max_bullet_points: number;
  max_words_per_bullet: number;
  max_total_words: number;
  require_visual: boolean;
}

const SLIDE_CONTENT_RULES: Record<string, SlideContentRules> = {
  'title': {
    max_title_words: 8,
    max_bullet_points: 0,
    max_words_per_bullet: 0,
    max_total_words: 15,
    require_visual: false
  },
  'content': {
    max_title_words: 8,
    max_bullet_points: 4,
    max_words_per_bullet: 8,
    max_total_words: 50,
    require_visual: false
  },
  'single_stat': {
    max_title_words: 5,
    max_bullet_points: 0,
    max_words_per_bullet: 0,
    max_total_words: 20,
    require_visual: true  // The stat IS the visual
  },
  'comparison': {
    max_title_words: 6,
    max_bullet_points: 0,
    max_words_per_bullet: 0,
    max_total_words: 30,
    require_visual: true  // Chart required
  },
  'quote': {
    max_title_words: 0,
    max_bullet_points: 0,
    max_words_per_bullet: 0,
    max_total_words: 30,
    require_visual: false
  },
  'image': {
    max_title_words: 5,
    max_bullet_points: 0,
    max_words_per_bullet: 0,
    max_total_words: 10,
    require_visual: true
  }
};

function validateSlideContent(slide: Slide): ValidationResult {
  const rules = SLIDE_CONTENT_RULES[slide.type] || SLIDE_CONTENT_RULES['content'];
  const issues: string[] = [];
  
  // Check title length
  const titleWords = countWords(slide.title);
  if (titleWords > rules.max_title_words) {
    issues.push(`Title too long: ${titleWords} words (max ${rules.max_title_words})`);
  }
  
  // Check bullet points
  if (slide.bullets && slide.bullets.length > rules.max_bullet_points) {
    issues.push(`Too many bullets: ${slide.bullets.length} (max ${rules.max_bullet_points})`);
  }
  
  // Check words per bullet
  if (slide.bullets) {
    for (const bullet of slide.bullets) {
      const bulletWords = countWords(bullet);
      if (bulletWords > rules.max_words_per_bullet) {
        issues.push(`Bullet too long: "${bullet.slice(0, 20)}..." (${bulletWords} words, max ${rules.max_words_per_bullet})`);
      }
    }
  }
  
  // Check total words
  const totalWords = countTotalWords(slide);
  if (totalWords > rules.max_total_words) {
    issues.push(`Slide too wordy: ${totalWords} words (max ${rules.max_total_words})`);
  }
  
  // Check visual requirement
  if (rules.require_visual && !slide.visual) {
    issues.push(`Slide type "${slide.type}" requires a visual element`);
  }
  
  return {
    valid: issues.length === 0,
    issues
  };
}
```

### 4.4 Slide Type Selection

```typescript
function selectSlideType(
  narrativeElement: NarrativeElement,
  position: number,
  totalSlides: number
): SlideType {
  // TITLE SLIDE: Always first
  if (position === 0) {
    return 'title';
  }
  
  // THANK YOU / CTA: Always last
  if (position === totalSlides - 1) {
    return 'cta';
  }
  
  // Based on narrative element type
  switch (narrativeElement.type) {
    case 'hook':
      // Hooks work best as single stats or provocative questions
      if (narrativeElement.supporting_data?.length === 1) {
        return 'single_stat';
      }
      return 'quote';
    
    case 'context':
      return 'content';
    
    case 'tension':
      return 'comparison';
    
    case 'journey':
      // Vary journey slides for visual interest
      if (narrativeElement.supporting_data?.length > 2) {
        return 'chart';
      }
      if (narrativeElement.visual_suggestion === 'image') {
        return 'image';
      }
      return 'content';
    
    case 'resolution':
      return 'single_stat';
    
    case 'cta':
      return 'cta';
    
    default:
      return 'content';
  }
}
```

### 4.5 Speaker Notes Generation

```typescript
interface SpeakerNote {
  slide_id: string;
  notes: string;
  key_points: string[];
  timing_seconds: number;
  transition_cue: string;
}

async function generateSpeakerNotes(
  slides: Slide[],
  narrative: PresentationNarrative
): Promise<Slide[]> {
  const totalDuration = narrative.duration_seconds;
  const avgTimePerSlide = totalDuration / slides.length;
  
  return Promise.all(slides.map(async (slide, index) => {
    const narrativeElement = findNarrativeElement(slide, narrative);
    
    const notes = await invokeLLM({
      messages: [
        {
          role: 'system',
          content: `Generate speaker notes for a presentation slide. 
                    Notes should:
                    - Be conversational, not read verbatim
                    - Include key points to emphasize
                    - Suggest timing and transitions
                    - Be 50-100 words`
        },
        {
          role: 'user',
          content: `Slide ${index + 1}: ${slide.title}
                    Content: ${JSON.stringify(slide)}
                    Narrative purpose: ${narrativeElement?.type || 'content'}
                    Time allocation: ~${Math.round(avgTimePerSlide)} seconds`
        }
      ]
    });
    
    return {
      ...slide,
      speaker_notes: {
        slide_id: slide.id,
        notes: notes.choices[0].message.content,
        key_points: extractKeyPoints(notes.choices[0].message.content),
        timing_seconds: avgTimePerSlide,
        transition_cue: index < slides.length - 1 ? generateTransitionCue(slide, slides[index + 1]) : 'Thank the audience'
      }
    };
  }));
}
```

### 4.6 What NOT To Do

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Reading slides** | Audience reads faster | Slides support, don't replace speaker |
| **Bullet point overload** | Death by PowerPoint | Max 4 bullets, 8 words each |
| **Inconsistent design** | Distracting | Lock template before content |
| **No visual hierarchy** | Everything looks same | Use size, color, position |
| **Clip art** | Dated, unprofessional | Use high-quality images or none |
| **Animations everywhere** | Distracting | Subtle transitions only |

---

## 5. AI Sheets - Data Analysis

### 5.1 Core Philosophy

AI Sheets is not just "Excel with AI." It's **insight extraction** — turning raw data into understanding.

### 5.2 Data Analysis Pipeline

```typescript
interface SheetRequest {
  data_source: DataSource;
  analysis_goal: string;
  output_type: 'summary' | 'visualization' | 'pivot' | 'forecast' | 'clean';
  questions?: string[];              // Specific questions to answer
}

interface DataSource {
  type: 'file' | 'url' | 'database' | 'api' | 'paste';
  content: string | Buffer;
  format?: 'csv' | 'xlsx' | 'json' | 'sql';
}

interface AnalysisResult {
  summary: DataSummary;
  insights: Insight[];
  visualizations: Visualization[];
  cleaned_data?: CleanedData;
  pivot_tables?: PivotTable[];
  forecasts?: Forecast[];
  export_url: string;
}

async function analyzeData(request: SheetRequest): Promise<AnalysisResult> {
  // PHASE 1: Data ingestion and validation
  const data = await ingestData(request.data_source);
  
  // PHASE 2: Data profiling
  const profile = await profileData(data);
  
  // PHASE 3: Data cleaning (if needed)
  const cleanedData = profile.quality_score < 0.8 
    ? await cleanData(data, profile)
    : data;
  
  // PHASE 4: Analysis based on goal
  const analysis = await performAnalysis(cleanedData, request);
  
  // PHASE 5: Insight extraction
  const insights = await extractInsights(analysis, request.questions);
  
  // PHASE 6: Visualization generation
  const visualizations = await generateVisualizations(analysis, insights);
  
  return {
    summary: generateSummary(profile, analysis),
    insights,
    visualizations,
    cleaned_data: cleanedData !== data ? cleanedData : undefined,
    ...analysis
  };
}
```

### 5.3 Data Profiling

```typescript
interface DataProfile {
  row_count: number;
  column_count: number;
  columns: ColumnProfile[];
  quality_score: number;
  issues: DataIssue[];
  suggested_analyses: string[];
}

interface ColumnProfile {
  name: string;
  type: 'numeric' | 'categorical' | 'datetime' | 'text' | 'boolean' | 'mixed';
  null_count: number;
  null_percentage: number;
  unique_count: number;
  unique_percentage: number;
  statistics?: NumericStatistics;
  top_values?: { value: any; count: number }[];
  distribution?: Distribution;
}

async function profileData(data: DataFrame): Promise<DataProfile> {
  const columns: ColumnProfile[] = [];
  const issues: DataIssue[] = [];
  
  for (const col of data.columns) {
    const values = data.getColumn(col);
    const nonNull = values.filter(v => v !== null && v !== undefined && v !== '');
    
    // Detect type
    const type = detectColumnType(nonNull);
    
    // Calculate statistics
    const profile: ColumnProfile = {
      name: col,
      type,
      null_count: values.length - nonNull.length,
      null_percentage: (values.length - nonNull.length) / values.length,
      unique_count: new Set(nonNull).size,
      unique_percentage: new Set(nonNull).size / nonNull.length
    };
    
    // Type-specific profiling
    if (type === 'numeric') {
      profile.statistics = calculateNumericStats(nonNull);
      profile.distribution = detectDistribution(nonNull);
    } else if (type === 'categorical') {
      profile.top_values = getTopValues(nonNull, 10);
    }
    
    columns.push(profile);
    
    // Detect issues
    if (profile.null_percentage > 0.1) {
      issues.push({
        type: 'high_null_rate',
        column: col,
        severity: profile.null_percentage > 0.5 ? 'high' : 'medium',
        message: `${(profile.null_percentage * 100).toFixed(1)}% null values`
      });
    }
    
    if (type === 'mixed') {
      issues.push({
        type: 'mixed_types',
        column: col,
        severity: 'medium',
        message: 'Column contains mixed data types'
      });
    }
  }
  
  // Calculate quality score
  const quality_score = calculateQualityScore(columns, issues);
  
  // Suggest analyses
  const suggested_analyses = suggestAnalyses(columns);
  
  return {
    row_count: data.rowCount,
    column_count: data.columns.length,
    columns,
    quality_score,
    issues,
    suggested_analyses
  };
}

function suggestAnalyses(columns: ColumnProfile[]): string[] {
  const suggestions: string[] = [];
  
  const numericCols = columns.filter(c => c.type === 'numeric');
  const categoricalCols = columns.filter(c => c.type === 'categorical');
  const datetimeCols = columns.filter(c => c.type === 'datetime');
  
  // Time series analysis
  if (datetimeCols.length > 0 && numericCols.length > 0) {
    suggestions.push('Time series analysis: Trend and seasonality detection');
  }
  
  // Correlation analysis
  if (numericCols.length >= 2) {
    suggestions.push('Correlation analysis: Relationships between numeric variables');
  }
  
  // Segmentation
  if (categoricalCols.length > 0 && numericCols.length > 0) {
    suggestions.push('Segmentation analysis: Compare metrics across categories');
  }
  
  // Distribution analysis
  if (numericCols.some(c => c.distribution?.type === 'unknown')) {
    suggestions.push('Distribution analysis: Understand data spread and outliers');
  }
  
  return suggestions;
}
```

### 5.4 Insight Extraction

```typescript
interface Insight {
  id: string;
  type: 'trend' | 'anomaly' | 'correlation' | 'comparison' | 'summary';
  title: string;
  description: string;
  importance: number;              // 1-10
  confidence: number;              // 0-1
  supporting_data: any;
  visualization_suggestion?: string;
}

async function extractInsights(
  analysis: AnalysisResult,
  questions?: string[]
): Promise<Insight[]> {
  const insights: Insight[] = [];
  
  // AUTOMATIC INSIGHTS
  
  // 1. Trend detection
  if (analysis.time_series) {
    const trends = detectTrends(analysis.time_series);
    for (const trend of trends) {
      insights.push({
        id: `trend_${trend.column}`,
        type: 'trend',
        title: `${trend.direction} trend in ${trend.column}`,
        description: `${trend.column} has ${trend.direction === 'up' ? 'increased' : 'decreased'} by ${trend.change_percent.toFixed(1)}% over the period`,
        importance: Math.min(10, Math.abs(trend.change_percent) / 5),
        confidence: trend.r_squared,
        supporting_data: trend,
        visualization_suggestion: 'line_chart'
      });
    }
  }
  
  // 2. Anomaly detection
  const anomalies = detectAnomalies(analysis.data);
  for (const anomaly of anomalies) {
    insights.push({
      id: `anomaly_${anomaly.row}_${anomaly.column}`,
      type: 'anomaly',
      title: `Unusual value in ${anomaly.column}`,
      description: `Row ${anomaly.row}: ${anomaly.value} is ${anomaly.z_score.toFixed(1)} standard deviations from the mean`,
      importance: Math.min(10, Math.abs(anomaly.z_score)),
      confidence: 0.95,
      supporting_data: anomaly,
      visualization_suggestion: 'scatter_with_highlight'
    });
  }
  
  // 3. Correlation detection
  if (analysis.correlations) {
    const strongCorrelations = analysis.correlations.filter(c => Math.abs(c.coefficient) > 0.7);
    for (const corr of strongCorrelations) {
      insights.push({
        id: `corr_${corr.column1}_${corr.column2}`,
        type: 'correlation',
        title: `Strong ${corr.coefficient > 0 ? 'positive' : 'negative'} correlation`,
        description: `${corr.column1} and ${corr.column2} have a correlation of ${corr.coefficient.toFixed(2)}`,
        importance: Math.abs(corr.coefficient) * 10,
        confidence: corr.p_value < 0.05 ? 0.95 : 0.7,
        supporting_data: corr,
        visualization_suggestion: 'scatter_plot'
      });
    }
  }
  
  // QUESTION-DRIVEN INSIGHTS
  if (questions) {
    for (const question of questions) {
      const answer = await answerDataQuestion(question, analysis);
      insights.push({
        id: `question_${hashString(question)}`,
        type: 'summary',
        title: question,
        description: answer.answer,
        importance: 8, // User-asked questions are important
        confidence: answer.confidence,
        supporting_data: answer.evidence
      });
    }
  }
  
  // Sort by importance
  return insights.sort((a, b) => b.importance - a.importance);
}
```

### 5.5 Natural Language Querying

```typescript
async function answerDataQuestion(
  question: string,
  analysis: AnalysisResult
): Promise<QuestionAnswer> {
  // STEP 1: Parse question intent
  const intent = await parseQuestionIntent(question);
  
  // STEP 2: Generate appropriate query/calculation
  let result: any;
  
  switch (intent.type) {
    case 'aggregation':
      // "What is the total sales?"
      result = await executeAggregation(analysis.data, intent);
      break;
    
    case 'comparison':
      // "How does Q1 compare to Q2?"
      result = await executeComparison(analysis.data, intent);
      break;
    
    case 'filter':
      // "Which products have sales > 1000?"
      result = await executeFilter(analysis.data, intent);
      break;
    
    case 'trend':
      // "Is revenue increasing?"
      result = await analyzeTrend(analysis.data, intent);
      break;
    
    case 'correlation':
      // "Is there a relationship between X and Y?"
      result = await analyzeCorrelation(analysis.data, intent);
      break;
    
    case 'forecast':
      // "What will sales be next month?"
      result = await generateForecast(analysis.data, intent);
      break;
    
    default:
      // General question - use LLM with data context
      result = await answerWithLLM(question, analysis);
  }
  
  return {
    question,
    answer: formatAnswer(result, intent),
    confidence: result.confidence || 0.8,
    evidence: result.evidence || result.data
  };
}

async function parseQuestionIntent(question: string): Promise<QuestionIntent> {
  // HEURISTIC PATTERNS
  const patterns = [
    { pattern: /(?:total|sum|count|average|mean|max|min)\s+(?:of\s+)?(\w+)/i, type: 'aggregation' },
    { pattern: /compare|versus|vs|difference between/i, type: 'comparison' },
    { pattern: /which|what|who|where.*(?:have|has|is|are|>|<|=)/i, type: 'filter' },
    { pattern: /(?:is|are).*(?:increasing|decreasing|growing|declining|trend)/i, type: 'trend' },
    { pattern: /(?:relationship|correlation|related|affect|impact)/i, type: 'correlation' },
    { pattern: /(?:predict|forecast|estimate|will be|next)/i, type: 'forecast' }
  ];
  
  for (const { pattern, type } of patterns) {
    if (pattern.test(question)) {
      return { type, raw_question: question };
    }
  }
  
  return { type: 'general', raw_question: question };
}
```

### 5.6 What NOT To Do

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Analyze dirty data** | Garbage in, garbage out | Profile and clean first |
| **Show all insights** | Overwhelms user | Rank by importance, show top 5 |
| **Complex statistics** | Users don't understand | Plain language explanations |
| **Ignore context** | Insights without meaning | Explain "so what?" |
| **Auto-visualize everything** | Chart overload | Only visualize key insights |
| **Trust outliers** | Could be data errors | Flag for review |

---

## 6. AI Image - Image Generation

### 6.1 Core Philosophy

Image generation is not "type prompt, get image." It's **visual communication** — the image must serve a purpose.

### 6.2 Image Generation Pipeline

```typescript
interface ImageRequest {
  purpose: 'illustration' | 'diagram' | 'photo' | 'art' | 'logo' | 'icon' | 'infographic';
  description: string;
  style?: ImageStyle;
  dimensions?: { width: number; height: number };
  format?: 'png' | 'jpg' | 'svg' | 'webp';
  variations?: number;
  reference_images?: string[];
  negative_prompt?: string;
}

interface ImageStyle {
  artistic_style?: 'photorealistic' | 'illustration' | 'cartoon' | 'sketch' | 'watercolor' | '3d_render' | 'flat_design';
  color_palette?: string[];
  mood?: 'professional' | 'playful' | 'dramatic' | 'calm' | 'energetic';
  lighting?: 'natural' | 'studio' | 'dramatic' | 'soft';
}

interface GeneratedImage {
  id: string;
  url: string;
  thumbnail_url: string;
  prompt_used: string;
  dimensions: { width: number; height: number };
  format: string;
  variations?: GeneratedImage[];
}

async function generateImage(request: ImageRequest): Promise<GeneratedImage> {
  // PHASE 1: Prompt engineering
  const optimizedPrompt = await engineerPrompt(request);
  
  // PHASE 2: Style parameters
  const styleParams = resolveStyleParameters(request);
  
  // PHASE 3: Generation
  const result = await callImageGenerationAPI({
    prompt: optimizedPrompt.positive,
    negative_prompt: optimizedPrompt.negative,
    ...styleParams,
    n: request.variations || 1
  });
  
  // PHASE 4: Quality check
  const validated = await validateGeneratedImage(result, request);
  
  // PHASE 5: Post-processing
  const processed = await postProcessImage(validated, request);
  
  return processed;
}
```

### 6.3 Prompt Engineering

```typescript
interface OptimizedPrompt {
  positive: string;
  negative: string;
  style_tokens: string[];
}

async function engineerPrompt(request: ImageRequest): Promise<OptimizedPrompt> {
  // BASE PROMPT from user description
  let positive = request.description;
  
  // ADD PURPOSE-SPECIFIC TOKENS
  const purposeTokens: Record<string, string[]> = {
    'illustration': ['digital illustration', 'clean lines', 'professional'],
    'diagram': ['technical diagram', 'clear labels', 'educational', 'simple shapes'],
    'photo': ['photograph', 'high resolution', 'sharp focus', 'professional photography'],
    'art': ['artistic', 'creative', 'expressive'],
    'logo': ['logo design', 'vector style', 'simple', 'memorable', 'scalable'],
    'icon': ['icon design', 'simple', 'recognizable', 'flat design'],
    'infographic': ['infographic style', 'data visualization', 'clean layout']
  };
  
  positive += ', ' + (purposeTokens[request.purpose] || []).join(', ');
  
  // ADD STYLE TOKENS
  if (request.style) {
    if (request.style.artistic_style) {
      positive += `, ${request.style.artistic_style} style`;
    }
    if (request.style.mood) {
      positive += `, ${request.style.mood} mood`;
    }
    if (request.style.lighting) {
      positive += `, ${request.style.lighting} lighting`;
    }
  }
  
  // ADD QUALITY TOKENS
  positive += ', high quality, detailed';
  
  // BUILD NEGATIVE PROMPT
  let negative = request.negative_prompt || '';
  
  // Add default negatives based on purpose
  const defaultNegatives: Record<string, string[]> = {
    'photo': ['cartoon', 'illustration', 'drawing', 'painting', 'anime'],
    'illustration': ['photo', 'photograph', 'realistic'],
    'logo': ['complex', 'detailed background', 'photorealistic', 'gradients'],
    'icon': ['complex', 'detailed', 'realistic', 'text']
  };
  
  negative += ', ' + (defaultNegatives[request.purpose] || []).join(', ');
  
  // Add universal negatives
  negative += ', blurry, low quality, distorted, watermark, text, signature';
  
  return {
    positive: positive.trim(),
    negative: negative.trim(),
    style_tokens: purposeTokens[request.purpose] || []
  };
}
```

### 6.4 Image Validation

```typescript
interface ImageValidation {
  passed: boolean;
  issues: ValidationIssue[];
  quality_score: number;
}

async function validateGeneratedImage(
  image: RawGeneratedImage,
  request: ImageRequest
): Promise<ImageValidation> {
  const issues: ValidationIssue[] = [];
  
  // CHECK 1: Dimensions match request
  if (request.dimensions) {
    if (image.width !== request.dimensions.width || image.height !== request.dimensions.height) {
      issues.push({
        type: 'dimension_mismatch',
        severity: 'low',
        message: `Generated ${image.width}x${image.height}, requested ${request.dimensions.width}x${request.dimensions.height}`
      });
    }
  }
  
  // CHECK 2: Content safety
  const safetyCheck = await checkImageSafety(image);
  if (!safetyCheck.safe) {
    issues.push({
      type: 'safety_violation',
      severity: 'high',
      message: `Image flagged for: ${safetyCheck.reasons.join(', ')}`
    });
  }
  
  // CHECK 3: Quality assessment
  const qualityScore = await assessImageQuality(image);
  if (qualityScore < 0.6) {
    issues.push({
      type: 'low_quality',
      severity: 'medium',
      message: `Quality score ${qualityScore.toFixed(2)} below threshold`
    });
  }
  
  // CHECK 4: Prompt adherence (using CLIP or similar)
  const adherenceScore = await measurePromptAdherence(image, request.description);
  if (adherenceScore < 0.5) {
    issues.push({
      type: 'prompt_mismatch',
      severity: 'medium',
      message: `Image doesn't match prompt well (score: ${adherenceScore.toFixed(2)})`
    });
  }
  
  return {
    passed: !issues.some(i => i.severity === 'high'),
    issues,
    quality_score: qualityScore
  };
}
```

### 6.5 What NOT To Do

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Vague prompts** | Unpredictable results | Be specific about style, subject, composition |
| **No negative prompt** | Unwanted elements | Always specify what to avoid |
| **Wrong aspect ratio** | Cropping issues | Match output use case |
| **Ignoring purpose** | Photo when diagram needed | Purpose-specific prompts |
| **No quality check** | Bad images slip through | Validate before returning |
| **Text in images** | AI can't do text well | Add text in post-processing |

---

## 7. AI Video - Video Generation

### 7.1 Core Philosophy

Video generation is the most resource-intensive operation. **Gate aggressively** and set clear expectations.

### 7.2 Video Generation Pipeline

```typescript
interface VideoRequest {
  type: 'animation' | 'slideshow' | 'explainer' | 'social' | 'presentation';
  content: VideoContent;
  duration_seconds: number;
  style: VideoStyle;
  audio?: AudioConfig;
  output_format: 'mp4' | 'webm' | 'gif';
  quality: 'draft' | 'standard' | 'high';
}

interface VideoContent {
  scenes: Scene[];
  transitions?: TransitionType;
  text_overlays?: TextOverlay[];
}

interface Scene {
  type: 'image' | 'video_clip' | 'text' | 'animation';
  content: string | GeneratedImage;
  duration_seconds: number;
  animation?: AnimationType;
  narration?: string;
}

async function generateVideo(request: VideoRequest): Promise<GeneratedVideo> {
  // PHASE 1: Validate request
  const validation = validateVideoRequest(request);
  if (!validation.valid) {
    throw new Error(`Invalid video request: ${validation.issues.join(', ')}`);
  }
  
  // PHASE 2: Estimate resources
  const estimate = estimateVideoResources(request);
  if (estimate.credits > request.max_credits) {
    throw new Error(`Video would cost ${estimate.credits} credits, max is ${request.max_credits}`);
  }
  
  // PHASE 3: Generate assets
  const assets = await generateVideoAssets(request);
  
  // PHASE 4: Compose video
  const composed = await composeVideo(assets, request);
  
  // PHASE 5: Add audio
  const withAudio = request.audio 
    ? await addAudio(composed, request.audio)
    : composed;
  
  // PHASE 6: Export
  return await exportVideo(withAudio, request);
}
```

### 7.3 Video Type Handlers

```typescript
async function generateVideoAssets(request: VideoRequest): Promise<VideoAssets> {
  switch (request.type) {
    case 'slideshow':
      return await generateSlideshowAssets(request);
    
    case 'explainer':
      return await generateExplainerAssets(request);
    
    case 'animation':
      return await generateAnimationAssets(request);
    
    case 'social':
      return await generateSocialAssets(request);
    
    case 'presentation':
      return await generatePresentationAssets(request);
    
    default:
      throw new Error(`Unknown video type: ${request.type}`);
  }
}

async function generateSlideshowAssets(request: VideoRequest): Promise<VideoAssets> {
  const assets: VideoAssets = { images: [], audio: null };
  
  for (const scene of request.content.scenes) {
    if (scene.type === 'image') {
      // Generate or use provided image
      const image = typeof scene.content === 'string'
        ? await generateImage({ purpose: 'illustration', description: scene.content })
        : scene.content;
      
      assets.images.push({
        image,
        duration: scene.duration_seconds,
        animation: scene.animation || 'ken_burns'
      });
    }
  }
  
  return assets;
}

async function generateExplainerAssets(request: VideoRequest): Promise<VideoAssets> {
  const assets: VideoAssets = { images: [], audio: null, animations: [] };
  
  // Generate script from content
  const script = await generateExplainerScript(request.content);
  
  // Generate voiceover
  if (request.audio?.voiceover) {
    assets.audio = await generateVoiceover(script, request.audio);
  }
  
  // Generate visuals for each script segment
  for (const segment of script.segments) {
    const visual = await generateExplainerVisual(segment);
    assets.animations.push({
      visual,
      timing: segment.timing,
      text_overlay: segment.key_point
    });
  }
  
  return assets;
}
```

### 7.4 Resource Estimation

```typescript
interface ResourceEstimate {
  credits: number;
  estimated_time_seconds: number;
  breakdown: {
    image_generation: number;
    video_composition: number;
    audio_generation: number;
    encoding: number;
  };
}

function estimateVideoResources(request: VideoRequest): ResourceEstimate {
  const breakdown = {
    image_generation: 0,
    video_composition: 0,
    audio_generation: 0,
    encoding: 0
  };
  
  // Image generation costs
  const imageScenes = request.content.scenes.filter(s => s.type === 'image');
  breakdown.image_generation = imageScenes.length * 2; // 2 credits per image
  
  // Video composition costs (based on duration and quality)
  const qualityMultipliers = { draft: 0.5, standard: 1, high: 2 };
  breakdown.video_composition = request.duration_seconds * 0.1 * qualityMultipliers[request.quality];
  
  // Audio costs
  if (request.audio?.voiceover) {
    breakdown.audio_generation = request.duration_seconds * 0.05;
  }
  if (request.audio?.background_music) {
    breakdown.audio_generation += 1;
  }
  
  // Encoding costs
  breakdown.encoding = request.duration_seconds * 0.02 * qualityMultipliers[request.quality];
  
  const totalCredits = Object.values(breakdown).reduce((a, b) => a + b, 0);
  
  // Estimate time (rough)
  const estimatedTime = 
    imageScenes.length * 10 +           // 10s per image
    request.duration_seconds * 2 +       // 2x realtime for composition
    (request.audio?.voiceover ? request.duration_seconds : 0) + // 1x for voiceover
    request.duration_seconds * 0.5;      // 0.5x for encoding
  
  return {
    credits: Math.ceil(totalCredits),
    estimated_time_seconds: Math.ceil(estimatedTime),
    breakdown
  };
}
```

### 7.5 What NOT To Do

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Long videos** | Expensive, slow | Cap at 60 seconds for AI generation |
| **High quality by default** | Wastes resources | Start with draft, upgrade if needed |
| **No preview** | User commits to expensive operation | Show storyboard first |
| **Complex animations** | Unreliable results | Simple transitions only |
| **Real-time generation** | Too slow | Async with progress updates |
| **No cost estimate** | Surprise bills | Show estimate before generation |

---

## 8. Custom Agent Creation Interface

### 8.1 Core Philosophy

Custom agents are **constrained personas**, not general AI. The constraint is the value.

### 8.2 Agent Definition Model

```typescript
interface CustomAgent {
  id: string;
  name: string;
  description: string;
  avatar_url?: string;
  creator_id: string;
  visibility: 'private' | 'team' | 'public';
  
  // Core configuration
  system_prompt: string;
  personality: PersonalityConfig;
  capabilities: AgentCapabilities;
  constraints: AgentConstraints;
  
  // Knowledge
  knowledge_base?: KnowledgeBase;
  
  // Interaction
  conversation_starters: string[];
  
  // Metadata
  created_at: number;
  updated_at: number;
  usage_count: number;
  rating?: number;
}

interface PersonalityConfig {
  tone: 'formal' | 'casual' | 'friendly' | 'professional' | 'playful';
  verbosity: 'concise' | 'balanced' | 'detailed';
  emoji_usage: 'none' | 'minimal' | 'moderate' | 'frequent';
  response_style: 'direct' | 'explanatory' | 'socratic';
}

interface AgentCapabilities {
  can_search: boolean;
  can_browse: boolean;
  can_execute_code: boolean;
  can_generate_images: boolean;
  can_access_files: boolean;
  allowed_tools: string[];
}

interface AgentConstraints {
  max_response_length?: number;
  allowed_topics?: string[];
  blocked_topics?: string[];
  required_disclaimers?: string[];
  output_format?: 'text' | 'markdown' | 'json';
}
```

### 8.3 Agent Creation Wizard

```typescript
interface AgentCreationStep {
  id: string;
  title: string;
  description: string;
  fields: FormField[];
  validation: ValidationRule[];
}

const AGENT_CREATION_STEPS: AgentCreationStep[] = [
  {
    id: 'basics',
    title: 'Basic Information',
    description: 'Give your agent a name and purpose',
    fields: [
      { name: 'name', type: 'text', required: true, maxLength: 50 },
      { name: 'description', type: 'textarea', required: true, maxLength: 500 },
      { name: 'avatar', type: 'image_upload', required: false }
    ],
    validation: [
      { field: 'name', rule: 'unique', message: 'Agent name must be unique' }
    ]
  },
  {
    id: 'personality',
    title: 'Personality',
    description: 'Define how your agent communicates',
    fields: [
      { name: 'tone', type: 'select', options: ['formal', 'casual', 'friendly', 'professional', 'playful'] },
      { name: 'verbosity', type: 'select', options: ['concise', 'balanced', 'detailed'] },
      { name: 'response_style', type: 'select', options: ['direct', 'explanatory', 'socratic'] }
    ],
    validation: []
  },
  {
    id: 'instructions',
    title: 'Instructions',
    description: 'Tell your agent what to do and how to behave',
    fields: [
      { name: 'system_prompt', type: 'textarea', required: true, maxLength: 4000, 
        placeholder: 'You are a helpful assistant that specializes in...' }
    ],
    validation: [
      { field: 'system_prompt', rule: 'no_jailbreak', message: 'Instructions cannot override safety guidelines' }
    ]
  },
  {
    id: 'capabilities',
    title: 'Capabilities',
    description: 'Choose what your agent can do',
    fields: [
      { name: 'can_search', type: 'toggle', default: true },
      { name: 'can_browse', type: 'toggle', default: false },
      { name: 'can_execute_code', type: 'toggle', default: false },
      { name: 'can_generate_images', type: 'toggle', default: false }
    ],
    validation: []
  },
  {
    id: 'knowledge',
    title: 'Knowledge Base',
    description: 'Upload documents for your agent to reference',
    fields: [
      { name: 'documents', type: 'file_upload', multiple: true, 
        accept: '.pdf,.docx,.txt,.md', maxSize: 10 * 1024 * 1024 }
    ],
    validation: []
  },
  {
    id: 'starters',
    title: 'Conversation Starters',
    description: 'Suggest ways users can start conversations',
    fields: [
      { name: 'starters', type: 'list', minItems: 1, maxItems: 5,
        placeholder: 'e.g., "Help me write a business plan"' }
    ],
    validation: []
  }
];
```

### 8.4 System Prompt Generation

```typescript
async function generateSystemPrompt(config: Partial<CustomAgent>): Promise<string> {
  const parts: string[] = [];
  
  // BASE IDENTITY
  parts.push(`You are ${config.name}, ${config.description}.`);
  
  // PERSONALITY
  if (config.personality) {
    const personalityDescriptions: Record<string, string> = {
      'formal': 'Communicate in a formal, professional manner.',
      'casual': 'Be casual and conversational.',
      'friendly': 'Be warm, friendly, and approachable.',
      'professional': 'Maintain a professional but personable tone.',
      'playful': 'Be playful and use humor when appropriate.'
    };
    parts.push(personalityDescriptions[config.personality.tone]);
    
    const verbosityDescriptions: Record<string, string> = {
      'concise': 'Keep responses brief and to the point.',
      'balanced': 'Provide balanced responses with appropriate detail.',
      'detailed': 'Give thorough, detailed explanations.'
    };
    parts.push(verbosityDescriptions[config.personality.verbosity]);
  }
  
  // CONSTRAINTS
  if (config.constraints) {
    if (config.constraints.allowed_topics?.length) {
      parts.push(`Focus only on these topics: ${config.constraints.allowed_topics.join(', ')}.`);
    }
    if (config.constraints.blocked_topics?.length) {
      parts.push(`Do not discuss: ${config.constraints.blocked_topics.join(', ')}.`);
    }
    if (config.constraints.required_disclaimers?.length) {
      parts.push(`Always include these disclaimers when relevant: ${config.constraints.required_disclaimers.join('; ')}.`);
    }
  }
  
  // KNOWLEDGE BASE INSTRUCTIONS
  if (config.knowledge_base) {
    parts.push(`You have access to a knowledge base. When answering questions, prioritize information from your knowledge base. If the answer isn't in your knowledge base, say so.`);
  }
  
  // SAFETY GUARDRAILS (always included)
  parts.push(`
    Safety guidelines:
    - Never pretend to be a different AI or claim capabilities you don't have
    - Don't generate harmful, illegal, or unethical content
    - Respect user privacy and don't ask for sensitive personal information
    - If asked to do something outside your capabilities, explain what you can do instead
  `);
  
  return parts.join('\n\n');
}
```

### 8.5 Agent Validation

```typescript
interface AgentValidation {
  valid: boolean;
  issues: ValidationIssue[];
  warnings: string[];
}

async function validateAgent(agent: Partial<CustomAgent>): Promise<AgentValidation> {
  const issues: ValidationIssue[] = [];
  const warnings: string[] = [];
  
  // REQUIRED FIELDS
  if (!agent.name || agent.name.length < 2) {
    issues.push({ field: 'name', message: 'Name must be at least 2 characters' });
  }
  if (!agent.description || agent.description.length < 10) {
    issues.push({ field: 'description', message: 'Description must be at least 10 characters' });
  }
  if (!agent.system_prompt || agent.system_prompt.length < 20) {
    issues.push({ field: 'system_prompt', message: 'Instructions must be at least 20 characters' });
  }
  
  // JAILBREAK DETECTION
  if (agent.system_prompt) {
    const jailbreakPatterns = [
      /ignore.*previous.*instructions/i,
      /pretend.*you.*are/i,
      /act.*as.*if/i,
      /you.*are.*now/i,
      /forget.*everything/i,
      /disregard.*rules/i
    ];
    
    for (const pattern of jailbreakPatterns) {
      if (pattern.test(agent.system_prompt)) {
        issues.push({ 
          field: 'system_prompt', 
          message: 'Instructions appear to contain prompt injection attempts' 
        });
        break;
      }
    }
  }
  
  // CAPABILITY WARNINGS
  if (agent.capabilities?.can_execute_code) {
    warnings.push('Code execution is enabled. Users will be able to run code through this agent.');
  }
  if (agent.capabilities?.can_browse) {
    warnings.push('Web browsing is enabled. The agent can access external websites.');
  }
  
  // KNOWLEDGE BASE VALIDATION
  if (agent.knowledge_base?.documents?.length > 0) {
    const totalSize = agent.knowledge_base.documents.reduce((acc, d) => acc + d.size, 0);
    if (totalSize > 50 * 1024 * 1024) { // 50MB
      issues.push({ field: 'knowledge_base', message: 'Total knowledge base size exceeds 50MB limit' });
    }
  }
  
  return {
    valid: issues.length === 0,
    issues,
    warnings
  };
}
```

### 8.6 What NOT To Do

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Unrestricted system prompts** | Jailbreak risk | Validate and sanitize |
| **All capabilities enabled** | Security risk | Minimal necessary capabilities |
| **No personality guidance** | Generic responses | Define tone, style, verbosity |
| **Huge knowledge bases** | Slow, expensive | Curate relevant documents |
| **No conversation starters** | Users don't know how to begin | Provide 3-5 examples |
| **Public by default** | Privacy issues | Private by default |

---

## 9. Content Feed and Personalization

### 9.1 Core Philosophy

The feed is not a timeline. It's a **personalized discovery engine** that surfaces relevant content before users know they want it.

### 9.2 Feed Architecture

```typescript
interface FeedItem {
  id: string;
  type: 'article' | 'summary' | 'guide' | 'news' | 'recommendation' | 'agent_output';
  content: FeedContent;
  metadata: FeedMetadata;
  personalization: PersonalizationScore;
}

interface FeedContent {
  title: string;
  summary: string;
  body?: string;
  media?: MediaAttachment[];
  source?: SourceReference;
  related_items?: string[];
}

interface FeedMetadata {
  created_at: number;
  updated_at: number;
  author: 'ai' | 'human' | 'curated';
  category: string[];
  tags: string[];
  reading_time_minutes: number;
  engagement: EngagementMetrics;
}

interface PersonalizationScore {
  relevance: number;           // 0-1: How relevant to user's interests
  freshness: number;           // 0-1: How new is this content
  diversity: number;           // 0-1: How different from recent feed
  quality: number;             // 0-1: Content quality score
  composite: number;           // Weighted combination
}
```

### 9.3 Feed Generation Pipeline

```typescript
async function generateFeed(
  user: UserProfile,
  context: FeedContext
): Promise<FeedItem[]> {
  // PHASE 1: Candidate generation
  const candidates = await generateCandidates(user, context);
  
  // PHASE 2: Scoring
  const scored = await scoreCandidates(candidates, user);
  
  // PHASE 3: Diversity injection
  const diverse = injectDiversity(scored, context);
  
  // PHASE 4: Ranking
  const ranked = rankFeedItems(diverse);
  
  // PHASE 5: Pagination
  const paginated = paginate(ranked, context.page, context.page_size);
  
  return paginated;
}

async function generateCandidates(
  user: UserProfile,
  context: FeedContext
): Promise<FeedCandidate[]> {
  const candidates: FeedCandidate[] = [];
  
  // SOURCE 1: Interest-based content
  const interestContent = await fetchContentByInterests(user.interests, {
    limit: 50,
    exclude_seen: user.seen_item_ids
  });
  candidates.push(...interestContent.map(c => ({ ...c, source: 'interest' })));
  
  // SOURCE 2: Trending content
  const trending = await fetchTrendingContent({
    limit: 20,
    categories: user.interests
  });
  candidates.push(...trending.map(c => ({ ...c, source: 'trending' })));
  
  // SOURCE 3: AI-generated content
  const aiGenerated = await generateAIContent(user, {
    types: ['summary', 'guide'],
    limit: 10
  });
  candidates.push(...aiGenerated.map(c => ({ ...c, source: 'ai_generated' })));
  
  // SOURCE 4: Collaborative filtering
  const collaborative = await fetchCollaborativeRecommendations(user, {
    limit: 20
  });
  candidates.push(...collaborative.map(c => ({ ...c, source: 'collaborative' })));
  
  // SOURCE 5: Following/subscriptions
  if (user.following?.length > 0) {
    const following = await fetchContentFromFollowing(user.following, {
      limit: 30
    });
    candidates.push(...following.map(c => ({ ...c, source: 'following' })));
  }
  
  return candidates;
}
```

### 9.4 Personalization Scoring

```typescript
async function scoreCandidates(
  candidates: FeedCandidate[],
  user: UserProfile
): Promise<ScoredFeedItem[]> {
  return Promise.all(candidates.map(async (candidate) => {
    const scores = {
      relevance: await calculateRelevance(candidate, user),
      freshness: calculateFreshness(candidate),
      diversity: 1, // Calculated later in diversity injection
      quality: candidate.quality_score || await assessQuality(candidate)
    };
    
    // WEIGHTED COMPOSITE
    // These weights are INTENTIONALLY PRODUCT-DRIVEN
    const weights = {
      relevance: 0.4,
      freshness: 0.2,
      diversity: 0.2,
      quality: 0.2
    };
    
    const composite = 
      scores.relevance * weights.relevance +
      scores.freshness * weights.freshness +
      scores.diversity * weights.diversity +
      scores.quality * weights.quality;
    
    return {
      ...candidate,
      personalization: { ...scores, composite }
    };
  }));
}

async function calculateRelevance(
  candidate: FeedCandidate,
  user: UserProfile
): Promise<number> {
  let score = 0;
  
  // INTEREST MATCH
  const interestOverlap = candidate.tags.filter(t => 
    user.interests.includes(t)
  ).length / Math.max(candidate.tags.length, 1);
  score += interestOverlap * 0.4;
  
  // ENGAGEMENT HISTORY
  const similarEngagement = await findSimilarEngagedContent(candidate, user);
  if (similarEngagement.length > 0) {
    score += 0.3;
  }
  
  // EMBEDDING SIMILARITY
  if (user.interest_embedding && candidate.embedding) {
    const similarity = cosineSimilarity(user.interest_embedding, candidate.embedding);
    score += similarity * 0.3;
  }
  
  return Math.min(1, score);
}

function calculateFreshness(candidate: FeedCandidate): number {
  const ageHours = (Date.now() - candidate.created_at) / (1000 * 60 * 60);
  
  // Decay function: 1.0 at 0 hours, 0.5 at 24 hours, 0.1 at 168 hours (1 week)
  return Math.exp(-ageHours / 48);
}
```

### 9.5 Diversity Injection

```typescript
function injectDiversity(
  scored: ScoredFeedItem[],
  context: FeedContext
): ScoredFeedItem[] {
  // Track what's been shown
  const shownCategories = new Map<string, number>();
  const shownSources = new Map<string, number>();
  const shownTypes = new Map<string, number>();
  
  return scored.map((item, index) => {
    // Calculate diversity penalty based on what's already shown
    let diversityScore = 1;
    
    // Category diversity
    for (const category of item.metadata.category) {
      const categoryCount = shownCategories.get(category) || 0;
      if (categoryCount > 2) {
        diversityScore *= 0.7; // Penalty for repeated category
      }
      shownCategories.set(category, categoryCount + 1);
    }
    
    // Source diversity
    const sourceCount = shownSources.get(item.source) || 0;
    if (sourceCount > 3) {
      diversityScore *= 0.8;
    }
    shownSources.set(item.source, sourceCount + 1);
    
    // Type diversity
    const typeCount = shownTypes.get(item.type) || 0;
    if (typeCount > 5) {
      diversityScore *= 0.9;
    }
    shownTypes.set(item.type, typeCount + 1);
    
    // Update scores
    return {
      ...item,
      personalization: {
        ...item.personalization,
        diversity: diversityScore,
        composite: recalculateComposite(item.personalization, diversityScore)
      }
    };
  });
}
```

### 9.6 AI Content Generation for Feed

```typescript
interface AIContentRequest {
  type: 'summary' | 'guide' | 'analysis' | 'roundup';
  topic: string;
  user: UserProfile;
  sources?: Source[];
}

async function generateAIContent(
  user: UserProfile,
  config: { types: string[]; limit: number }
): Promise<FeedCandidate[]> {
  const content: FeedCandidate[] = [];
  
  // DAILY SUMMARIES
  if (config.types.includes('summary')) {
    const topicsToSummarize = selectTopicsForSummary(user);
    for (const topic of topicsToSummarize.slice(0, 3)) {
      const summary = await generateTopicSummary(topic, user);
      content.push({
        type: 'summary',
        content: summary,
        metadata: {
          created_at: Date.now(),
          author: 'ai',
          category: [topic],
          tags: [topic, 'daily_summary'],
          reading_time_minutes: 2
        }
      });
    }
  }
  
  // PERSONALIZED GUIDES
  if (config.types.includes('guide')) {
    const guideTopics = identifyGuideOpportunities(user);
    for (const topic of guideTopics.slice(0, 2)) {
      const guide = await generatePersonalizedGuide(topic, user);
      content.push({
        type: 'guide',
        content: guide,
        metadata: {
          created_at: Date.now(),
          author: 'ai',
          category: [topic.category],
          tags: [topic.name, 'guide', 'personalized'],
          reading_time_minutes: 5
        }
      });
    }
  }
  
  return content.slice(0, config.limit);
}

async function generateTopicSummary(
  topic: string,
  user: UserProfile
): Promise<FeedContent> {
  // Fetch recent content about topic
  const recentContent = await fetchRecentContent(topic, { hours: 24, limit: 10 });
  
  // Generate summary
  const summary = await invokeLLM({
    messages: [
      {
        role: 'system',
        content: `Generate a concise daily summary about ${topic} for a user interested in ${user.interests.join(', ')}.
                  Focus on what's new and relevant. Keep it under 200 words.`
      },
      {
        role: 'user',
        content: `Recent content:\n${recentContent.map(c => c.title + ': ' + c.summary).join('\n\n')}`
      }
    ]
  });
  
  return {
    title: `Daily ${topic} Summary`,
    summary: summary.choices[0].message.content.slice(0, 200),
    body: summary.choices[0].message.content,
    source: { type: 'ai_generated', title: 'AI Summary' }
  };
}
```

### 9.7 What NOT To Do

| Anti-Pattern | Why It Fails | What To Do Instead |
|--------------|--------------|-------------------|
| **Pure chronological** | Misses relevance | Score and rank |
| **Only interests** | Filter bubble | Inject diversity |
| **No freshness decay** | Stale content surfaces | Time-based decay |
| **Same content types** | Monotonous | Mix articles, summaries, guides |
| **No engagement feedback** | Doesn't learn | Track clicks, reads, saves |
| **AI content overload** | Feels artificial | Cap at 20% AI-generated |

---

## Implementation Checklist

| Feature | Must Have | Nice to Have | Explicitly Vague |
|---------|-----------|--------------|------------------|
| **Citations** | Claim detection, source matching | Archive URLs | Citation style choice |
| **Follow-ups** | Type diversity, ranking | User profile matching | Question count |
| **AI Docs** | Structure planning, export | Templates | Style customization |
| **AI Slides** | Content rules, speaker notes | Animations | Visual design |
| **AI Sheets** | Profiling, insight extraction | NL querying | Visualization choice |
| **AI Image** | Prompt engineering, validation | Style presets | Quality thresholds |
| **AI Video** | Resource estimation, asset generation | Voiceover | Duration limits |
| **Custom Agents** | Validation, system prompt generation | Knowledge base | Capability defaults |
| **Content Feed** | Scoring, diversity | AI generation | Weight tuning |

---

*This guide provides implementation-ready specifications for achieving Manus.im feature parity. All code is TypeScript, all thresholds are starting points for tuning.*
