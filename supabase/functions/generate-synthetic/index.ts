// Generate synthetic training data from various sources
// Uses Claude to create QA pairs

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SyntheticRequest {
  dataset_id: string;
  sources: Array<{
    type: "text" | "url" | "youtube";
    content: string;
  }>;
  config: {
    num_pairs: number;
    system_prompt?: string;
    rules?: string[];
    examples?: Array<{ question: string; answer: string }>;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

    const body: SyntheticRequest = await req.json();
    const { dataset_id, sources, config } = body;

    console.log("Generating synthetic data for dataset:", dataset_id);

    // Update dataset status
    await supabase
      .from("datasets")
      .update({ status: "processing" })
      .eq("id", dataset_id);

    // Extract content from sources
    let combinedContent = "";
    
    for (const source of sources) {
      if (source.type === "text") {
        combinedContent += source.content + "\n\n";
      } else if (source.type === "url") {
        // Fetch URL content
        try {
          const response = await fetch(source.content);
          const html = await response.text();
          // Simple HTML to text extraction
          const text = html
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
            .replace(/<[^>]+>/g, " ")
            .replace(/\s+/g, " ")
            .trim();
          combinedContent += text.substring(0, 10000) + "\n\n";
        } catch (e) {
          console.error("Failed to fetch URL:", e);
        }
      }
      // YouTube would require youtube-transcript-api or similar
    }

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

    const userPrompt = `Generate ${config.num_pairs} high-quality question-answer pairs from this content:

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
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
