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
  type: "text" | "url" | "youtube";
  content: string;
}

interface SyntheticConfig {
  num_pairs: number;
  system_prompt?: string;
  rules?: string[];
  examples?: Array<{ question: string; answer: string }>;
}

interface SyntheticRequest {
  dataset_id: string;
  sources: SyntheticSource[];
  config: SyntheticConfig;
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

    const body = await req.json() as SyntheticRequest;
    const { sources, config } = body;
    dataset_id = body.dataset_id;

    if (!dataset_id) {
      return new Response(JSON.stringify({ error: "dataset_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    for (const source of sources) {
      console.log(`Processing source type: ${source.type}, content: ${source.content.substring(0, 100)}...`);
      
      if (source.type === "text") {
        combinedContent += source.content + "\n\n";
      } else if (source.type === "url") {
        // Validate URL to prevent SSRF
        if (!isAllowedUrl(source.content)) {
          console.warn(`Blocked potentially unsafe URL: ${source.content}`);
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
          combinedContent += text.substring(0, 10000) + "\n\n";
          console.log(`Fetched URL content: ${text.substring(0, 200)}...`);
        } catch (e) {
          console.error("Failed to fetch URL:", e);
        }
      } else if (source.type === "youtube") {
        // Extract video ID from YouTube URL
        const videoIdMatch = source.content.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
        if (videoIdMatch) {
          const videoId = videoIdMatch[1];
          console.log(`Extracting content for YouTube video: ${videoId}`);
          
          try {
            // Fetch video info using oEmbed API (no API key required)
            const oembedResponse = await fetch(
              `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`
            );
            
            if (oembedResponse.ok) {
              const oembedData = await oembedResponse.json();
              const title = oembedData.title || '';
              const author = oembedData.author_name || '';
              
              // Add video metadata as context
              combinedContent += `YouTube Video: "${title}" by ${author}\n\n`;
              console.log(`YouTube video metadata: ${title} by ${author}`);
            }
            
            // Try to get transcript using a public transcript service
            try {
              const transcriptResponse = await fetch(
                `https://yt.lemnoslife.com/noKey/captions?videoId=${videoId}&lang=en`
              );
              
              if (transcriptResponse.ok) {
                const transcriptData = await transcriptResponse.json();
                if (transcriptData?.captions?.length > 0) {
                  const transcript = transcriptData.captions
                    .map((c: { text: string }) => c.text)
                    .join(' ')
                    .substring(0, 10000);
                  combinedContent += `Transcript: ${transcript}\n\n`;
                  console.log(`Got YouTube transcript: ${transcript.substring(0, 200)}...`);
                }
              }
            } catch (transcriptError) {
              console.log("Could not fetch transcript, using video title only:", transcriptError);
            }
          } catch (e) {
            console.error("Failed to fetch YouTube content:", e);
            // Fallback: just use the URL as context
            combinedContent += `YouTube Video URL: ${source.content}\n\n`;
          }
        } else {
          console.warn(`Invalid YouTube URL format: ${source.content}`);
        }
      }
    }
    
    // Check if we got any content
    if (!combinedContent.trim()) {
      console.error("No content could be extracted from sources");
      throw new Error("Could not extract content from the provided sources. Please check your URLs or provide text content directly.");
    }
    
    console.log(`Total combined content length: ${combinedContent.length} characters`);

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
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

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
      await supabase
        .from("datasets")
        .update({ 
          status: "error",
          error_message: "Failed to generate Q&A pairs from the provided content"
        })
        .eq("id", dataset_id);

      return new Response(
        JSON.stringify({ error: "Failed to generate Q&A pairs" }),
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
