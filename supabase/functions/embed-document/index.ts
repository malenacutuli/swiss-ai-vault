import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Convert Uint8Array to base64 without stack overflow
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000; // 32KB chunks to avoid call stack limits
  
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, Math.min(i + chunkSize, bytes.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHUNK_SIZE = 2000; // ~500 tokens (4 chars per token)
const CHUNK_OVERLAP = 200; // ~50 tokens overlap
const EMBEDDING_BATCH_SIZE = 20; // Smaller batches for parallel processing
const CONCURRENT_BATCHES = 5; // Number of batches to process in parallel

interface ChunkMetadata {
  page_number?: number;
  char_start: number;
  char_end: number;
  original_size?: number;
}

interface DocumentChunk {
  content: string;
  metadata: ChunkMetadata;
}

// Update job status in database
async function updateJobStatus(
  supabase: any,
  jobId: string,
  status: string,
  progress: number,
  additionalFields?: Record<string, any>
) {
  const updateData = {
    status,
    progress,
    ...(status === 'extracting' && !additionalFields?.started_at ? { started_at: new Date().toISOString() } : {}),
    ...additionalFields,
  };
  
  const { error } = await supabase
    .from('document_processing_jobs')
    .update(updateData)
    .eq('id', jobId);
    
  if (error) {
    console.error(`[Job ${jobId}] Failed to update status:`, error);
  } else {
    console.log(`[Job ${jobId}] Status: ${status} (${progress}%)`);
  }
}

// Extract text from different document types based on handler
async function extractText(
  bytes: Uint8Array, 
  filename: string, 
  handler: string | null, 
  anthropicKey: string
): Promise<string> {
  const lowerFilename = filename.toLowerCase();
  const effectiveHandler = handler || getHandlerFromFilename(lowerFilename);
  
  console.log(`Using handler: ${effectiveHandler} for ${filename}`);
  
  switch (effectiveHandler) {
    case 'direct-text':
      return new TextDecoder().decode(bytes);
      
    case 'claude-extract':
      return await extractWithClaude(bytes, lowerFilename, anthropicKey);
      
    case 'claude-vision':
      return await analyzeImageWithClaude(bytes, lowerFilename, anthropicKey);
      
    case 'csv-parse':
      return parseCSV(new TextDecoder().decode(bytes), filename);
      
    case 'xlsx-parse':
      // For XLSX, we'll extract it as text representation
      return await extractSpreadsheetAsText(bytes, filename);
      
    default:
      // Fallback: try text decode or Claude
      if (isTextFile(lowerFilename)) {
        return new TextDecoder().decode(bytes);
      }
      return await extractWithClaude(bytes, lowerFilename, anthropicKey);
  }
}

function getHandlerFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const handlerMap: Record<string, string> = {
    // Documents
    'pdf': 'claude-extract',
    'docx': 'claude-extract',
    'pptx': 'claude-extract',
    // Text
    'txt': 'direct-text',
    'md': 'direct-text',
    'json': 'direct-text',
    'yaml': 'direct-text',
    'yml': 'direct-text',
    // Code
    'py': 'direct-text',
    'js': 'direct-text',
    'jsx': 'direct-text',
    'ts': 'direct-text',
    'tsx': 'direct-text',
    'java': 'direct-text',
    'c': 'direct-text',
    'cpp': 'direct-text',
    'h': 'direct-text',
    'html': 'direct-text',
    'css': 'direct-text',
    'sql': 'direct-text',
    'sh': 'direct-text',
    'go': 'direct-text',
    'rs': 'direct-text',
    'rb': 'direct-text',
    'php': 'direct-text',
    // Data
    'csv': 'csv-parse',
    'xlsx': 'xlsx-parse',
    'xls': 'xlsx-parse',
    // Images
    'png': 'claude-vision',
    'jpg': 'claude-vision',
    'jpeg': 'claude-vision',
    'webp': 'claude-vision',
    'gif': 'claude-vision',
  };
  return handlerMap[ext] || 'direct-text';
}

function isTextFile(filename: string): boolean {
  const textExtensions = ['txt', 'md', 'json', 'yaml', 'yml', 'xml', 'py', 'js', 'ts', 'jsx', 'tsx', 'java', 'c', 'cpp', 'h', 'html', 'css', 'sql', 'sh', 'go', 'rs', 'rb', 'php'];
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return textExtensions.includes(ext);
}

// Use Claude's document capability for PDF/DOCX/PPTX extraction
async function extractWithClaude(bytes: Uint8Array, filename: string, anthropicKey: string): Promise<string> {
  const base64 = uint8ArrayToBase64(bytes);
  
  let mediaType = "application/pdf";
  if (filename.endsWith('.docx')) {
    mediaType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  } else if (filename.endsWith('.pptx')) {
    mediaType = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }

  console.log(`Sending ${filename} to Claude for extraction (media_type: ${mediaType})...`);

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 16000,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: "Extract ALL text content from this document. Preserve structure with headings, paragraphs, and bullet points. Return only the extracted text content, no commentary or explanations.",
          },
        ],
      }],
    }),
  });

  const claudeData = await claudeResponse.json();
  
  if (claudeData.error) {
    console.error("Claude extraction error:", claudeData.error);
    throw new Error(`Claude extraction failed: ${claudeData.error.message}`);
  }
  
  const extractedText = claudeData.content?.[0]?.text || "";
  console.log(`Claude extracted ${extractedText.length} characters`);
  
  return extractedText;
}

// Analyze images with Claude Vision
async function analyzeImageWithClaude(bytes: Uint8Array, filename: string, anthropicKey: string): Promise<string> {
  const base64 = uint8ArrayToBase64(bytes);
  
  const ext = filename.split('.').pop()?.toLowerCase() || 'png';
  const mediaTypeMap: Record<string, string> = {
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'webp': 'image/webp',
    'gif': 'image/gif',
  };
  const mediaType = mediaTypeMap[ext] || 'image/png';

  console.log(`Analyzing image ${filename} with Claude Vision...`);

  const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [{
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: base64 },
          },
          {
            type: "text",
            text: `Analyze this image comprehensively. Describe:
1. What the image contains (objects, people, scenes, text)
2. Any text visible in the image (transcribe it exactly)
3. Data, charts, or diagrams (describe the data and any insights)
4. Context and relevant details

Provide a detailed description that captures all important information from this image.`,
          },
        ],
      }],
    }),
  });

  const claudeData = await claudeResponse.json();
  
  if (claudeData.error) {
    console.error("Claude Vision error:", claudeData.error);
    throw new Error(`Claude Vision failed: ${claudeData.error.message}`);
  }
  
  const analysis = claudeData.content?.[0]?.text || "";
  console.log(`Claude Vision analyzed image: ${analysis.length} characters`);
  
  // Wrap the analysis with metadata
  return `[Image: ${filename}]\n\n${analysis}`;
}

// Parse CSV as structured text
function parseCSV(content: string, filename: string): string {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) return '';
  
  // Detect delimiter (comma, tab, semicolon)
  const firstLine = lines[0];
  const delimiters = [',', '\t', ';'];
  let delimiter = ',';
  let maxCount = 0;
  for (const d of delimiters) {
    const count = (firstLine.match(new RegExp(d === '\t' ? '\\t' : d, 'g')) || []).length;
    if (count > maxCount) {
      maxCount = count;
      delimiter = d;
    }
  }
  
  const parseRow = (row: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < row.length; i++) {
      const char = row[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === delimiter && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  };
  
  const headers = parseRow(lines[0]);
  const rows = lines.slice(1).map(parseRow);
  
  // Create a readable text representation
  let output = `[CSV Data: ${filename}]\n\n`;
  output += `Columns: ${headers.join(', ')}\n`;
  output += `Total Rows: ${rows.length}\n\n`;
  
  // Include sample data and full content for searchability
  const maxRowsToInclude = Math.min(rows.length, 500); // Limit for very large files
  
  for (let i = 0; i < maxRowsToInclude; i++) {
    const row = rows[i];
    output += `Row ${i + 1}:\n`;
    headers.forEach((header, idx) => {
      output += `  ${header}: ${row[idx] || ''}\n`;
    });
    output += '\n';
  }
  
  if (rows.length > maxRowsToInclude) {
    output += `\n... and ${rows.length - maxRowsToInclude} more rows\n`;
  }
  
  return output;
}

// Extract spreadsheet as text (simplified - for full XLSX would need xlsx library)
async function extractSpreadsheetAsText(bytes: Uint8Array, filename: string): Promise<string> {
  // For XLSX files, we'll try to extract any readable text
  // A full implementation would use a library like xlsx
  const textDecoder = new TextDecoder('utf-8', { fatal: false });
  const rawText = textDecoder.decode(bytes);
  
  // XLSX files are ZIP archives with XML inside
  // Try to extract visible strings
  const stringMatches = rawText.match(/(?:<t[^>]*>([^<]+)<\/t>)/g) || [];
  const extractedStrings = stringMatches
    .map(match => match.replace(/<\/?t[^>]*>/g, ''))
    .filter(s => s.trim().length > 0);
  
  if (extractedStrings.length > 0) {
    return `[Spreadsheet: ${filename}]\n\nExtracted content:\n${extractedStrings.join('\n')}`;
  }
  
  return `[Spreadsheet: ${filename}]\n\nNote: Could not extract text from this spreadsheet. Please convert to CSV for better results.`;
}

// Chunk text into smaller pieces with overlap
function chunkText(text: string, originalSize: number): DocumentChunk[] {
  const chunks: DocumentChunk[] = [];
  const paragraphs = text.split(/\n\n+/);
  
  let currentChunk = '';
  let charStart = 0;
  let currentCharPos = 0;
  
  for (const paragraph of paragraphs) {
    const trimmedParagraph = paragraph.trim();
    if (!trimmedParagraph) {
      currentCharPos += paragraph.length + 2;
      continue;
    }
    
    if (currentChunk.length + trimmedParagraph.length > CHUNK_SIZE) {
      if (currentChunk.trim()) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            char_start: charStart,
            char_end: currentCharPos,
            original_size: originalSize,
          },
        });
      }
      
      const overlapStart = Math.max(0, currentChunk.length - CHUNK_OVERLAP);
      const overlap = currentChunk.slice(overlapStart);
      currentChunk = overlap + (overlap ? ' ' : '') + trimmedParagraph;
      charStart = currentCharPos - (currentChunk.length - trimmedParagraph.length - 1);
    } else {
      currentChunk += (currentChunk ? '\n\n' : '') + trimmedParagraph;
    }
    
    currentCharPos += paragraph.length + 2;
  }
  
  if (currentChunk.trim()) {
    chunks.push({
      content: currentChunk.trim(),
      metadata: {
        char_start: charStart,
        char_end: currentCharPos,
        original_size: originalSize,
      },
    });
  }
  
  if (chunks.length === 0 && text.trim()) {
    chunks.push({
      content: text.trim(),
      metadata: {
        char_start: 0,
        char_end: text.length,
        original_size: originalSize,
      },
    });
  }
  
  return chunks;
}

// Generate embeddings for a single batch using OpenAI
async function generateEmbeddingsBatch(texts: string[], openaiApiKey: string): Promise<number[][]> {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small', // Faster than ada-002
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

// Generate embeddings in parallel batches
async function generateEmbeddingsParallel(
  chunks: DocumentChunk[],
  openaiApiKey: string,
  supabase: any,
  jobId: string | null
): Promise<number[][]> {
  const texts = chunks.map(c => c.content);
  
  // Create batches
  const batches: string[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    batches.push(texts.slice(i, i + EMBEDDING_BATCH_SIZE));
  }
  
  const embeddings: number[][] = [];
  const totalBatches = batches.length;
  
  // Process batches in parallel groups
  for (let i = 0; i < batches.length; i += CONCURRENT_BATCHES) {
    const concurrentBatches = batches.slice(i, i + CONCURRENT_BATCHES);
    const batchGroupNum = Math.floor(i / CONCURRENT_BATCHES) + 1;
    const totalGroups = Math.ceil(batches.length / CONCURRENT_BATCHES);
    
    console.log(`Processing batch group ${batchGroupNum}/${totalGroups} (${concurrentBatches.length} batches in parallel)`);
    
    const results = await Promise.all(
      concurrentBatches.map(batch => generateEmbeddingsBatch(batch, openaiApiKey))
    );
    
    results.forEach(result => {
      embeddings.push(...result);
    });
    
    // Update progress (60-90% range for embedding)
    if (jobId && supabase) {
      const completedBatches = Math.min(i + CONCURRENT_BATCHES, batches.length);
      const embeddingProgress = 60 + Math.round((completedBatches / totalBatches) * 30);
      await updateJobStatus(supabase, jobId, 'embedding', embeddingProgress);
    }
  }
  
  return embeddings;
}

// Get file extension
function getFileExtension(filename: string): string {
  const parts = filename.split('.');
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : '';
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  const startTime = Date.now();
  let jobId: string | null = null;
  let supabase: any = null;
  
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
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY');
    
    if (!openaiApiKey) throw new Error('OPENAI_API_KEY is not configured');
    if (!anthropicKey) throw new Error('ANTHROPIC_API_KEY is not configured');
    
    supabase = createClient(supabaseUrl, supabaseKey);
    
    // Get user from JWT
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Parse request - support both job-based (JSON) and legacy (FormData) modes
    const contentType = req.headers.get('content-type') || '';
    let file: File | null = null;
    let conversationId: string | null = null;
    let storagePath: string | null = null;
    let handler: string | null = null;
    
    if (contentType.includes('application/json')) {
      // New job-based mode: download file from storage
      const body = await req.json();
      jobId = body.job_id;
      storagePath = body.storage_path;
      conversationId = body.conversation_id;
      handler = body.handler;
      
      if (!jobId || !storagePath) {
        return new Response(
          JSON.stringify({ error: 'Missing job_id or storage_path' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log(`[Job ${jobId}] Starting processing for: ${storagePath}`);
      await updateJobStatus(supabase, jobId, 'extracting', 35, { started_at: new Date().toISOString() });
      
      // Download file from storage
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(storagePath);
      
      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message || 'Unknown error'}`);
      }
      
      const filename = storagePath.split('/').pop() || 'unknown';
      file = new File([fileData], filename, { type: fileData.type });
      
    } else {
      // Legacy FormData mode (for backward compatibility)
      const formData = await req.formData();
      file = formData.get('file') as File | null;
      conversationId = formData.get('conversation_id') as string | null;
      handler = formData.get('handler') as string | null;
    }
    
    if (!file) {
      return new Response(
        JSON.stringify({ error: 'No file provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Processing file: ${file.name}, size: ${file.size} bytes`);
    
    // Validate file type
    const filename = file.name.toLowerCase();
    const fileType = getFileExtension(filename);
    const validExtensions = [
      // Documents
      'txt', 'md', 'pdf', 'docx', 'pptx',
      // Data
      'csv', 'xlsx', 'xls', 'json', 'yaml', 'yml', 'xml',
      // Code
      'py', 'js', 'jsx', 'ts', 'tsx', 'java', 'c', 'cpp', 'h', 'hpp',
      'html', 'css', 'scss', 'sql', 'sh', 'go', 'rs', 'rb', 'php', 'swift', 'kt',
      // Images
      'png', 'jpg', 'jpeg', 'webp', 'gif',
    ];
    
    if (!validExtensions.includes(fileType)) {
      const error = `Unsupported file type: .${fileType}`;
      if (jobId) await updateJobStatus(supabase, jobId, 'failed', 0, { error_message: error });
      return new Response(
        JSON.stringify({ error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Extract text from document
    console.log('Extracting text from document...');
    if (jobId) await updateJobStatus(supabase, jobId, 'extracting', 45);
    
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    const text = await extractText(bytes, file.name, handler, anthropicKey);
    
    if (!text || text.trim().length < 50) {
      const error = 'Could not extract sufficient text from document (minimum 50 characters)';
      if (jobId) await updateJobStatus(supabase, jobId, 'failed', 0, { error_message: error });
      return new Response(
        JSON.stringify({ error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    console.log(`Extracted ${text.length} characters`);
    if (jobId) await updateJobStatus(supabase, jobId, 'extracting', 55);
    
    // Chunk the text
    console.log('Chunking text...');
    const chunks = chunkText(text, file.size);
    console.log(`Created ${chunks.length} chunks`);
    
    if (chunks.length === 0) {
      const error = 'No chunks created from document';
      if (jobId) await updateJobStatus(supabase, jobId, 'failed', 0, { error_message: error });
      return new Response(
        JSON.stringify({ error }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Generate embeddings in parallel batches
    console.log('Generating embeddings...');
    if (jobId) await updateJobStatus(supabase, jobId, 'embedding', 60);
    
    const allEmbeddings = await generateEmbeddingsParallel(chunks, openaiApiKey, supabase, jobId);
    
    // Prepare records for insertion
    const records = chunks.map((chunk, index) => ({
      user_id: user.id,
      conversation_id: conversationId || null,
      filename: file!.name,
      file_type: fileType,
      chunk_index: index,
      content: chunk.content,
      embedding: JSON.stringify(allEmbeddings[index]),
      token_count: Math.ceil(chunk.content.length / 4),
      metadata: chunk.metadata,
    }));
    
    // Insert chunks into database
    console.log('Storing chunks in database...');
    if (jobId) await updateJobStatus(supabase, jobId, 'embedding', 95);
    
    const { error: insertError } = await supabase
      .from('document_chunks')
      .insert(records);
    
    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error(`Failed to store chunks: ${insertError.message}`);
    }
    
    const processingTime = Date.now() - startTime;
    console.log(`Successfully processed ${file.name} in ${processingTime}ms`);
    
    // Mark job as complete
    if (jobId) {
      await updateJobStatus(supabase, jobId, 'complete', 100, {
        chunks_created: chunks.length,
        processing_time_ms: processingTime,
        completed_at: new Date().toISOString(),
      });
    }
    
    return new Response(
      JSON.stringify({
        success: true,
        chunks_created: chunks.length,
        filename: file.name,
        file_type: fileType,
        total_characters: text.length,
        conversation_id: conversationId,
        processing_time_ms: processingTime,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
    
  } catch (error) {
    console.error('Error in embed-document:', error);
    
    // Mark job as failed if we have a job ID
    if (jobId && supabase) {
      await updateJobStatus(supabase, jobId, 'failed', 0, {
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString(),
      });
    }
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
