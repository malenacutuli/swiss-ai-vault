// Generate synthetic training data from various sources
// Uses Claude to create QA pairs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Synthetic data pricing: $0.002 per Q&A pair
const COST_PER_PAIR = 0.002;

interface SyntheticSource {
  type: "text" | "url" | "youtube" | "file" | "files";
  content?: string;
  path?: string;      // For single file source - storage path
  filename?: string;  // For single file source - original filename
  filePaths?: string[]; // For multiple files source
}

interface SyntheticConfig {
  num_pairs: number;
  system_prompt?: string;
  rules?: string[];
  examples?: Array<{ question: string; answer: string }>;
  question_format?: string;
  answer_format?: string;
}

interface TemplateRequest {
  dataset_id: string;
  template_mode: true;
  template_id: string;
  num_examples: number;
  variation: "low" | "medium" | "high";
  topics?: string[];
  language: string;
  language_code: string;
  domain: string;
  system_prompt?: string;
  sample_conversations?: Array<{ messages: Array<{ role: string; content: string }> }>;
}

interface SyntheticRequest {
  dataset_id: string;
  template_mode?: false;
  sources: SyntheticSource[];
  config: SyntheticConfig;
}

type RequestBody = TemplateRequest | SyntheticRequest;

interface ProcessingResult {
  source: string;
  contentLength: number;
  success: boolean;
  error?: string;
}

// Extract text content from file based on extension
function extractTextFromContent(content: string, filename?: string): string {
  // Check if content has a [File: xxx] prefix from frontend
  const fileMatch = content.match(/^\[File: ([^\]]+)\]\n\n([\s\S]*)$/);
  if (fileMatch) {
    const extractedFilename = fileMatch[1];
    const fileContent = fileMatch[2];
    console.log(`Processing file content for: ${extractedFilename}, ${fileContent.length} chars`);
    
    // Clean up the content based on detected file type
    const ext = extractedFilename.split('.').pop()?.toLowerCase();
    
    if (ext === 'html' || ext === 'htm') {
      // Strip HTML tags
      return fileContent
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
    
    if (ext === 'md') {
      // Simple markdown cleanup - keep most content
      return fileContent
        .replace(/```[\s\S]*?```/g, '[code block]')  // Replace code blocks
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')     // Convert links to text
        .replace(/[#*_`]/g, '')                       // Remove markdown chars
        .trim();
    }
    
    // For txt and other text files, return as-is
    return fileContent.trim();
  }
  
  // No file prefix, return content as-is
  return content;
}

// Download file from storage and get base64 for Claude document processing
async function downloadFileFromStorage(
  supabase: SupabaseClient<any, any, any>,
  filePath: string,
  filename: string
): Promise<{ base64: string; mimeType: string; isText: boolean; textContent?: string }> {
  console.log(`Downloading file from storage: ${filePath}`);
  
  const { data, error } = await supabase.storage
    .from('datasets')
    .download(filePath);
  
  if (error) {
    throw new Error(`Failed to download file ${filename}: ${error.message}`);
  }
  
  const ext = filename.split('.').pop()?.toLowerCase();
  
  // Map extensions to MIME types for Claude
  const mimeTypeMap: Record<string, string> = {
    'pdf': 'application/pdf',
    'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'txt': 'text/plain',
    'md': 'text/markdown',
    'html': 'text/html',
    'htm': 'text/html',
    'csv': 'text/csv',
    'json': 'application/json',
    'xml': 'text/xml',
  };
  
  const mimeType = mimeTypeMap[ext || ''] || 'application/octet-stream';
  
  // Handle text-based files - read as text
  if (['txt', 'md', 'html', 'htm', 'csv', 'json', 'xml'].includes(ext || '')) {
    const text = await data.text();
    console.log(`Read ${text.length} chars from text file ${filename}`);
    return { 
      base64: '', 
      mimeType, 
      isText: true, 
      textContent: extractTextFromContent(text, filename) 
    };
  }
  
  // For binary formats (PDF, DOCX, PPTX), convert to base64 for Claude
  if (['pdf', 'docx', 'pptx', 'xlsx'].includes(ext || '')) {
    const arrayBuffer = await data.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = btoa(binary);
    console.log(`Converted ${filename} to base64: ${base64.length} chars`);
    return { base64, mimeType, isText: false };
  }
  
  throw new Error(`Unsupported file type: ${ext}`);
}

// Use Claude to extract text from a document
async function extractTextWithClaude(
  anthropicKey: string,
  base64Content: string,
  mimeType: string,
  filename: string
): Promise<string> {
  console.log(`Using Claude Haiku to extract text from ${filename} (${mimeType})`);
  
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",  // Fast model for extraction (10x faster than Sonnet)
      max_tokens: 8192,
      messages: [{
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: mimeType,
              data: base64Content,
            },
          },
          {
            type: "text",
            text: `Extract ALL the text content from this document. Return ONLY the extracted text, preserving the structure and formatting as much as possible. Do not add any commentary or explanation - just the document's text content.`,
          },
        ],
      }],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error(`Claude document extraction failed: ${response.status} - ${errorText}`);
    throw new Error(`Failed to extract text from ${filename}: ${response.status}`);
  }

  const data = await response.json();
  const extractedText = data.content?.[0]?.text || '';
  console.log(`Claude extracted ${extractedText.length} chars from ${filename}`);
  return extractedText;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let dataset_id: string | null = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let supabase: SupabaseClient<any, any, any> | null = null;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    
    if (!anthropicKey) {
      throw new Error("ANTHROPIC_API_KEY is not configured");
    }
    
    supabase = createClient(supabaseUrl, supabaseKey);

    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user } } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as RequestBody;
    dataset_id = body.dataset_id;

    if (!dataset_id) {
      return new Response(JSON.stringify({ error: "dataset_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if this is a template-based generation
    if (body.template_mode === true) {
      const templateBody = body as TemplateRequest;
      console.log(`Template mode: generating ${templateBody.num_examples} examples from template ${templateBody.template_id}`);
      
      const numPairs = templateBody.num_examples || 50;
      const creditCost = numPairs * COST_PER_PAIR;
      
      // Deduct credits
      const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits', {
        p_user_id: user.id,
        p_amount: creditCost,
        p_service_type: 'SYNTHETIC_DATA',
        p_description: `Template dataset: ${numPairs} examples (${templateBody.language})`,
        p_metadata: { dataset_id, template_id: templateBody.template_id, num_examples: numPairs }
      });

      if (deductError) {
        console.error("Error calling deduct_credits:", deductError);
        return new Response(
          JSON.stringify({ error: "Failed to process payment", details: deductError.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if (!deductResult?.success) {
        console.log("Credit deduction failed:", deductResult);
        return new Response(
          JSON.stringify({ 
            error: deductResult?.message || "Insufficient credits",
            error_code: deductResult?.error,
            current_balance: deductResult?.current_balance,
            required: deductResult?.required || creditCost
          }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update dataset status
      await supabase.from("datasets").update({ status: "processing" }).eq("id", dataset_id);

      // Build prompt for template-based generation
      const variationInstructions = {
        low: "Stay very close to the example style and structure. Vary only the specific details.",
        medium: "Follow the general style but introduce moderate variety in phrasing and scenarios.",
        high: "Be creative with scenarios and phrasing while maintaining the core domain and language style."
      };

      const topicsInstruction = templateBody.topics && templateBody.topics.length > 0
        ? `Focus on these specific topics: ${templateBody.topics.join(", ")}`
        : "";

      const sampleConversationsText = templateBody.sample_conversations
        ? templateBody.sample_conversations.slice(0, 3).map((conv, i) => {
            return `Example ${i + 1}:\n${conv.messages.map(m => `${m.role}: ${m.content}`).join("\n")}`;
          }).join("\n\n")
        : "";

      const systemPromptForGeneration = `You are an expert at creating high-quality training data for AI fine-tuning.
Generate realistic ${templateBody.language} conversations for the ${templateBody.domain} domain.

Language: ${templateBody.language} (${templateBody.language_code})
Domain: ${templateBody.domain}
System prompt to use: ${templateBody.system_prompt || "You are a helpful assistant."}

${variationInstructions[templateBody.variation]}
${topicsInstruction}

${sampleConversationsText ? `Reference examples to learn the style:\n\n${sampleConversationsText}` : ""}

CRITICAL: All generated content MUST be in ${templateBody.language}. Do not mix languages.
Output format: Return a JSON array of conversation objects. Each object should have a "messages" array with objects containing "role" (system/user/assistant) and "content" fields.`;

      const userPromptForGeneration = `Generate exactly ${numPairs} diverse and realistic ${templateBody.language} conversations for the ${templateBody.domain} domain.

Each conversation should:
1. Start with a system message using this prompt: "${templateBody.system_prompt || 'You are a helpful assistant.'}"
2. Include a realistic user query in ${templateBody.language}
3. Include a helpful, professional assistant response in ${templateBody.language}

Return as a JSON array: [{"messages": [{"role": "system", "content": "..."}, {"role": "user", "content": "..."}, {"role": "assistant", "content": "..."}]}, ...]`;

      console.log("Calling Claude for template-based generation...");
      
      const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "x-api-key": anthropicKey,
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 8192,
          system: systemPromptForGeneration,
          messages: [{ role: "user", content: userPromptForGeneration }],
        }),
      });

      const claudeData = await claudeResponse.json();
      const responseText = claudeData.content?.[0]?.text || "[]";

      console.log("Claude response received, parsing...");

      // Parse generated conversations
      let conversations: Array<{ messages: Array<{ role: string; content: string }> }>;
      try {
        const jsonMatch = responseText.match(/\[[\s\S]*\]/);
        conversations = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch (e) {
        console.error("Failed to parse Claude response:", e);
        conversations = [];
      }

      if (conversations.length === 0) {
        await supabase.from("datasets").update({ 
          status: "error",
          error_message: "Failed to generate conversations from template"
        }).eq("id", dataset_id);

        return new Response(
          JSON.stringify({ error: "no_conversations_generated", message: "Failed to generate conversations" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Convert to JSONL format
      const jsonlContent = conversations.map(conv => JSON.stringify(conv)).join("\n");

      // Upload to storage
      const filePath = `${user.id}/${dataset_id}/template-generated.jsonl`;
      const { error: uploadError } = await supabase.storage
        .from("datasets")
        .upload(filePath, new Blob([jsonlContent], { type: "application/jsonl" }), { upsert: true });

      if (uploadError) {
        throw new Error(`Upload failed: ${uploadError.message}`);
      }

      // Calculate tokens
      const totalTokens = Math.ceil(jsonlContent.length / 4);
      const avgConversationLength = 3;

      // Update dataset record
      await supabase.from("datasets").update({
        status: "ready",
        s3_path: filePath,
        row_count: conversations.length,
        total_tokens: totalTokens,
        avg_conversation_length: avgConversationLength,
      }).eq("id", dataset_id);

      // Create initial snapshot
      const trainRowCount = Math.floor(conversations.length * 0.9);
      const valRowCount = conversations.length - trainRowCount;

      const { data: dataset } = await supabase
        .from("datasets")
        .select("name")
        .eq("id", dataset_id)
        .single();

      await supabase.from("dataset_snapshots").insert({
        dataset_id: dataset_id,
        name: `${dataset?.name || 'Dataset'} v1`,
        version: 1,
        row_count: conversations.length,
        train_split_pct: 0.9,
        train_row_count: trainRowCount,
        val_row_count: valRowCount,
        s3_path: filePath,
      });

      console.log(`Template dataset generated: ${conversations.length} conversations, ${totalTokens} tokens`);

      return new Response(
        JSON.stringify({
          success: true,
          row_count: conversations.length,
          total_tokens: totalTokens,
          credits_charged: creditCost,
          transaction_id: deductResult.transaction_id,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Regular source-based generation (existing logic)
    const syntheticBody = body as SyntheticRequest;
    const { sources, config } = syntheticBody;
    const numPairs = config.num_pairs || 10;
    
    // Calculate credit cost
    const creditCost = numPairs * COST_PER_PAIR;
    console.log(`Deducting ${creditCost} credits for ${numPairs} Q&A pairs`);

    // Deduct credits before generating
    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits', {
      p_user_id: user.id,
      p_amount: creditCost,
      p_service_type: 'SYNTHETIC_DATA',
      p_description: `Synthetic data: ${numPairs} Q&A pairs`,
      p_metadata: { dataset_id: dataset_id, num_pairs: numPairs }
    });

    if (deductError) {
      console.error("Error calling deduct_credits:", deductError);
      return new Response(
        JSON.stringify({ error: "Failed to process payment", details: deductError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!deductResult?.success) {
      console.log("Credit deduction failed:", deductResult);
      return new Response(
        JSON.stringify({ 
          error: deductResult?.message || "Insufficient credits",
          error_code: deductResult?.error,
          current_balance: deductResult?.current_balance,
          required: deductResult?.required || creditCost
        }),
        { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Credits deducted successfully. Transaction ID: ${deductResult.transaction_id}`);
    console.log("Generating synthetic data for dataset:", dataset_id);

    // Update dataset status to processing
    await supabase
      .from("datasets")
      .update({ status: "processing" })
      .eq("id", dataset_id);

    // Extract content from sources
    let combinedContent = "";
    
    // URL validation to prevent SSRF attacks
    function isAllowedUrl(url: string): boolean {
      try {
        const parsed = new URL(url);
        const hostname = parsed.hostname.toLowerCase();
        
        // Block private IPs and internal domains
        if (hostname === 'localhost' || 
            hostname === '127.0.0.1' ||
            hostname.startsWith('192.168.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.16.') ||
            hostname.startsWith('172.17.') ||
            hostname.startsWith('172.18.') ||
            hostname.startsWith('172.19.') ||
            hostname.startsWith('172.20.') ||
            hostname.startsWith('172.21.') ||
            hostname.startsWith('172.22.') ||
            hostname.startsWith('172.23.') ||
            hostname.startsWith('172.24.') ||
            hostname.startsWith('172.25.') ||
            hostname.startsWith('172.26.') ||
            hostname.startsWith('172.27.') ||
            hostname.startsWith('172.28.') ||
            hostname.startsWith('172.29.') ||
            hostname.startsWith('172.30.') ||
            hostname.startsWith('172.31.') ||
            hostname === '169.254.169.254' ||
            hostname.endsWith('.local') ||
            hostname.endsWith('.internal')) {
          return false;
        }
        
        // Only allow https for security
        if (parsed.protocol !== 'https:') {
          return false;
        }
        
        return true;
      } catch {
        return false;
      }
    }

    const processingResults: ProcessingResult[] = [];
    
    for (const source of sources) {
      const sourceId = source.filename || source.path || source.content?.substring(0, 50) || 'unknown';
      console.log(`Processing source type: ${source.type}, id: ${sourceId.substring(0, 100)}...`);
      
      try {
        if (source.type === "text" && source.content) {
          // Handle text content (including inline file content from frontend)
          const extractedContent = extractTextFromContent(source.content, source.filename);
          if (extractedContent.length > 0) {
            combinedContent += `\n\n--- Source: ${source.filename || 'Text Input'} ---\n${extractedContent}\n\n`;
            processingResults.push({ source: sourceId, contentLength: extractedContent.length, success: true });
            console.log(`Text source processed: ${extractedContent.length} chars`);
          }
        } else if (source.type === "file" && source.path) {
          // Handle single file source from storage - use Claude for binary files
          try {
            const fileData = await downloadFileFromStorage(supabase, source.path, source.filename || 'file');
            let fileContent: string;
            
            if (fileData.isText && fileData.textContent) {
              // Text file - use extracted content directly
              fileContent = fileData.textContent;
            } else {
              // Binary file (PDF, DOCX, etc.) - use Claude to extract text
              fileContent = await extractTextWithClaude(
                anthropicKey,
                fileData.base64,
                fileData.mimeType,
                source.filename || 'file'
              );
            }
            
            if (fileContent.length > 0) {
              combinedContent += `\n\n--- Source: ${source.filename || source.path} ---\n${fileContent}\n\n`;
              processingResults.push({ source: source.filename || source.path, contentLength: fileContent.length, success: true });
              console.log(`File source processed: ${fileContent.length} chars from ${source.filename}`);
            }
          } catch (fileErr) {
            const errMsg = fileErr instanceof Error ? fileErr.message : 'Unknown error';
            console.error(`Failed to process file ${source.filename}:`, errMsg);
            processingResults.push({ source: source.filename || source.path, contentLength: 0, success: false, error: errMsg });
          }
        } else if (source.type === "files" && source.filePaths) {
          // Handle multiple files source - process in PARALLEL with batching
          console.log(`[generate-synthetic] Processing ${source.filePaths.length} files in parallel`);
          
          const BATCH_SIZE = 3; // Process 3 files concurrently to avoid rate limits
          const startTime = Date.now();
          
          // Helper function to process a single file
          async function processFileParallel(filePath: string): Promise<{ success: boolean; content: string; fileName: string; error?: string }> {
            const fileName = filePath.split('/').pop() || 'file';
            console.log(`[generate-synthetic] Starting extraction for: ${fileName}`);
            
            try {
              const fileData = await downloadFileFromStorage(supabase!, filePath, fileName);
              let fileContent: string;
              
              if (fileData.isText && fileData.textContent) {
                fileContent = fileData.textContent;
              } else {
                fileContent = await extractTextWithClaude(
                  anthropicKey!,
                  fileData.base64,
                  fileData.mimeType,
                  fileName
                );
              }
              
              console.log(`[generate-synthetic] Extracted ${fileContent.length} chars from ${fileName}`);
              return { success: true, content: fileContent, fileName };
            } catch (err) {
              const errMsg = err instanceof Error ? err.message : 'Unknown error';
              console.error(`[generate-synthetic] Error processing ${fileName}:`, errMsg);
              return { success: false, content: '', fileName, error: errMsg };
            }
          }
          
          // Process files in parallel batches
          for (let i = 0; i < source.filePaths.length; i += BATCH_SIZE) {
            const batch = source.filePaths.slice(i, i + BATCH_SIZE);
            console.log(`[generate-synthetic] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} files`);
            
            // Check if we're running low on time (leave 20s for Q&A generation)
            const elapsed = Date.now() - startTime;
            if (elapsed > 40000) {
              console.warn(`[generate-synthetic] Approaching timeout (${elapsed}ms elapsed), stopping file processing`);
              break;
            }
            
            // Process batch in parallel
            const results = await Promise.allSettled(batch.map(processFileParallel));
            
            for (const result of results) {
              if (result.status === 'fulfilled' && result.value.success) {
                combinedContent += `\n\n--- Source: ${result.value.fileName} ---\n${result.value.content}\n\n`;
                processingResults.push({ source: result.value.fileName, contentLength: result.value.content.length, success: true });
              } else if (result.status === 'fulfilled' && !result.value.success) {
                processingResults.push({ source: result.value.fileName, contentLength: 0, success: false, error: result.value.error });
              } else if (result.status === 'rejected') {
                console.error(`[generate-synthetic] Batch item failed:`, result.reason);
              }
            }
          }
          
          console.log(`[generate-synthetic] Extracted content from files in ${Date.now() - startTime}ms`);
        } else if (source.type === "url" && source.content) {
          // Validate URL to prevent SSRF
          if (!isAllowedUrl(source.content)) {
            console.warn(`Blocked potentially unsafe URL: ${source.content}`);
            processingResults.push({ source: source.content, contentLength: 0, success: false, error: 'URL blocked for security' });
            continue;
          }
          
          // Fetch URL content
          try {
            const response = await fetch(source.content, {
              headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SwissVaultBot/1.0)' }
            });
            const html = await response.text();
            // Simple HTML to text extraction
            const text = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
              .replace(/<[^>]+>/g, " ")
              .replace(/\s+/g, " ")
              .trim();
            const urlContent = text.substring(0, 10000);
            combinedContent += `\n\n--- Source: ${source.content} ---\n${urlContent}\n\n`;
            processingResults.push({ source: source.content, contentLength: urlContent.length, success: true });
            console.log(`URL content fetched: ${urlContent.length} chars`);
          } catch (e) {
            console.error("Failed to fetch URL:", e);
            processingResults.push({ source: source.content, contentLength: 0, success: false, error: 'Failed to fetch URL' });
          }
        } else if (source.type === "youtube" && source.content) {
          // Extract video ID from YouTube URL
          const videoIdMatch = source.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
          if (videoIdMatch) {
            const videoId = videoIdMatch[1];
            console.log(`Extracting content for YouTube video: ${videoId}`);
            
            let videoTitle = '';
            let videoAuthor = '';
            let transcriptContent = '';
            
            // Step 1: Get video metadata via oEmbed
            try {
              const oembedResponse = await fetch(
                `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
              );
              
              if (oembedResponse.ok) {
                const oembedData = await oembedResponse.json();
                videoTitle = oembedData.title || '';
                videoAuthor = oembedData.author_name || '';
                console.log(`YouTube metadata: "${videoTitle}" by ${videoAuthor}`);
              }
            } catch (e) {
              console.log("oEmbed fetch failed:", e);
            }
            
            // Step 2: Try multiple transcript APIs
            // API 1: yt.lemnoslife.com
            try {
              console.log(`Trying transcript API 1: yt.lemnoslife.com for ${videoId}`);
              const transcriptResponse = await fetch(
                `https://yt.lemnoslife.com/noKey/captions?videoId=${videoId}&lang=en`,
                { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SwissVaultBot/1.0)' } }
              );
              
              if (transcriptResponse.ok) {
                const transcriptData = await transcriptResponse.json();
                if (transcriptData?.captions?.length > 0) {
                  transcriptContent = transcriptData.captions
                    .map((c: { text: string }) => c.text)
                    .join(' ')
                    .substring(0, 15000);
                  console.log(`API 1 success: Got ${transcriptContent.length} chars of transcript`);
                }
              }
            } catch (e) {
              console.log("API 1 (yt.lemnoslife.com) failed:", e);
            }
            
            // API 2: youtubetranscript.com (if API 1 failed)
            if (!transcriptContent) {
              try {
                console.log(`Trying transcript API 2: youtubetranscript.com for ${videoId}`);
                const transcriptResponse = await fetch(
                  `https://youtubetranscript.com/?server_vid2=${videoId}`,
                  { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SwissVaultBot/1.0)' } }
                );
                
                if (transcriptResponse.ok) {
                  const html = await transcriptResponse.text();
                  const textMatch = html.match(/<text[^>]*>([^<]+)<\/text>/g);
                  if (textMatch && textMatch.length > 0) {
                    transcriptContent = textMatch
                      .map(t => t.replace(/<[^>]+>/g, '').trim())
                      .join(' ')
                      .substring(0, 15000);
                    console.log(`API 2 success: Got ${transcriptContent.length} chars of transcript`);
                  }
                }
              } catch (e) {
                console.log("API 2 (youtubetranscript.com) failed:", e);
              }
            }
            
            // Build content from what we gathered
            let ytContent = '';
            
            if (videoTitle) {
              ytContent += `YouTube Video: "${videoTitle}"`;
              if (videoAuthor) {
                ytContent += ` by ${videoAuthor}`;
              }
              ytContent += '\n\n';
            }
            
            if (transcriptContent) {
              ytContent += `Transcript:\n${transcriptContent}\n\n`;
            }
            
            const contentLength = ytContent.length;
            console.log(`YouTube source "${videoId}": extracted ${contentLength} chars`);
            
            if (contentLength > 0) {
              combinedContent += `\n\n--- Source: YouTube ${videoId} ---\n${ytContent}`;
              processingResults.push({ source: `YouTube: ${videoId}`, contentLength, success: true });
            } else {
              console.warn(`No content extracted for video ${videoId}`);
              processingResults.push({ source: `YouTube: ${videoId}`, contentLength: 0, success: false, error: 'No transcript available' });
            }
          } else {
            console.warn(`Invalid YouTube URL format: ${source.content}`);
            processingResults.push({ source: source.content, contentLength: 0, success: false, error: 'Invalid YouTube URL' });
          }
        }
      } catch (sourceErr) {
        const errMsg = sourceErr instanceof Error ? sourceErr.message : 'Unknown error';
        console.error(`Error processing source:`, errMsg);
        processingResults.push({ source: sourceId, contentLength: 0, success: false, error: errMsg });
      }
    }
    
    // Log processing results summary
    const successfulSources = processingResults.filter(r => r.success);
    const failedSources = processingResults.filter(r => !r.success);
    console.log(`Source processing complete: ${successfulSources.length} successful, ${failedSources.length} failed`);
    console.log(`Total combined content length: ${combinedContent.length} characters`);
    
    // Minimum content validation BEFORE calling Claude
    const MIN_CONTENT_LENGTH = 500;
    if (combinedContent.trim().length < MIN_CONTENT_LENGTH) {
      const errorMsg = `Could not extract enough content from sources. Got ${combinedContent.length} characters, need at least ${MIN_CONTENT_LENGTH}. For YouTube videos, please ensure they have captions/subtitles enabled, or try using text/URL sources instead.`;
      console.error(errorMsg);
      
      await supabase
        .from("datasets")
        .update({ 
          status: "error",
          error_message: errorMsg
        })
        .eq("id", dataset_id);

      return new Response(
        JSON.stringify({ 
          error: "insufficient_content",
          message: errorMsg,
          content_length: combinedContent.length,
          min_required: MIN_CONTENT_LENGTH
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    // Content validation is now done above after source processing

    // Build prompt for Claude
    const systemPrompt = `You are an expert at creating high-quality training data for AI fine-tuning.
Your task is to generate question-answer pairs from the provided content.

${config.system_prompt || "Generate helpful, accurate Q&A pairs."}

Rules:
${config.rules?.map(r => `- ${r}`).join("\n") || "- Be accurate and helpful\n- Vary question types\n- Include both simple and complex questions"}

${config.examples ? `Examples of good Q&A pairs:
${config.examples.map(e => `Q: ${e.question}\nA: ${e.answer}`).join("\n\n")}` : ""}

Output format: Return a JSON array of objects with "question" and "answer" fields.
Only output valid JSON, no markdown or explanation.`;

    const userPrompt = `Generate ${numPairs} high-quality question-answer pairs from this content:

${combinedContent.substring(0, 15000)}

Return as JSON array: [{"question": "...", "answer": "..."}, ...]`;

    // Call Claude
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error(`Claude API error: ${claudeResponse.status} - ${errorText}`);
      throw new Error(`Claude API failed: ${claudeResponse.status}`);
    }

    const claudeData = await claudeResponse.json();
    const responseText = claudeData.content?.[0]?.text || "[]";

    console.log("Claude response received, parsing...");

    // Parse generated QA pairs
    let qaPairs: Array<{ question: string; answer: string }>;
    try {
      // Try to extract JSON from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      qaPairs = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
    } catch (e) {
      console.error("Failed to parse Claude response:", e);
      qaPairs = [];
    }

    if (qaPairs.length === 0) {
      const errorMsg = `Claude returned 0 Q&A pairs. The content (${combinedContent.length} chars) may not be suitable for Q&A generation, or the content format was not recognized. Try providing more detailed text content or different source URLs.`;
      console.error(errorMsg);
      
      await supabase
        .from("datasets")
        .update({ 
          status: "error",
          error_message: errorMsg
        })
        .eq("id", dataset_id);

      return new Response(
        JSON.stringify({ 
          error: "no_qa_pairs_generated",
          message: errorMsg,
          content_length: combinedContent.length
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert to JSONL format
    const jsonlContent = qaPairs.map(pair => {
      return JSON.stringify({
        messages: [
          { role: "system", content: config.system_prompt || "You are a helpful assistant." },
          { role: "user", content: pair.question },
          { role: "assistant", content: pair.answer },
        ],
      });
    }).join("\n");

    // Upload to storage
    const filePath = `${user.id}/${dataset_id}/synthetic.jsonl`;
    const { error: uploadError } = await supabase.storage
      .from("datasets")
      .upload(filePath, new Blob([jsonlContent], { type: "application/jsonl" }), {
        upsert: true,
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Calculate tokens and avg conversation length
    const totalTokens = Math.ceil(jsonlContent.length / 4);
    const avgConversationLength = 3; // system + user + assistant

    // Update dataset record
    await supabase
      .from("datasets")
      .update({
        status: "ready",
        s3_path: filePath,
        row_count: qaPairs.length,
        total_tokens: totalTokens,
        avg_conversation_length: avgConversationLength,
      })
      .eq("id", dataset_id);

    // Create initial snapshot
    const trainRowCount = Math.floor(qaPairs.length * 0.9);
    const valRowCount = qaPairs.length - trainRowCount;

    const { data: dataset } = await supabase
      .from("datasets")
      .select("name")
      .eq("id", dataset_id)
      .single();

    await supabase
      .from("dataset_snapshots")
      .insert({
        dataset_id: dataset_id,
        name: `${dataset?.name || 'Dataset'} v1`,
        version: 1,
        row_count: qaPairs.length,
        train_split_pct: 0.9,
        train_row_count: trainRowCount,
        val_row_count: valRowCount,
        s3_path: filePath,
      });

    console.log(`Synthetic data generated: ${qaPairs.length} pairs, ${totalTokens} tokens`);

    return new Response(
      JSON.stringify({
        success: true,
        row_count: qaPairs.length,
        total_tokens: totalTokens,
        credits_charged: creditCost,
        transaction_id: deductResult.transaction_id,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    
    // Update dataset status to error if we have the ID and supabase client
    if (dataset_id && supabase) {
      try {
        await supabase
          .from("datasets")
          .update({ 
            status: "error", 
            error_message: errorMessage 
          })
          .eq("id", dataset_id);
        console.log("Updated dataset status to error");
      } catch (updateError) {
        console.error("Failed to update dataset status:", updateError);
      }
    }
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
