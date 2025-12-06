import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface HuggingFaceRequest {
  action?: "preview" | "import";
  dataset_id?: string;
  hf_dataset_id: string;
  subset?: string;
  split?: string;
  max_rows?: number;
  limit?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("[import-huggingface] Starting...");

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
    const { action = "import", dataset_id, hf_dataset_id, subset, split = "train", max_rows = 1000, limit = 5 } = body;

    console.log("[import-huggingface] Request:", { action, dataset_id, hf_dataset_id, subset, split, max_rows });

    // Fetch dataset info from HuggingFace
    const hfToken = Deno.env.get("HUGGING_FACE_ACCESS_TOKEN");
    const headers: Record<string, string> = {};
    if (hfToken) {
      headers["Authorization"] = `Bearer ${hfToken}`;
    }

    // PREVIEW ACTION - Fetch first N rows for preview
    if (action === "preview") {
      const apiUrl = `https://datasets-server.huggingface.co/first-rows?dataset=${encodeURIComponent(hf_dataset_id)}&config=${encodeURIComponent(subset || 'default')}&split=${encodeURIComponent(split)}`;
      
      console.log("[import-huggingface] Preview URL:", apiUrl);
      
      const response = await fetch(apiUrl, { headers });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error("[import-huggingface] Preview error:", response.status, errorText);
        return new Response(
          JSON.stringify({ error: `HuggingFace API error: ${response.status}`, details: errorText.slice(0, 200) }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const data = await response.json();
      const rows = data.rows?.slice(0, limit).map((r: any) => r.row) || [];
      
      // Try to convert first row to show format detection
      const sampleConversion = rows.length > 0 ? convertToMessageFormat(rows[0]) : null;
      
      return new Response(JSON.stringify({
        rows,
        features: data.features,
        num_rows: data.num_rows_total,
        sample_conversion: sampleConversion,
        detected_format: detectFormat(rows[0])
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    // IMPORT ACTION - Full dataset import
    if (!dataset_id) {
      return new Response(
        JSON.stringify({ error: "dataset_id is required for import action" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update dataset status to processing
    await supabase
      .from("datasets")
      .update({ status: "processing" })
      .eq("id", dataset_id);

    // Use the datasets API to get rows (paginated for large datasets)
    const allRows: any[] = [];
    let offset = 0;
    const pageSize = 100;
    const maxToFetch = Math.min(max_rows, 10000); // Cap at 10k rows

    while (allRows.length < maxToFetch) {
      let apiUrl = `https://datasets-server.huggingface.co/rows?dataset=${encodeURIComponent(hf_dataset_id)}&split=${split}&offset=${offset}&length=${pageSize}`;
      if (subset) {
        apiUrl += `&config=${encodeURIComponent(subset)}`;
      }

      console.log(`[import-huggingface] Fetching page offset=${offset}...`);
      
      const hfResponse = await fetch(apiUrl, { headers });
      
      if (!hfResponse.ok) {
        const errorText = await hfResponse.text();
        console.error("[import-huggingface] HF API error:", hfResponse.status, errorText);
        
        // If we already have some rows, continue with what we have
        if (allRows.length > 0) {
          console.log(`[import-huggingface] Got ${allRows.length} rows before error, continuing...`);
          break;
        }
        
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
      const rows = hfData.rows || [];
      
      if (rows.length === 0) break;
      
      allRows.push(...rows);
      offset += pageSize;
      
      // Stop if we've reached our target
      if (allRows.length >= maxToFetch) break;
      
      // Rate limiting
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    console.log("[import-huggingface] Total rows fetched:", allRows.length);

    if (allRows.length === 0) {
      await supabase
        .from("datasets")
        .update({ status: "error", error_message: "No data found in dataset" })
        .eq("id", dataset_id);
      
      return new Response(
        JSON.stringify({ error: "No data found in dataset" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Process rows into JSONL format
    const jsonlLines: string[] = [];
    let totalTokens = 0;
    let skippedRows = 0;

    for (const row of allRows) {
      const rowData = row.row || row;
      const converted = convertToMessageFormat(rowData);
      
      if (converted && converted.messages && converted.messages.length >= 2) {
        const line = JSON.stringify(converted);
        jsonlLines.push(line);
        // Estimate tokens (~4 chars per token)
        totalTokens += Math.ceil(line.length / 4);
      } else {
        skippedRows++;
      }
    }

    if (jsonlLines.length === 0) {
      const sampleKeys = allRows[0]?.row ? Object.keys(allRows[0].row) : Object.keys(allRows[0] || {});
      await supabase
        .from("datasets")
        .update({ 
          status: "error", 
          error_message: `Could not parse dataset format. Columns found: ${sampleKeys.join(', ')}. Supported: instruction/output, question/answer, prompt/completion, messages, conversations` 
        })
        .eq("id", dataset_id);
      
      return new Response(
        JSON.stringify({ error: "Could not parse dataset format", columns_found: sampleKeys }),
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
          original_rows: allRows.length,
          skipped_rows: skippedRows,
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

    console.log("[import-huggingface] Import complete:", { row_count: jsonlLines.length, total_tokens: totalTokens, skipped: skippedRows });

    return new Response(
      JSON.stringify({
        success: true,
        row_count: jsonlLines.length,
        total_tokens: totalTokens,
        skipped_rows: skippedRows,
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

// Detect the format of a row
function detectFormat(row: any): string {
  if (!row) return "unknown";
  if (row.messages && Array.isArray(row.messages)) return "messages";
  if (row.conversations && Array.isArray(row.conversations)) return "conversations (ShareGPT)";
  if (row.instruction !== undefined) return "instruction/output (Alpaca)";
  if (row.question !== undefined && row.answer !== undefined) return "question/answer";
  if (row.prompt !== undefined && row.completion !== undefined) return "prompt/completion";
  if (row.input !== undefined && row.output !== undefined) return "input/output";
  if (row.text !== undefined) return "text (single column)";
  return "unknown";
}

// Convert various HF dataset formats to chat message format
function convertToMessageFormat(row: any): { messages: Array<{ role: string; content: string }> } | null {
  if (!row) return null;

  // Format 1: Already in messages format
  if (row.messages && Array.isArray(row.messages)) {
    return { messages: row.messages };
  }

  // Format 2: Conversations array (ShareGPT style)
  if (row.conversations && Array.isArray(row.conversations)) {
    const messages = row.conversations.map((conv: any) => ({
      role: conv.from === "human" || conv.from === "user" ? "user" : 
            conv.from === "gpt" || conv.from === "assistant" ? "assistant" : conv.from,
      content: conv.value || conv.content || ""
    }));
    return { messages };
  }

  // Format 3: instruction/input/output (Alpaca style)
  if (row.instruction !== undefined) {
    const systemContent = "You are a helpful assistant.";
    let userContent = row.instruction;
    if (row.input && row.input.trim()) {
      userContent += "\n\n" + row.input;
    }
    return {
      messages: [
        { role: "system", content: systemContent },
        { role: "user", content: userContent },
        { role: "assistant", content: row.output || row.response || "" }
      ]
    };
  }

  // Format 4: question/answer
  if (row.question !== undefined && row.answer !== undefined) {
    const answerText = typeof row.answer === 'object' 
      ? (row.answer.text || row.answer.answer || JSON.stringify(row.answer))
      : String(row.answer);
    return {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: row.question },
        { role: "assistant", content: answerText }
      ]
    };
  }

  // Format 5: prompt/completion
  if (row.prompt !== undefined && row.completion !== undefined) {
    return {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: row.prompt },
        { role: "assistant", content: row.completion }
      ]
    };
  }

  // Format 6: input/output
  if (row.input !== undefined && row.output !== undefined) {
    return {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: row.input },
        { role: "assistant", content: row.output }
      ]
    };
  }

  // Format 7: text/label (classification)
  if (row.text !== undefined && row.label !== undefined) {
    return {
      messages: [
        { role: "system", content: "You are a helpful assistant." },
        { role: "user", content: row.text },
        { role: "assistant", content: String(row.label) }
      ]
    };
  }

  // Could not convert
  console.log("[import-huggingface] Could not convert row format:", Object.keys(row));
  return null;
}
