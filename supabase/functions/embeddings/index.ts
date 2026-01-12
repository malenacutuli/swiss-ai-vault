// supabase/functions/embeddings/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const serviceClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }

  const url = new URL(req.url);
  const action = url.searchParams.get('action') || 'embed';

  try {
    switch (action) {
      case 'embed': {
        // Generate embedding for text
        const body = await req.json();
        const { text } = body;

        if (!text) throw new Error('Text required');

        const embedding = await generateEmbedding(text);

        return new Response(JSON.stringify({ embedding }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'index_document': {
        // Index a document for RAG
        const body = await req.json();
        const { document_id } = body;

        if (!document_id) throw new Error('Document ID required');

        // Get document content
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .select('content')
          .eq('id', document_id)
          .single();

        if (docError || !doc) throw new Error('Document not found');

        // Chunk the document
        const { data: chunkCount } = await serviceClient.rpc('chunk_document', {
          p_document_id: document_id,
          p_content: doc.content,
          p_chunk_size: 1000,
          p_chunk_overlap: 200
        });

        // Get chunks and generate embeddings
        const { data: chunks } = await serviceClient
          .from('document_chunks')
          .select('id, content')
          .eq('document_id', document_id);

        if (chunks) {
          for (const chunk of chunks) {
            const embedding = await generateEmbedding(chunk.content);

            await serviceClient
              .from('document_chunks')
              .update({ embedding })
              .eq('id', chunk.id);
          }
        }

        return new Response(JSON.stringify({
          success: true,
          chunks_indexed: chunkCount
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      case 'search': {
        // Search documents using similarity
        const body = await req.json();
        const { query, org_id, match_count = 5, threshold = 0.7 } = body;

        if (!query) throw new Error('Query required');

        // Generate query embedding
        const queryEmbedding = await generateEmbedding(query);

        // Search similar chunks
        const { data: results, error: searchError } = await serviceClient.rpc('search_documents', {
          p_query_embedding: queryEmbedding,
          p_user_id: user.id,
          p_org_id: org_id || null,
          p_match_count: match_count,
          p_match_threshold: threshold
        });

        if (searchError) throw searchError;

        return new Response(JSON.stringify({ results }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input: text
    })
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error?.message || 'Embedding generation failed');
  }

  return data.data[0].embedding;
}
