import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HuggingFaceRequest {
  dataset_id: string;
  hf_dataset_id: string;
  subset?: string;
  split?: string;
  max_rows?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[import-huggingface] Starting import...");

    // Get auth token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.error("[import-huggingface] Auth error:", authError);
      return new Response(
        JSON.stringify({ error: "Invalid authorization" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: HuggingFaceRequest = await req.json();
    const { dataset_id, hf_dataset_id, subset, split = "train", max_rows = 1000 } = body;

    console.log("[import-huggingface] Importing:", { dataset_id, hf_dataset_id, subset, split, max_rows });

    // Update dataset status to processing
    await supabase
      .from("datasets")
      .update({ status: "processing" })
      .eq("id", dataset_id);

    // Fetch dataset info from HuggingFace
    const hfToken = Deno.env.get("HUGGING_FACE_ACCESS_TOKEN");
    const headers: Record<string, string> = {};
    if (hfToken) {
      headers["Authorization"] = `Bearer ${hfToken}`;
    }

    // Use the datasets API to get rows
    // HuggingFace datasets API: https://huggingface.co/docs/datasets-server/rows
    let apiUrl = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(hf_dataset_id)}&split=${split}&offset=0&length=${Math.min(max_rows, 100)}`;
    if (subset) {
      apiUrl += `&config=${encodeURIComponent(subset)}`;
    }

    console.log("[import-huggingface] Fetching from HF API:", apiUrl);
    
    const hfResponse = await fetch(apiUrl, { headers });
    
    if (!hfResponse.ok) {
      const errorText = await hfResponse.text();
      console.error("[import-huggingface] HF API error:", hfResponse.status, errorText);
      
      await supabase
        .from("datasets")
        .update({ 
          status: "error", 
          error_message: `HuggingFace API error: ${hfResponse.status} - ${errorText.slice(0, 200)}` 
        })
        .eq("id", dataset_id);
      
      return new Response(
        JSON.stringify({ error: `Failed to fetch from HuggingFace: ${hfResponse.status}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const hfData = await hfResponse.json();
    console.log("[import-huggingface] HF response features:", Object.keys(hfData));

    // Process rows into JSONL format
    const rows = hfData.rows || [];
    console.log("[import-huggingface] Processing", rows.length, "rows");

    // Detect column structure and convert to messages format
    const jsonlLines: string[] = [];
    let totalTokens = 0;

    for (const row of rows) {
      const rowData = row.row || row;
      
      // Try to detect common dataset formats
      let messages: Array<{ role: string; content: string }> = [];

      // Check if already in messages format
      if (rowData.messages && Array.isArray(rowData.messages)) {
        messages = rowData.messages;
      }
      // Check for instruction/input/output format (Alpaca style)
      else if (rowData.instruction !== undefined) {
        const systemContent = "You are a helpful assistant.";
        let userContent = rowData.instruction;
        if (rowData.input && rowData.input.trim()) {
          userContent += "\n\n" + rowData.input;
        }
        messages = [
          { role: "system", content: systemContent },
          { role: "user", content: userContent },
          { role: "assistant", content: rowData.output || rowData.response || "" }
        ];
      }
      // Check for question/answer format
      else if (rowData.question !== undefined && rowData.answer !== undefined) {
        messages = [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: rowData.question },
          { role: "assistant", content: rowData.answer }
        ];
      }
      // Check for prompt/completion format
      else if (rowData.prompt !== undefined && rowData.completion !== undefined) {
        messages = [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: rowData.prompt },
          { role: "assistant", content: rowData.completion }
        ];
      }
      // Check for text/label format (simple classification)
      else if (rowData.text !== undefined) {
        const response = rowData.label !== undefined ? String(rowData.label) : rowData.text;
        messages = [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: rowData.text },
          { role: "assistant", content: response }
        ];
      }
      // Check for conversations format
      else if (rowData.conversations && Array.isArray(rowData.conversations)) {
        messages = rowData.conversations.map((conv: any) => ({
          role: conv.from === "human" || conv.from === "user" ? "user" : 
                conv.from === "gpt" || conv.from === "assistant" ? "assistant" : conv.from,
          content: conv.value || conv.content || ""
        }));
      }

      if (messages.length >= 2) {
        const line = JSON.stringify({ messages });
        jsonlLines.push(line);
        // Estimate tokens (~4 chars per token)
        totalTokens += Math.ceil(line.length / 4);
      }
    }

    if (jsonlLines.length === 0) {
      await supabase
        .from("datasets")
        .update({ 
          status: "error", 
          error_message: "Could not parse dataset format. Supported formats: messages, instruction/output, question/answer, prompt/completion" 
        })
        .eq("id", dataset_id);
      
      return new Response(
        JSON.stringify({ error: "Could not parse dataset format" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create JSONL content
    const jsonlContent = jsonlLines.join("\n");
    const filePath = `${user.id}/${dataset_id}/huggingface_import.jsonl`;

    console.log("[import-huggingface] Uploading JSONL with", jsonlLines.length, "rows to", filePath);

    // Upload to storage
    const { error: uploadError } = await supabase.storage
      .from("datasets")
      .upload(filePath, jsonlContent, {
        contentType: "application/json",
        upsert: true,
      });

    if (uploadError) {
      console.error("[import-huggingface] Upload error:", uploadError);
      await supabase
        .from("datasets")
        .update({ status: "error", error_message: uploadError.message })
        .eq("id", dataset_id);
      throw uploadError;
    }

    // Update dataset record
    const { error: updateError } = await supabase
      .from("datasets")
      .update({
        status: "ready",
        s3_path: filePath,
        row_count: jsonlLines.length,
        total_tokens: totalTokens,
        source_config: {
          hf_dataset_id,
          subset: subset || null,
          split,
          imported_rows: jsonlLines.length,
          original_rows: rows.length,
        },
      })
      .eq("id", dataset_id);

    if (updateError) {
      console.error("[import-huggingface] Update error:", updateError);
      throw updateError;
    }

    // Create initial snapshot
    const snapshotId = crypto.randomUUID();
    const trainCount = Math.floor(jsonlLines.length * 0.9);
    const valCount = jsonlLines.length - trainCount;

    await supabase.from("dataset_snapshots").insert({
      id: snapshotId,
      dataset_id: dataset_id,
      name: "v1",
      version: 1,
      s3_path: filePath,
      row_count: jsonlLines.length,
      train_row_count: trainCount,
      val_row_count: valCount,
      train_split_pct: 0.9,
    });

    console.log("[import-huggingface] Import complete:", { row_count: jsonlLines.length, total_tokens: totalTokens });

    return new Response(
      JSON.stringify({
        success: true,
        row_count: jsonlLines.length,
        total_tokens: totalTokens,
        skipped_rows: rows.length - jsonlLines.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const error = err as Error;
    console.error("[import-huggingface] Error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
