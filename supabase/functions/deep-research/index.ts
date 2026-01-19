// supabase/functions/deep-research/index.ts
// Enhanced with Source Citations for Manus Parity
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import {
  extractCitationsFromResults,
  extractClaimsFromText,
  storeCitations,
  storeClaims,
  formatCitationsForDisplay,
  type Citation,
  type Claim,
} from "../_shared/citations/index.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  source: string;
  relevance_score?: number;
}

interface ResearchQuery {
  query: string;
  sub_queries?: string[];
  max_results?: number;
  search_depth?: 'quick' | 'standard' | 'deep';
  include_citations?: boolean;
  verify_citations?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get user from auth header
    let userId: string | undefined;
    const authHeader = req.headers.get("Authorization");
    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id;
    }

    const {
      query,
      sub_queries,
      max_results = 10,
      search_depth = 'standard',
      run_id,
      step_id,
      synthesize = true,
      include_citations = true,
      verify_citations = false,
    } = await req.json() as ResearchQuery & { run_id?: string; step_id?: string; synthesize?: boolean };

    if (!query) {
      return new Response(
        JSON.stringify({ error: "Query is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Generate sub-queries if not provided
    const queries = sub_queries?.length ? sub_queries : await generateSubQueries(query, search_depth);

    // Execute parallel searches
    const searchPromises = queries.map(q => executeSearch(q, Math.ceil(max_results / queries.length)));
    const searchResults = await Promise.allSettled(searchPromises);

    // Collect successful results
    const allResults: SearchResult[] = [];
    const errors: string[] = [];

    searchResults.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        allResults.push(...result.value);
      } else {
        errors.push(`Query "${queries[index]}" failed: ${result.reason}`);
      }
    });

    // Deduplicate by URL
    const uniqueResults = deduplicateResults(allResults);

    // Rank results by relevance
    const rankedResults = rankResults(uniqueResults, query);

    // Synthesize if requested
    let synthesis = null;
    if (synthesize && rankedResults.length > 0) {
      synthesis = await synthesizeResults(query, rankedResults.slice(0, 15));
    }

    // Generate structured citations (Manus parity feature)
    let citations: Citation[] = [];
    let claims: Claim[] = [];
    let bibliography = '';

    if (include_citations && rankedResults.length > 0) {
      // Extract citations from results
      const citationResult = extractCitationsFromResults(
        rankedResults.map(r => ({
          url: r.url,
          title: r.title,
          snippet: r.snippet,
          source: r.source,
          relevance_score: r.relevance_score,
        })),
        run_id,
        userId
      );

      // Store citations in database
      citations = await storeCitations(supabase, citationResult.citations, run_id, userId);

      // Extract claims from synthesis if available
      if (synthesis?.summary) {
        claims = extractClaimsFromText(synthesis.summary, citations);
        await storeClaims(supabase, claims, run_id, userId);
      }

      // Format bibliography
      bibliography = formatCitationsForDisplay(citations, 'bibliography');
    }

    // Store research results if run_id provided
    if (run_id && step_id) {
      await supabase.from('agent_task_outputs').insert({
        task_id: run_id,
        step_id: step_id,
        output_type: 'research',
        content: {
          query,
          sub_queries: queries,
          results_count: rankedResults.length,
          synthesis: synthesis?.summary,
          sources: rankedResults.slice(0, 20).map(r => ({ title: r.title, url: r.url })),
          citation_count: citations.length,
          claim_count: claims.length,
        }
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        query,
        sub_queries: queries,
        results: rankedResults.slice(0, max_results),
        total_found: rankedResults.length,
        synthesis,
        // Citation data (Manus parity)
        citations: citations.map(c => ({
          key: c.citation_key,
          url: c.source_url,
          title: c.source_title,
          domain: c.source_domain,
          type: c.source_type,
          credibility: c.credibility_score,
          verified: c.verified,
        })),
        claims: claims.map(c => ({
          text: c.claim_text,
          type: c.claim_type,
          status: c.verification_status,
          confidence: c.confidence_score,
        })),
        bibliography,
        errors: errors.length > 0 ? errors : undefined
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Deep research error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function generateSubQueries(mainQuery: string, depth: string): Promise<string[]> {
  const queryCount = depth === 'quick' ? 2 : depth === 'deep' ? 8 : 4;

  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return [mainQuery];
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Generate ${queryCount} diverse search queries to thoroughly research this topic. Return ONLY a JSON array of strings, no other text.

Topic: ${mainQuery}

Requirements:
- Each query should explore a different aspect
- Include specific, factual queries
- Include comparison/analysis queries
- Keep queries concise (under 10 words each)`
            }]
          }],
          generationConfig: { temperature: 0.7 }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON array from response
    const match = text.match(/\[[\s\S]*\]/);
    if (match) {
      const queries = JSON.parse(match[0]);
      return [mainQuery, ...queries.slice(0, queryCount - 1)];
    }
  } catch (e) {
    console.error("Failed to generate sub-queries:", e);
  }

  return [mainQuery];
}

async function executeSearch(query: string, limit: number): Promise<SearchResult[]> {
  const results: SearchResult[] = [];

  // Try Perplexity first
  const perplexityKey = Deno.env.get("PERPLEXITY_API_KEY");
  if (perplexityKey) {
    try {
      const perplexityResults = await searchPerplexity(query, perplexityKey, limit);
      results.push(...perplexityResults);
    } catch (e) {
      console.error("Perplexity search failed:", e);
    }
  }

  // Fallback to Serper
  if (results.length < limit) {
    const serperKey = Deno.env.get("SERPER_API_KEY");
    if (serperKey) {
      try {
        const serperResults = await searchSerper(query, serperKey, limit - results.length);
        results.push(...serperResults);
      } catch (e) {
        console.error("Serper search failed:", e);
      }
    }
  }

  return results;
}

async function searchPerplexity(query: string, apiKey: string, limit: number): Promise<SearchResult[]> {
  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "llama-3.1-sonar-small-128k-online",
      messages: [{ role: "user", content: query }],
      max_tokens: 1024,
      return_citations: true
    })
  });

  if (!response.ok) {
    throw new Error(`Perplexity API error: ${response.status}`);
  }

  const data = await response.json();
  const citations = data.citations || [];

  return citations.slice(0, limit).map((url: string, i: number) => ({
    title: `Source ${i + 1}`,
    url,
    snippet: data.choices?.[0]?.message?.content?.slice(0, 200) || '',
    source: 'perplexity'
  }));
}

async function searchSerper(query: string, apiKey: string, limit: number): Promise<SearchResult[]> {
  const response = await fetch("https://google.serper.dev/search", {
    method: "POST",
    headers: {
      "X-API-KEY": apiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ q: query, num: limit })
  });

  if (!response.ok) {
    throw new Error(`Serper API error: ${response.status}`);
  }

  const data = await response.json();

  return (data.organic || []).map((result: any) => ({
    title: result.title,
    url: result.link,
    snippet: result.snippet || '',
    source: 'serper'
  }));
}

function deduplicateResults(results: SearchResult[]): SearchResult[] {
  const seen = new Set<string>();
  return results.filter(r => {
    const key = new URL(r.url).hostname + new URL(r.url).pathname;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rankResults(results: SearchResult[], query: string): SearchResult[] {
  const queryTerms = query.toLowerCase().split(/\s+/);

  return results
    .map(r => {
      const text = `${r.title} ${r.snippet}`.toLowerCase();
      const matchCount = queryTerms.filter(term => text.includes(term)).length;
      return { ...r, relevance_score: matchCount / queryTerms.length };
    })
    .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0));
}

async function synthesizeResults(
  query: string,
  results: SearchResult[]
): Promise<{ summary: string; key_points: string[]; sources_used: number }> {
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  if (!geminiKey) {
    return { summary: '', key_points: [], sources_used: 0 };
  }

  const sourcesText = results
    .map((r, i) => `[${i + 1}] ${r.title}\n${r.snippet}\nURL: ${r.url}`)
    .join('\n\n');

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Synthesize these search results into a comprehensive answer. Include citations using [1], [2], etc.

Query: ${query}

Sources:
${sourcesText}

Provide:
1. A clear, well-organized summary (2-3 paragraphs)
2. 3-5 key points as bullet points
3. Cite sources using [n] notation

Format as JSON: { "summary": "...", "key_points": ["...", "..."] }`
            }]
          }],
          generationConfig: { temperature: 0.3 }
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      return {
        summary: parsed.summary || '',
        key_points: parsed.key_points || [],
        sources_used: results.length
      };
    }
  } catch (e) {
    console.error("Synthesis failed:", e);
  }

  return { summary: '', key_points: [], sources_used: 0 };
}
