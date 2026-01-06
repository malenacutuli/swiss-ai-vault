import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ResearchRequest {
  query: string;
  taskId?: string;
  sources?: string[];
  maxResults?: number;
  depthLevel?: 'quick' | 'standard' | 'deep' | 'exhaustive';
  categories?: string[];
  dateRange?: { start?: string; end?: string };
  includeNotebookLM?: boolean;
}

interface ResearchResult {
  id: string;
  source: string;
  sourceType: string;
  title: string;
  content: string;
  url?: string;
  relevanceScore: number;
  qualityScore: number;
  timestamp: string;
  metadata?: Record<string, any>;
}

interface SourceConfig {
  name: string;
  type: 'search' | 'academic' | 'news' | 'social' | 'database';
  weight: number;
  enabled: boolean;
}

// Source configurations with quality weights
const SOURCE_CONFIGS: SourceConfig[] = [
  { name: 'perplexity', type: 'search', weight: 0.95, enabled: true },
  { name: 'perplexity-academic', type: 'academic', weight: 0.98, enabled: true },
  { name: 'perplexity-news', type: 'news', weight: 0.85, enabled: true },
  { name: 'gemini', type: 'search', weight: 0.90, enabled: true },
  { name: 'web-search', type: 'search', weight: 0.75, enabled: true },
];

// Depth configurations
const DEPTH_CONFIGS = {
  quick: { maxPerSource: 10, totalMax: 50, parallelLimit: 3 },
  standard: { maxPerSource: 25, totalMax: 100, parallelLimit: 5 },
  deep: { maxPerSource: 50, totalMax: 200, parallelLimit: 5 },
  exhaustive: { maxPerSource: 75, totalMax: 300, parallelLimit: 5 },
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY") || Deno.env.get("PERPLEXITY_API_KEY_1");
  const geminiKey = Deno.env.get("GOOGLE_GEMINI_API_KEY");

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Unauthorized");

    const body: ResearchRequest = await req.json();
    const {
      query,
      taskId,
      sources = ['perplexity', 'perplexity-academic', 'gemini'],
      maxResults = 100,
      depthLevel = 'standard',
      categories = [],
      dateRange,
      includeNotebookLM = true,
    } = body;

    if (!query?.trim()) {
      throw new Error("Query is required");
    }

    const depthConfig = DEPTH_CONFIGS[depthLevel];
    const startTime = Date.now();

    console.log(`[wide-research] Starting research: "${query.substring(0, 50)}..." | depth: ${depthLevel} | sources: ${sources.length}`);

    // Log reasoning for task tracking
    if (taskId) {
      await supabase.from('agent_reasoning').insert({
        task_id: taskId,
        agent_type: 'researcher',
        reasoning_text: `Initiating wide research across ${sources.length} sources with ${depthLevel} depth. Query: "${query}". Expected capacity: ${depthConfig.totalMax} results.`,
        confidence_score: 0.95,
        decisions_made: [`Depth: ${depthLevel}`, `Sources: ${sources.join(', ')}`, `Max results: ${maxResults}`],
      });
    }

    // Execute parallel research across all sources
    const allResults: ResearchResult[] = [];
    const sourcePromises: Promise<ResearchResult[]>[] = [];

    // Prepare search promises for each enabled source
    for (const sourceName of sources) {
      const sourceConfig = SOURCE_CONFIGS.find(s => s.name === sourceName);
      if (!sourceConfig?.enabled) continue;

      switch (sourceName) {
        case 'perplexity':
          if (perplexityKey) {
            sourcePromises.push(searchPerplexity(query, 'sonar-pro', perplexityKey, depthConfig.maxPerSource, sourceConfig));
          }
          break;
        case 'perplexity-academic':
          if (perplexityKey) {
            sourcePromises.push(searchPerplexityAcademic(query, perplexityKey, depthConfig.maxPerSource, sourceConfig));
          }
          break;
        case 'perplexity-news':
          if (perplexityKey) {
            sourcePromises.push(searchPerplexityNews(query, perplexityKey, depthConfig.maxPerSource, dateRange, sourceConfig));
          }
          break;
        case 'gemini':
          if (geminiKey) {
            sourcePromises.push(searchGemini(query, geminiKey, depthConfig.maxPerSource, sourceConfig));
          }
          break;
        case 'web-search':
          if (perplexityKey) {
            sourcePromises.push(searchPerplexity(query, 'sonar', perplexityKey, depthConfig.maxPerSource, { ...sourceConfig, name: 'web-search' }));
          }
          break;
      }
    }

    console.log(`[wide-research] Executing ${sourcePromises.length} parallel searches...`);

    // Execute all searches in parallel with error handling
    const results = await Promise.allSettled(sourcePromises);
    
    for (const result of results) {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        console.error('[wide-research] Source failed:', result.reason);
      }
    }

    console.log(`[wide-research] Collected ${allResults.length} raw results`);

    // Deduplicate and aggregate results
    const deduplicatedResults = deduplicateResults(allResults);
    console.log(`[wide-research] After deduplication: ${deduplicatedResults.length} unique results`);

    // Score and rank results
    const scoredResults = scoreAndRankResults(deduplicatedResults, query);

    // Limit to max results
    const finalResults = scoredResults.slice(0, Math.min(maxResults, depthConfig.totalMax));

    // Generate synthesis report
    const synthesis = await generateSynthesis(finalResults, query, geminiKey);

    // Generate citations
    const citations = generateCitations(finalResults);

    // Store in NotebookLM if enabled
    let notebookId: string | undefined;
    if (includeNotebookLM && finalResults.length > 0) {
      try {
        const { data: notebook } = await supabase
          .from('notebooklm_notebooks')
          .insert({
            user_id: user.id,
            title: `Research: ${query.substring(0, 50)}...`,
            description: `Wide research results for: ${query}`,
            settings: { auto_generated: true, source_count: finalResults.length },
          })
          .select()
          .single();

        if (notebook) {
          notebookId = notebook.id;
          
          // Add top sources to notebook
          const sourcesToAdd = finalResults.slice(0, 25).map(r => ({
            notebook_id: notebook.id,
            source_type: 'text',
            title: r.title,
            content_preview: r.content.substring(0, 500),
            url: r.url,
            metadata: { relevance: r.relevanceScore, quality: r.qualityScore, source: r.source },
          }));

          await supabase.from('notebooklm_sources').insert(sourcesToAdd);
        }
      } catch (err) {
        console.error('[wide-research] NotebookLM integration error:', err);
      }
    }

    // Store agent sources for task tracking
    if (taskId) {
      const sourcesToStore = finalResults.slice(0, 50).map(r => ({
        task_id: taskId,
        source_type: r.sourceType,
        source_title: r.title,
        source_url: r.url,
        source_snippet: r.content.substring(0, 300),
        relevance_score: r.relevanceScore,
        metadata: { quality: r.qualityScore, source: r.source },
      }));

      await supabase.from('agent_sources').insert(sourcesToStore);

      // Store suggestion for follow-up
      await supabase.from('agent_suggestions').insert({
        task_id: taskId,
        suggestion_type: 'follow_up',
        suggestion_text: `Explore deeper: ${finalResults[0]?.title || 'top result'}`,
        priority: 1,
      });
    }

    const duration = Date.now() - startTime;
    console.log(`[wide-research] Complete in ${duration}ms | ${finalResults.length} results | ${citations.length} citations`);

    // Log completion
    if (taskId) {
      await supabase.from('agent_communications').insert({
        task_id: taskId,
        from_agent: 'researcher',
        to_agent: 'executor',
        message_type: 'response',
        message_content: `Wide research complete: ${finalResults.length} results from ${sources.length} sources in ${duration}ms. Generated ${citations.length} citations.`,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        query,
        resultCount: finalResults.length,
        sources: sources.length,
        depthLevel,
        durationMs: duration,
        synthesis,
        citations,
        notebookId,
        results: finalResults.slice(0, 50), // Return top 50 in response
        metadata: {
          totalCollected: allResults.length,
          afterDeduplication: deduplicatedResults.length,
          sourcesUsed: [...new Set(finalResults.map(r => r.source))],
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: any) {
    console.error("[wide-research] Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Perplexity search with model selection
async function searchPerplexity(
  query: string,
  model: string,
  apiKey: string,
  limit: number,
  sourceConfig: SourceConfig
): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a research assistant. Provide detailed, factual information with specific data points. Include dates, statistics, and key findings. Structure your response with clear sections.'
          },
          {
            role: 'user',
            content: `Research thoroughly: ${query}\n\nProvide comprehensive findings with specific details, statistics, and key insights.`
          }
        ],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    // Parse response into structured results
    const sections = content.split(/\n#{1,3}\s+/).filter(Boolean);
    
    for (let i = 0; i < Math.min(sections.length, limit); i++) {
      const section = sections[i].trim();
      if (section.length < 50) continue;

      results.push({
        id: `perplexity-${model}-${Date.now()}-${i}`,
        source: sourceConfig.name,
        sourceType: sourceConfig.type,
        title: extractTitle(section),
        content: section,
        url: citations[i] || undefined,
        relevanceScore: calculateRelevance(section, query),
        qualityScore: sourceConfig.weight,
        timestamp: new Date().toISOString(),
        metadata: { model, citations: citations.slice(0, 5) },
      });
    }

    // Add citation-based results
    for (let i = 0; i < Math.min(citations.length, limit); i++) {
      results.push({
        id: `perplexity-citation-${Date.now()}-${i}`,
        source: sourceConfig.name,
        sourceType: 'citation',
        title: `Source ${i + 1}`,
        content: citations[i],
        url: citations[i],
        relevanceScore: 0.7,
        qualityScore: sourceConfig.weight * 0.9,
        timestamp: new Date().toISOString(),
      });
    }

  } catch (err) {
    console.error(`[wide-research] Perplexity ${model} error:`, err);
  }

  return results;
}

// Academic-focused search
async function searchPerplexityAcademic(
  query: string,
  apiKey: string,
  limit: number,
  sourceConfig: SourceConfig
): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];

  try {
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro',
        messages: [
          {
            role: 'system',
            content: 'You are an academic research assistant. Focus on peer-reviewed sources, research papers, and scholarly publications. Cite specific studies and their findings.'
          },
          {
            role: 'user',
            content: `Academic research on: ${query}\n\nFocus on scholarly sources, research studies, and peer-reviewed publications.`
          }
        ],
        search_domain_filter: ['arxiv.org', 'scholar.google.com', 'pubmed.ncbi.nlm.nih.gov', 'nature.com', 'science.org'],
        max_tokens: 4000,
        temperature: 0.1,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    const sections = content.split(/\n(?=\d+\.|•|-|\*)\s*/).filter((s: string) => s.length > 30);
    
    for (let i = 0; i < Math.min(sections.length, limit); i++) {
      results.push({
        id: `academic-${Date.now()}-${i}`,
        source: 'perplexity-academic',
        sourceType: 'academic',
        title: extractTitle(sections[i]),
        content: sections[i].trim(),
        url: citations[i] || undefined,
        relevanceScore: calculateRelevance(sections[i], query),
        qualityScore: sourceConfig.weight,
        timestamp: new Date().toISOString(),
        metadata: { academic: true },
      });
    }

  } catch (err) {
    console.error('[wide-research] Academic search error:', err);
  }

  return results;
}

// News-focused search
async function searchPerplexityNews(
  query: string,
  apiKey: string,
  limit: number,
  dateRange?: { start?: string; end?: string },
  sourceConfig?: SourceConfig
): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];

  try {
    const searchParams: any = {
      model: 'sonar',
      messages: [
        {
          role: 'system',
          content: 'You are a news research assistant. Focus on recent news articles, press releases, and current events. Include publication dates and sources.'
        },
        {
          role: 'user',
          content: `Latest news and developments on: ${query}`
        }
      ],
      search_recency_filter: 'week',
      max_tokens: 3000,
      temperature: 0.1,
    };

    if (dateRange?.start) {
      searchParams.search_after_date_filter = dateRange.start;
    }
    if (dateRange?.end) {
      searchParams.search_before_date_filter = dateRange.end;
    }

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(searchParams),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];

    const newsItems = content.split(/\n(?=\d+\.|•|-)\s*/).filter((s: string) => s.length > 50);
    
    for (let i = 0; i < Math.min(newsItems.length, limit); i++) {
      results.push({
        id: `news-${Date.now()}-${i}`,
        source: 'perplexity-news',
        sourceType: 'news',
        title: extractTitle(newsItems[i]),
        content: newsItems[i].trim(),
        url: citations[i] || undefined,
        relevanceScore: calculateRelevance(newsItems[i], query),
        qualityScore: sourceConfig?.weight || 0.85,
        timestamp: new Date().toISOString(),
        metadata: { news: true, dateRange },
      });
    }

  } catch (err) {
    console.error('[wide-research] News search error:', err);
  }

  return results;
}

// Gemini grounded search
async function searchGemini(
  query: string,
  apiKey: string,
  limit: number,
  sourceConfig: SourceConfig
): Promise<ResearchResult[]> {
  const results: ResearchResult[] = [];

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Provide comprehensive research on: ${query}\n\nInclude specific facts, statistics, key findings, and diverse perspectives. Structure with clear sections.`
            }]
          }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 4000,
          },
        }),
      }
    );

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const sections = content.split(/\n#{1,3}\s+|\n\n/).filter((s: string) => s.length > 50);
    
    for (let i = 0; i < Math.min(sections.length, limit); i++) {
      results.push({
        id: `gemini-${Date.now()}-${i}`,
        source: 'gemini',
        sourceType: 'search',
        title: extractTitle(sections[i]),
        content: sections[i].trim(),
        relevanceScore: calculateRelevance(sections[i], query),
        qualityScore: sourceConfig.weight,
        timestamp: new Date().toISOString(),
        metadata: { model: 'gemini-2.0-flash-exp' },
      });
    }

  } catch (err) {
    console.error('[wide-research] Gemini search error:', err);
  }

  return results;
}

// Extract title from content
function extractTitle(content: string): string {
  const firstLine = content.split('\n')[0].replace(/^[#*\-•\d.]+\s*/, '').trim();
  return firstLine.substring(0, 100) || 'Research Finding';
}

// Calculate relevance score
function calculateRelevance(content: string, query: string): number {
  const contentLower = content.toLowerCase();
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2);
  
  let matchCount = 0;
  for (const term of queryTerms) {
    if (contentLower.includes(term)) {
      matchCount++;
    }
  }

  const termRatio = queryTerms.length > 0 ? matchCount / queryTerms.length : 0;
  const lengthBonus = Math.min(content.length / 500, 0.2);
  
  return Math.min(termRatio + lengthBonus, 1);
}

// Deduplicate results based on content similarity
function deduplicateResults(results: ResearchResult[]): ResearchResult[] {
  const seen = new Map<string, ResearchResult>();
  
  for (const result of results) {
    // Create a signature for comparison
    const signature = result.content.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .slice(0, 20)
      .join(' ');
    
    const existing = seen.get(signature);
    if (!existing || result.qualityScore > existing.qualityScore) {
      seen.set(signature, result);
    }
  }

  return Array.from(seen.values());
}

// Score and rank results
function scoreAndRankResults(results: ResearchResult[], query: string): ResearchResult[] {
  return results
    .map(result => ({
      ...result,
      // Combined score: relevance * quality
      _score: result.relevanceScore * result.qualityScore,
    }))
    .sort((a, b) => (b as any)._score - (a as any)._score)
    .map(({ _score, ...result }) => result as ResearchResult);
}

// Generate synthesis report
async function generateSynthesis(
  results: ResearchResult[],
  query: string,
  geminiKey?: string
): Promise<string> {
  if (!geminiKey || results.length === 0) {
    return `Research synthesis for "${query}": Found ${results.length} results across multiple sources.`;
  }

  try {
    const topResults = results.slice(0, 15).map(r => r.content.substring(0, 300)).join('\n\n---\n\n');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Synthesize these research findings into a coherent summary:\n\nQuery: ${query}\n\nFindings:\n${topResults}\n\nProvide a structured synthesis with:\n1. Key Insights (3-5 main points)\n2. Consensus Views\n3. Conflicting Perspectives\n4. Knowledge Gaps\n5. Recommendations`
            }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000,
          },
        }),
      }
    );

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  } catch (err) {
    console.error('[wide-research] Synthesis error:', err);
    return `Research on "${query}": Collected ${results.length} findings from multiple sources.`;
  }
}

// Generate citations
function generateCitations(results: ResearchResult[]): Array<{ key: string; title: string; url?: string; source: string }> {
  const citations: Array<{ key: string; title: string; url?: string; source: string }> = [];
  let citationNum = 1;

  for (const result of results) {
    if (result.url) {
      citations.push({
        key: `[${citationNum}]`,
        title: result.title,
        url: result.url,
        source: result.source,
      });
      citationNum++;
    }
  }

  return citations.slice(0, 50); // Max 50 citations
}
