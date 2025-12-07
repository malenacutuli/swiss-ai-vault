import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('EXTERNAL_SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;
const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')!;

const NOTION_API_VERSION = '2022-06-28';

// Decrypt token (matches encryption in notion-oauth)
function decryptToken(encrypted: string): string {
  return atob(encrypted);
}

// Convert Notion blocks to plain text
function blocksToText(blocks: any[], indent = 0): string {
  const lines: string[] = [];
  const prefix = '  '.repeat(indent);

  for (const block of blocks) {
    const type = block.type;
    
    switch (type) {
      case 'paragraph':
        const paragraphText = extractRichText(block.paragraph?.rich_text);
        if (paragraphText) lines.push(`${prefix}${paragraphText}`);
        break;
      case 'heading_1':
        lines.push(`${prefix}# ${extractRichText(block.heading_1?.rich_text)}`);
        break;
      case 'heading_2':
        lines.push(`${prefix}## ${extractRichText(block.heading_2?.rich_text)}`);
        break;
      case 'heading_3':
        lines.push(`${prefix}### ${extractRichText(block.heading_3?.rich_text)}`);
        break;
      case 'bulleted_list_item':
        lines.push(`${prefix}- ${extractRichText(block.bulleted_list_item?.rich_text)}`);
        break;
      case 'numbered_list_item':
        lines.push(`${prefix}1. ${extractRichText(block.numbered_list_item?.rich_text)}`);
        break;
      case 'to_do':
        const checked = block.to_do?.checked ? '[x]' : '[ ]';
        lines.push(`${prefix}${checked} ${extractRichText(block.to_do?.rich_text)}`);
        break;
      case 'toggle':
        lines.push(`${prefix}▶ ${extractRichText(block.toggle?.rich_text)}`);
        break;
      case 'code':
        const lang = block.code?.language || '';
        const code = extractRichText(block.code?.rich_text);
        lines.push(`${prefix}\`\`\`${lang}\n${code}\n\`\`\``);
        break;
      case 'quote':
        lines.push(`${prefix}> ${extractRichText(block.quote?.rich_text)}`);
        break;
      case 'callout':
        const emoji = block.callout?.icon?.emoji || '💡';
        lines.push(`${prefix}${emoji} ${extractRichText(block.callout?.rich_text)}`);
        break;
      case 'divider':
        lines.push(`${prefix}---`);
        break;
      case 'table':
        // Tables need special handling with table_rows
        break;
      default:
        // Handle other block types as needed
        break;
    }

    // Handle children if present
    if (block.children && block.children.length > 0) {
      lines.push(blocksToText(block.children, indent + 1));
    }
  }

  return lines.join('\n');
}

function extractRichText(richText: any[]): string {
  if (!richText || !Array.isArray(richText)) return '';
  return richText.map(t => t.plain_text || '').join('');
}

// Chunk text for RAG
function chunkText(text: string, maxTokens = 500): { content: string; index: number }[] {
  const chunks: { content: string; index: number }[] = [];
  const sentences = text.split(/(?<=[.!?])\s+/);
  let currentChunk = '';
  let chunkIndex = 0;

  for (const sentence of sentences) {
    // Rough token estimate (words * 1.3)
    const estimatedTokens = (currentChunk + sentence).split(/\s+/).length * 1.3;
    
    if (estimatedTokens > maxTokens && currentChunk) {
      chunks.push({ content: currentChunk.trim(), index: chunkIndex++ });
      currentChunk = sentence;
    } else {
      currentChunk += (currentChunk ? ' ' : '') + sentence;
    }
  }

  if (currentChunk.trim()) {
    chunks.push({ content: currentChunk.trim(), index: chunkIndex });
  }

  return chunks;
}

// Generate embeddings via OpenAI
async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: texts,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI embeddings error: ${await response.text()}`);
  }

  const data = await response.json();
  return data.data.map((d: any) => d.embedding);
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { integration_id } = await req.json();

    if (!integration_id) {
      return new Response(JSON.stringify({ error: 'integration_id required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get integration details
    const { data: integration, error: intError } = await supabase
      .from('chat_integrations')
      .select('*')
      .eq('id', integration_id)
      .single();

    if (intError || !integration) {
      return new Response(JSON.stringify({ error: 'Integration not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = decryptToken(integration.encrypted_access_token);
    const userId = integration.user_id;

    console.log(`Starting Notion sync for user ${userId}`);

    // Search for all accessible pages
    const searchResponse = await fetch('https://api.notion.com/v1/search', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Notion-Version': NOTION_API_VERSION,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        filter: { property: 'object', value: 'page' },
        page_size: 100,
      }),
    });

    if (!searchResponse.ok) {
      const errorText = await searchResponse.text();
      console.error('Notion search failed:', errorText);
      throw new Error('Failed to search Notion pages');
    }

    const searchData = await searchResponse.json();
    const pages = searchData.results || [];

    console.log(`Found ${pages.length} pages to sync`);

    let pagesSynced = 0;
    let totalChunks = 0;

    for (const page of pages) {
      try {
        const pageId = page.id;
        const lastEdited = page.last_edited_time;

        // Check if page was already synced and hasn't changed
        const { data: existingData } = await supabase
          .from('chat_integration_data')
          .select('id, metadata')
          .eq('integration_id', integration_id)
          .eq('external_id', pageId)
          .single();

        if (existingData?.metadata?.last_edited === lastEdited) {
          console.log(`Skipping unchanged page: ${pageId}`);
          continue;
        }

        // Get page title
        const pageTitle = extractPageTitle(page);

        // Fetch page blocks
        const blocks = await fetchAllBlocks(accessToken, pageId);
        const content = blocksToText(blocks);

        if (!content.trim()) {
          console.log(`Skipping empty page: ${pageTitle}`);
          continue;
        }

        // Store in chat_integration_data
        const integrationDataPayload = {
          integration_id,
          data_type: 'notion_page',
          external_id: pageId,
          title: pageTitle,
          encrypted_content: btoa(unescape(encodeURIComponent(content))), // Base64 encode
          snippet: content.substring(0, 200),
          metadata: {
            page_id: pageId,
            url: page.url,
            last_edited: lastEdited,
            parent_type: page.parent?.type,
          },
          synced_at: new Date().toISOString(),
        };

        if (existingData) {
          await supabase
            .from('chat_integration_data')
            .update(integrationDataPayload)
            .eq('id', existingData.id);
        } else {
          await supabase
            .from('chat_integration_data')
            .insert(integrationDataPayload);
        }

        // Delete old chunks for this page
        await supabase
          .from('document_chunks')
          .delete()
          .eq('user_id', userId)
          .eq('metadata->>source', 'notion')
          .eq('metadata->>page_id', pageId);

        // Create chunks for RAG
        const chunks = chunkText(content);

        if (chunks.length > 0) {
          // Generate embeddings in batches
          const batchSize = 50;
          for (let i = 0; i < chunks.length; i += batchSize) {
            const batch = chunks.slice(i, i + batchSize);
            const embeddings = await generateEmbeddings(batch.map(c => c.content));

            const chunkRecords = batch.map((chunk, idx) => ({
              user_id: userId,
              filename: `[Notion] ${pageTitle}`,
              content: chunk.content,
              chunk_index: chunk.index,
              embedding: embeddings[idx],
              file_type: 'notion',
              metadata: {
                source: 'notion',
                page_id: pageId,
                page_title: pageTitle,
                url: page.url,
              },
            }));

            await supabase.from('document_chunks').insert(chunkRecords);
            totalChunks += chunkRecords.length;
          }
        }

        pagesSynced++;
        console.log(`Synced page: ${pageTitle} (${chunks.length} chunks)`);

      } catch (pageError) {
        console.error(`Error syncing page ${page.id}:`, pageError);
      }
    }

    // Update last synced timestamp
    await supabase
      .from('chat_integrations')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', integration_id);

    console.log(`Notion sync complete: ${pagesSynced} pages, ${totalChunks} chunks`);

    return new Response(JSON.stringify({
      success: true,
      pages_synced: pagesSynced,
      total_chunks: totalChunks,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Notion sync error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper to extract page title
function extractPageTitle(page: any): string {
  const properties = page.properties || {};
  
  // Try to find title property
  for (const key in properties) {
    const prop = properties[key];
    if (prop.type === 'title' && prop.title) {
      return extractRichText(prop.title) || 'Untitled';
    }
  }

  return 'Untitled';
}

// Fetch all blocks recursively
async function fetchAllBlocks(accessToken: string, blockId: string): Promise<any[]> {
  const blocks: any[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL(`https://api.notion.com/v1/blocks/${blockId}/children`);
    if (cursor) url.searchParams.set('start_cursor', cursor);

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Notion-Version': NOTION_API_VERSION,
      },
    });

    if (!response.ok) break;

    const data = await response.json();
    
    for (const block of data.results || []) {
      blocks.push(block);

      // Recursively fetch children if has_children is true
      if (block.has_children && block.type !== 'child_page') {
        block.children = await fetchAllBlocks(accessToken, block.id);
      }
    }

    cursor = data.next_cursor;
  } while (cursor);

  return blocks;
}
