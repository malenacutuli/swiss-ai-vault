// Process uploaded dataset files
// Validates JSONL, counts tokens, updates metadata

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface DatasetRow {
  messages: Array<{
    role: "system" | "user" | "assistant";
    content: string;
  }>;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { dataset_id } = await req.json();

    console.log("Processing dataset:", dataset_id);

    // Get dataset record
    const { data: dataset, error: fetchError } = await supabase
      .from("datasets")
      .select("*")
      .eq("id", dataset_id)
      .single();

    if (fetchError || !dataset) {
      throw new Error("Dataset not found");
    }

    // Update status to processing
    await supabase
      .from("datasets")
      .update({ status: "processing" })
      .eq("id", dataset_id);

    // Download file from storage using s3_path
    const filePath = dataset.s3_path;
    console.log("Downloading file from:", filePath);

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("datasets")
      .download(filePath);

    if (downloadError) {
      throw new Error(`Failed to download file: ${downloadError.message}`);
    }

    const content = await fileData.text();
    const lines = content.trim().split("\n");

    console.log(`Found ${lines.length} lines to process`);

    // Validate and process each line
    let rowCount = 0;
    let totalTokens = 0;
    let totalConversationLength = 0;
    const errors: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      try {
        const row: DatasetRow = JSON.parse(lines[i]);
        
        // Validate structure
        if (!row.messages || !Array.isArray(row.messages)) {
          errors.push(`Line ${i + 1}: Missing 'messages' array`);
          continue;
        }

        if (row.messages.length < 2) {
          errors.push(`Line ${i + 1}: Need at least 2 messages`);
          continue;
        }

        // Validate roles
        let hasValidRoles = true;
        for (const msg of row.messages) {
          if (!["system", "user", "assistant"].includes(msg.role)) {
            errors.push(`Line ${i + 1}: Invalid role '${msg.role}'`);
            hasValidRoles = false;
          }
        }

        if (!hasValidRoles) continue;

        // Count tokens (rough estimate: 4 chars = 1 token)
        const text = row.messages.map(m => m.content).join(" ");
        totalTokens += Math.ceil(text.length / 4);
        totalConversationLength += row.messages.length;
        rowCount++;
      } catch (e) {
        errors.push(`Line ${i + 1}: Invalid JSON`);
      }
    }

    const avgConversationLength = rowCount > 0 ? totalConversationLength / rowCount : 0;

    // Update dataset with results
    if (errors.length > 0 && rowCount === 0) {
      // All rows failed
      await supabase
        .from("datasets")
        .update({
          status: "error",
          error_message: errors.slice(0, 10).join("; "),
          row_count: 0,
          total_tokens: 0,
        })
        .eq("id", dataset_id);

      return new Response(
        JSON.stringify({
          success: false,
          row_count: 0,
          total_tokens: 0,
          errors: errors.slice(0, 10),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Success (or partial success) - update dataset
    await supabase
      .from("datasets")
      .update({
        status: "ready",
        row_count: rowCount,
        total_tokens: totalTokens,
        avg_conversation_length: avgConversationLength,
        error_message: errors.length > 0 ? `${errors.length} rows skipped` : null,
      })
      .eq("id", dataset_id);

    // Create initial snapshot
    const trainRowCount = Math.floor(rowCount * 0.9);
    const valRowCount = rowCount - trainRowCount;

    const { error: snapshotError } = await supabase
      .from("dataset_snapshots")
      .insert({
        dataset_id: dataset_id,
        name: `${dataset.name} v1`,
        version: 1,
        row_count: rowCount,
        train_split_pct: 0.9,
        train_row_count: trainRowCount,
        val_row_count: valRowCount,
        s3_path: filePath,
      });

    if (snapshotError) {
      console.error("Failed to create snapshot:", snapshotError);
    }

    console.log(`Dataset processed: ${rowCount} rows, ${totalTokens} tokens`);

    return new Response(
      JSON.stringify({
        success: true,
        row_count: rowCount,
        total_tokens: totalTokens,
        avg_conversation_length: avgConversationLength,
        errors: errors.slice(0, 10),
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
