import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 2000; // ~500 tokens (4 chars per token)
const CHUNK_OVERLAP = 200; // ~50 tokens overlap
const EMBEDDING_BATCH_SIZE = 100;

interface ChunkMetadata {
  page_number?: number;
  char_start: number;
  char_end: number;
}

interface DocumentChunk {
  content: string;
  metadata: ChunkMetadata;
}

// Extract text from different document types
async function extractText(file: File): Promise<string> {
  const filename = file.name.toLowerCase();
  const arrayBuffer = await file.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  
  if (filename.endsWith('.txt') || filename.endsWith('.md')) {
    // Plain text / Markdown - decode directly
    return new TextDecoder().decode(bytes);
  }
  
  if (filename.endsWith('.pdf')) {
    // For PDF, we'll extract text using a simple approach
    // Convert to string and extract readable text between stream markers
    const text = new TextDecoder('latin1').decode(bytes);
    return extractTextFromPDF(text);
  }
  
  if (filename.endsWith('.docx')) {
    // DOCX is a zip file with XML content
    return await extractTextFromDOCX(bytes);
  }
  
  throw new Error(`Unsupported file type: ${filename}`);
}

// Simple PDF text extraction (extracts text objects from PDF)
function extractTextFromPDF(pdfContent: string): string {
  const textParts: string[] = [];
  
  // Find all text objects between BT and ET markers
  const textObjectRegex = /BT\s*([\s\S]*?)\s*ET/g;
  let match;
  
  while ((match = textObjectRegex.exec(pdfContent)) !== null) {
    const textBlock = match[1];
    
    // Extract text from Tj and TJ operators
    const tjRegex = /\(([^)]*)\)\s*Tj/g;
    let tjMatch;
    while ((tjMatch = tjRegex.exec(textBlock)) !== null) {
      textParts.push(decodeEscapedString(tjMatch[1]));
    }
    
    // Extract text from TJ arrays
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let tjArrayMatch;
    while ((tjArrayMatch = tjArrayRegex.exec(textBlock)) !== null) {
      const arrayContent = tjArrayMatch[1];
      const stringRegex = /\(([^)]*)\)/g;
      let stringMatch;
      while ((stringMatch = stringRegex.exec(arrayContent)) !== null) {
        textParts.push(decodeEscapedString(stringMatch[1]));
      }
    }
  }
  
  // If no text extracted via operators, try to find readable ASCII sequences
  if (textParts.length === 0) {
    const readableRegex = /[\x20-\x7E]{20,}/g;
    let readableMatch;
    while ((readableMatch = readableRegex.exec(pdfContent)) !== null) {
      const text = readableMatch[0];
      // Filter out PDF syntax
      if (!text.includes('/') && !text.includes('<<') && !text.includes('stream')) {
        textParts.push(text);
      }
    }
  }
  
  return textParts.join(' ').replace(/\s+/g, ' ').trim();
}

function decodeEscapedString(str: string): string {
  return str
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\\/g, '\\')
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)));
}

// Extract text from DOCX (ZIP with XML)
async function extractTextFromDOCX(bytes: Uint8Array): Promise<string> {
  // DOCX is a ZIP file, we need to extract document.xml
  // Using a simple approach to find and extract the content
  
  // Find the PK signature and locate document.xml content
  const str = new TextDecoder('latin1').decode(bytes);
  
  // Look for XML content in the document
  const xmlContentStart = str.indexOf('<?xml');
  if (xmlContentStart === -1) {
    throw new Error('Invalid DOCX file: No XML content found');
  }
  
  // Extract all text between <w:t> tags (Word text elements)
  const textParts: string[] = [];
  const textRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  
  while ((match = textRegex.exec(str)) !== null) {
    if (match[1]) {
      textParts.push(match[1]);
    }
  }
  
  // Also look for paragraph breaks
  const result = str.replace(/<w:p[^>]*>/g, '\n').replace(/<[^>]+>/g, '');
  
  if (textParts.length > 0) {
    return textParts.join(' ');
  }
  
  // Fallback: return cleaned result
  return result.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim();
}

// Chunk text into smaller pieces with overlap
function chunkText(text: string): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  let charStart = 0;
  let currentCharPos = 0;
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) {
      currentCharPos += paragraph.length + 2; // Account for \n\n
      continue;
    }
    
    // If adding this paragraph would exceed chunk size
    if (currentChunk.length + trimmedParagraph.length > CHUNK_SIZE) {
      // Save current chunk if not empty
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            char_start: charStart,
            char_end: currentCharPos,
          },
        });
      }
      
      // Start new chunk with overlap from previous
      const overlapStart = Math.max(0, currentChunk.length - CHUNK_OVERLAP);
      const overlap = currentChunk.slice(overlapStart);
      currentChunk = overlap + (overlap ? ' ' : '') + trimmedParagraph;
      charStart = currentCharPos - (currentChunk.length - trimmedParagraph.length - 1);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
    }
    
    currentCharPos += paragraph.length + 2;
  }
  
  // Don't forget the last chunk
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        char_start: charStart,
        char_end: currentCharPos,
      },
    });
  }
  
  // If text is too short and no chunks created, create one chunk
  if (chunks.length === 0 && text.trim()) {
    chunks.push({
      content: text.trim(),
      metadata: {
        char_start: 0,
        char_end: text.length,
      },
    });
  }
  
  return chunks;
}

// Generate embeddings using OpenAI
async function generateEmbeddings(texts: string[], openaiApiKey: string): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-ada-002',
      input: texts,
    }),
  });
  
  if (!response.ok) {
    const error = await response.text();
    console.error('OpenAI embeddings error:', error);
    throw new Error(`OpenAI API error: ${response.status}`);
  }
  
  const data = await response.json();
  return data.data.map((item: { embedding: number[] }) => item.embedding);
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  
  try {
    // Get authorization
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('EXTERNAL_SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    
    if (!openaiApiKey) {
      throw new Error('OPENAI_API_KEY is not configured');
    }
    
    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing document for user: ${user.id}`);
    
    // Parse multipart form data
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const conversationId = formData.get('conversation_id') as string | null;
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Received file: ${file.name}, size: ${file.size} bytes`);
    
    // Validate file type
    const filename = file.name.toLowerCase();
    const validExtensions = ['.txt', '.md', '.pdf', '.docx'];
    const hasValidExtension = validExtensions.some(ext => filename.endsWith(ext));
    
    if (!hasValidExtension) {
      return new Response(
        JSON.stringify({ error: `Unsupported file type. Supported: ${validExtensions.join(', ')}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Extract text from document
    console.log('Extracting text from document...');
    const text = await extractText(file);
    
    if (!text || text.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: 'Could not extract text from document' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Extracted ${text.length} characters`);
    
    // Chunk the text
    console.log('Chunking text...');
    const chunks = chunkText(text);
    console.log(`Created ${chunks.length} chunks`);
    
    if (chunks.length === 0) {
      return new Response(
        JSON.stringify({ error: 'No chunks created from document' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate embeddings in batches
    console.log('Generating embeddings...');
    const allEmbeddings: number[][] = [];
    
    for (let i = 0; i < chunks.length; i += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBEDDING_BATCH_SIZE);
      const batchTexts = batch.map(c => c.content);
      
      console.log(`Processing embedding batch ${Math.floor(i / EMBEDDING_BATCH_SIZE) + 1}/${Math.ceil(chunks.length / EMBEDDING_BATCH_SIZE)}`);
      
      const embeddings = await generateEmbeddings(batchTexts, openaiApiKey);
      allEmbeddings.push(...embeddings);
    }
    
    // Prepare records for insertion
    const records = chunks.map((chunk, index) => ({
      user_id: user.id,
      conversation_id: conversationId || null,
      filename: file.name,
      chunk_index: index,
      content: chunk.content,
      embedding: JSON.stringify(allEmbeddings[index]),
      metadata: chunk.metadata,
    }));
    
    // Insert chunks into database
    console.log('Storing chunks in database...');
    const { error: insertError } = await supabase
      .from('document_chunks')
      .insert(records);
    
    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Failed to store chunks: ${insertError.message}`);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`Successfully processed ${file.name} in ${processingTime}ms`);
    
    return new Response(
      JSON.stringify({
        success: true,
        chunks_created: chunks.length,
        filename: file.name,
        processing_time_ms: processingTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in embed-document:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
