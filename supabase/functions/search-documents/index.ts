import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate embedding using OpenAI ada-002 (same model as document embeddings)
async function generateQueryEmbedding(text: string, apiKey: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: text.trim(),
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('[search-documents] OpenAI embedding error:', error);
    throw new Error(`Failed to generate embedding: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const { query, conversation_id, limit = 5, match_threshold = 0.7 } = await req.json();

    if (!query || typeof query !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Missing or invalid query parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!conversation_id) {
      return new Response(
        JSON.stringify({ error: 'Missing conversation_id parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[search-documents] Searching for:', query.substring(0, 100));
    console.log('[search-documents] Conversation:', conversation_id);

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('[search-documents] Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[search-documents] User authenticated:', user.id);

    // Get OpenAI API key
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      console.error('[search-documents] OPENAI_API_KEY not configured');
      return new Response(
        JSON.stringify({ error: 'OpenAI API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate embedding for the query
    console.log('[search-documents] Generating query embedding...');
    const queryEmbedding = await generateQueryEmbedding(query, openaiApiKey);
    console.log('[search-documents] Embedding generated, dimensions:', queryEmbedding.length);

    // Convert embedding array to pgvector format string
    const embeddingString = `[${queryEmbedding.join(',')}]`;

    // Call the vector search function
    console.log('[search-documents] Calling search_document_chunks RPC...');
    const { data: chunks, error: searchError } = await supabase.rpc('search_document_chunks', {
      p_user_id: user.id,
      p_conversation_id: conversation_id,
      p_embedding: embeddingString,
      p_match_count: limit,
      p_match_threshold: match_threshold,
    });

    if (searchError) {
      console.error('[search-documents] Search error:', searchError);
      
      // Try fallback to search_similar_chunks if the other function exists
      console.log('[search-documents] Trying fallback search_similar_chunks...');
      const { data: fallbackChunks, error: fallbackError } = await supabase.rpc('search_similar_chunks', {
        p_user_id: user.id,
        p_embedding: embeddingString,
        p_limit: limit,
        p_conversation_id: conversation_id,
      });

      if (fallbackError) {
        console.error('[search-documents] Fallback also failed:', fallbackError);
        return new Response(
          JSON.stringify({ error: 'Vector search failed', details: searchError.message }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('[search-documents] Fallback found', fallbackChunks?.length || 0, 'chunks');
      return new Response(
        JSON.stringify({ 
          chunks: fallbackChunks || [],
          count: fallbackChunks?.length || 0,
          query: query.substring(0, 50),
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[search-documents] Found', chunks?.length || 0, 'matching chunks');

    // Return results
    return new Response(
      JSON.stringify({ 
        chunks: chunks || [],
        count: chunks?.length || 0,
        query: query.substring(0, 50),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[search-documents] Unexpected error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
