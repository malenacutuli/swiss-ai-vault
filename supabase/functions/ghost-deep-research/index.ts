import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Hash IP for anonymous tracking
async function hashIP(ip: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(ip + (Deno.env.get('ANONYMOUS_SALT') || 'swissvault-2025'));
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

function getClientIP(req: Request): string | null {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
         req.headers.get('cf-connecting-ip') ||
         req.headers.get('x-real-ip') ||
         null;
}

serve(async (req: Request) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query, mode = 'comprehensive', include_sources = true } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Query is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check authentication
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    let isAnonymous = false;

    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (!error && user) {
        userId = user.id;
      }
    }

    // Anonymous path - check usage limits
    if (!userId) {
      const clientIP = getClientIP(req);
      if (!clientIP) {
        return new Response(
          JSON.stringify({ error: 'Unable to verify request origin' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const ipHash = await hashIP(clientIP);

      // Check anonymous research usage
      const { data: usageCheck, error: usageError } = await supabase
        .rpc('check_anonymous_usage', { 
          p_ip_hash: ipHash, 
          p_usage_type: 'research'
        });

      if (usageError) {
        console.error('Anonymous usage check error:', usageError);
        return new Response(
          JSON.stringify({ error: 'Usage check failed' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!usageCheck?.allowed) {
        return new Response(
          JSON.stringify({ 
            error: usageCheck?.reason || 'Daily research limit reached',
            signup_required: true,
            usage_type: 'research',
            used: usageCheck?.used || 0,
            limit: usageCheck?.limit || 2,
            resets_in_seconds: usageCheck?.resets_in_seconds || 86400
          }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      isAnonymous = true;
      console.log('[ghost-deep-research] Anonymous request:', { ipHash: ipHash.substring(0, 8) });
    }

    // Get Perplexity API key
    const perplexityKey = Deno.env.get('PERPLEXITY_API_KEY');
    if (!perplexityKey) {
      console.error('PERPLEXITY_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'Research service not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Set up streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        };

        try {
          // Send progress update
          send({ progress: 'Searching across multiple sources...' });

          // Call Perplexity API with sonar-deep-research model
          const perplexityResponse = await fetch('https://api.perplexity.ai/chat/completions', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${perplexityKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              model: 'sonar-deep-research',
              messages: [
                {
                  role: 'system',
                  content: `You are a comprehensive research assistant. Provide thorough, well-researched answers with citations. Structure your response clearly with headings and bullet points where appropriate. Always cite your sources using [1], [2], etc. format.`
                },
                {
                  role: 'user',
                  content: query
                }
              ],
              stream: true,
              return_citations: include_sources,
              search_recency_filter: 'month',
            }),
          });

          if (!perplexityResponse.ok) {
            const errorText = await perplexityResponse.text();
            console.error('Perplexity API error:', errorText);
            send({ error: 'Research service temporarily unavailable' });
            controller.close();
            return;
          }

          send({ progress: 'Analyzing and synthesizing information...' });

          const reader = perplexityResponse.body?.getReader();
          if (!reader) {
            throw new Error('No response body');
          }

          const decoder = new TextDecoder();
          let citations: Array<{ title: string; url: string; snippet?: string }> = [];

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              
              const data = line.slice(6);
              if (data === '[DONE]') continue;

              try {
                const parsed = JSON.parse(data);
                
                // Extract content
                if (parsed.choices?.[0]?.delta?.content) {
                  send({ content: parsed.choices[0].delta.content });
                }

                // Extract citations
                if (parsed.citations) {
                  citations = parsed.citations.map((c: any, i: number) => ({
                    title: c.title || `Source ${i + 1}`,
                    url: c.url || c,
                    snippet: c.snippet,
                  }));
                }
              } catch {
                // Ignore parse errors
              }
            }
          }

          // Send sources at the end
          if (citations.length > 0) {
            send({ sources: citations });
          }

          send({ progress: 'Research complete' });
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));

        } catch (error) {
          console.error('[ghost-deep-research] Stream error:', error);
          send({ error: error instanceof Error ? error.message : 'Research failed' });
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('[ghost-deep-research] Error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Research failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
