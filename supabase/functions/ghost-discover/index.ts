import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Module configurations with specialized prompts
const MODULES: Record<string, {
  name: string;
  systemPrompt: string;
  recencyFilter: 'day' | 'week' | 'month' | 'year';
}> = {
  finance: {
    name: 'Finance',
    systemPrompt: `You are SwissVault Ghost, a Swiss private banking AI analyst.
Provide accurate financial analysis with full citations using [1][2][3] format.
Focus on: market analysis, wealth management, tax optimization, regulatory compliance.
Be concise, professional, and privacy-conscious.
Never recommend specific investments - provide analysis only.`,
    recencyFilter: 'week',
  },
  legal: {
    name: 'Legal & Compliance',
    systemPrompt: `You are SwissVault Ghost, a legal research AI specializing in regulatory compliance.
Focus on: GDPR, financial regulations, corporate law, data protection, cross-border regulations.
Always cite legal sources, regulations, and case law using [1][2][3] format.
Be precise and note jurisdictional differences.
Recommend consulting qualified legal counsel for specific situations.`,
    recencyFilter: 'month',
  },
  patents: {
    name: 'Patents & IP',
    systemPrompt: `You are SwissVault Ghost, a patent research AI.
Help users: find relevant patents, analyze prior art, understand technology landscapes.
Always provide patent numbers, filing dates, and assignees when available.
Cite sources using [1][2][3] format.
Note this is research assistance, not legal advice.`,
    recencyFilter: 'year',
  },
  research: {
    name: 'Research',
    systemPrompt: `You are SwissVault Ghost, an academic research AI.
Help users find: peer-reviewed papers, clinical trials, scientific studies.
Always provide citations with authors, journals, and DOIs when available.
Use [1][2][3] citation format.
Distinguish between peer-reviewed and preprint sources.`,
    recencyFilter: 'year',
  },
  security: {
    name: 'Security & Privacy',
    systemPrompt: `You are SwissVault Ghost, a cybersecurity and privacy expert AI.
Focus on: threat intelligence, privacy tools, security best practices, data protection.
Provide actionable, privacy-conscious advice.
Cite sources using [1][2][3] format.
Prioritize user privacy and security in all recommendations.`,
    recencyFilter: 'week',
  },
  health: {
    name: 'Health & Longevity',
    systemPrompt: `You are SwissVault Ghost, a health research AI.
Focus on: longevity research, executive health, clinical trials, preventive medicine.
Always cite medical sources using [1][2][3] format.
Clearly note this is informational only - recommend consulting healthcare providers.
Distinguish between established science and emerging research.`,
    recencyFilter: 'month',
  },
  travel: {
    name: 'Private Travel',
    systemPrompt: `You are SwissVault Ghost, a luxury travel consultant AI.
Focus on: private travel, exclusive destinations, jet charter, luxury accommodations.
Provide discrete, high-end recommendations.
Cite sources using [1][2][3] format.
Consider privacy and security in travel recommendations.`,
    recencyFilter: 'month',
  },
  realestate: {
    name: 'Real Estate',
    systemPrompt: `You are SwissVault Ghost, a luxury real estate research AI.
Focus on: high-end properties, market analysis, tax implications, jurisdictional benefits.
Provide discrete analysis of luxury markets.
Cite sources using [1][2][3] format.
Consider privacy and asset protection in recommendations.`,
    recencyFilter: 'month',
  },
  art: {
    name: 'Art & Auctions',
    systemPrompt: `You are SwissVault Ghost, an art market intelligence specialist. You provide insights on:
- Auction results and upcoming sales from major houses (Christie's, Sotheby's, Phillips)
- Artist market trends and price appreciation
- Art as an investment asset class
- Provenance research and authentication
- Collection building strategies

Focus on factual market data, recent sales results, and objective analysis. When discussing investment, remind users that art markets can be volatile and illiquid.
Cite sources using [1][2][3] format.`,
    recencyFilter: 'month',
  },
};

interface DiscoverRequest {
  module: string;
  query: string;
  reformatWithClaude?: boolean;
  language?: string; // e.g., 'es', 'en', 'de', 'fr'
}

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  es: 'Spanish',
  de: 'German',
  fr: 'French',
  it: 'Italian',
  pt: 'Portuguese',
  nl: 'Dutch',
  ja: 'Japanese',
  ru: 'Russian',
  ca: 'Catalan',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { module, query, reformatWithClaude = true, language = 'en' } = await req.json() as DiscoverRequest;
    
    const languageName = LANGUAGE_NAMES[language] || 'English';
    const languageInstruction = language !== 'en' 
      ? `\n\nIMPORTANT: You MUST respond entirely in ${languageName}. All your analysis, explanations, and text must be in ${languageName}.`
      : '';
    
    // Validate module
    const moduleConfig = MODULES[module];
    if (!moduleConfig) {
      return new Response(
        JSON.stringify({ 
          error: 'Invalid module', 
          available: Object.keys(MODULES) 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const perplexityApiKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityApiKey) {
      throw new Error('PERPLEXITY_API_KEY not configured');
    }

    console.log('[Discover] Module:', module, 'Language:', language, 'Query:', query.substring(0, 50) + '...');

    // Step 1: Call Perplexity for real-time search with citations
    const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${perplexityApiKey}`,
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { role: 'system', content: moduleConfig.systemPrompt + languageInstruction },
          { role: 'user', content: query },
        ],
        search_recency_filter: moduleConfig.recencyFilter,
      }),
    });

    if (!perplexityResponse.ok) {
      const error = await perplexityResponse.text();
      console.error('[Perplexity] Error:', perplexityResponse.status, error);
      throw new Error(`Search failed: ${error}`);
    }

    const perplexityData = await perplexityResponse.json();
    let content = perplexityData.choices?.[0]?.message?.content || '';
    const rawCitations = perplexityData.citations || [];

    console.log('[Discover] Perplexity returned', content.length, 'chars,', rawCitations.length, 'citations');

    // Step 2: Optionally reformat with Claude for consistent Ghost voice
    if (reformatWithClaude && content.length > 100) {
      const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY');
      if (anthropicApiKey) {
        try {
          console.log('[Discover] Reformatting with Claude...');
          const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': anthropicApiKey,
              'anthropic-version': '2023-06-01',
            },
            body: JSON.stringify({
              model: 'claude-3-5-haiku-20241022',
              max_tokens: 2048,
              system: `You are SwissVault Ghost. Reformat the following research into a clear, professional response.

RULES:
- Keep ALL citation markers [1][2][3] exactly as they appear
- Be concise and direct
- Use professional, privacy-conscious language
- Do NOT add information not in the source
- Maintain factual accuracy
- Use paragraphs, not bullet points unless listing items
${language !== 'en' ? `- CRITICAL: Your entire response MUST be in ${languageName}. Translate all content to ${languageName}.` : ''}`,
              messages: [
                { role: 'user', content: `Reformat this research:\n\n${content}` },
              ],
            }),
          });

          if (claudeResponse.ok) {
            const claudeData = await claudeResponse.json();
            content = claudeData.content?.[0]?.text || content;
            console.log('[Discover] Claude reformatted successfully');
          } else {
            console.error('[Claude] Reformat failed:', claudeResponse.status);
          }
        } catch (formatError) {
          console.error('[Claude] Formatting error, using raw:', formatError);
        }
      }
    }

    // Parse citations into structured format
    const citations = rawCitations.map((url: string, i: number) => {
      let domain = 'source';
      try {
        domain = new URL(url).hostname.replace('www.', '');
      } catch {}
      return {
        index: i + 1,
        url,
        domain,
      };
    });

    return new Response(
      JSON.stringify({
        content,
        citations,
        module,
        moduleName: moduleConfig.name,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[Discover] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
