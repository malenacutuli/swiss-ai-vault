// Run model evaluation with LLM-as-Judge

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EvalRequest {
  evaluation_id: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  let evaluationId: string | undefined;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Authenticate request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body: EvalRequest = await req.json();
    evaluationId = body.evaluation_id;

    console.log("Running evaluation:", evaluationId);

    // Verify user owns this evaluation
    const { data: ownerCheck } = await supabase
      .from("evaluations")
      .select("user_id")
      .eq("id", evaluationId)
      .single();

    if (!ownerCheck || ownerCheck.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Not authorized to run this evaluation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get evaluation with related data
    const { data: evaluation, error: evalError } = await supabase
      .from("evaluations")
      .select(`
        *,
        snapshot:dataset_snapshots!snapshot_id (
          s3_path,
          row_count,
          val_row_count
        )
      `)
      .eq("id", evaluationId)
      .single();

    if (evalError || !evaluation) {
      console.error("Evaluation not found:", evalError);
      return new Response(JSON.stringify({ error: "Evaluation not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Update status to running
    await supabase
      .from("evaluations")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", evaluationId);

    // Get metrics
    const { data: metrics, error: metricsError } = await supabase
      .from("metrics")
      .select("*")
      .in("id", evaluation.metric_ids);

    if (metricsError || !metrics || metrics.length === 0) {
      throw new Error("No metrics found for evaluation");
    }

    console.log(`Found ${metrics.length} metrics to evaluate`);

    // Download dataset file
    const s3Path = evaluation.snapshot?.s3_path;
    if (!s3Path) {
      throw new Error("No dataset file path found");
    }

    const { data: dataFile, error: downloadError } = await supabase.storage
      .from("datasets")
      .download(s3Path);

    if (downloadError || !dataFile) {
      throw new Error(`Failed to download dataset: ${downloadError?.message}`);
    }

    const fileContent = await dataFile.text();
    const allRows = fileContent.trim().split("\n").map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return null;
      }
    }).filter(Boolean);

    console.log(`Loaded ${allRows.length} rows from dataset`);

    // Use validation portion (last 10%) or limit to 20 samples for demo
    const valCount = Math.min(20, Math.ceil(allRows.length * 0.1));
    const samples = allRows.slice(-valCount);

    // Initialize results tracking
    const results: Record<string, { total: number; count: number; scores: number[] }> = {};
    const detailedResults: Array<{
      input: string;
      expected: string;
      actual: string;
      scores: Record<string, number>;
      reasoning: Record<string, string>;
    }> = [];

    for (const metric of metrics) {
      results[metric.name] = { total: 0, count: 0, scores: [] };
    }

    // Process each sample
    for (let i = 0; i < samples.length; i++) {
      const row = samples[i];
      const messages = row.messages || [];

      const systemPrompt = messages.find((m: { role: string }) => m.role === "system")?.content || "";
      const userMessage = messages.find((m: { role: string }) => m.role === "user")?.content || "";
      const expectedAnswer = messages.find((m: { role: string }) => m.role === "assistant")?.content || "";

      if (!userMessage || !expectedAnswer) {
        console.log(`Skipping row ${i}: missing user or assistant message`);
        continue;
      }

      // Get model prediction using Claude (simulating the model being evaluated)
      let actualAnswer = "";
      try {
        const predictionResponse = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: {
            "x-api-key": anthropicKey,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
          },
          body: JSON.stringify({
            model: "claude-3-5-haiku-20241022",
            max_tokens: 1024,
            system: systemPrompt || "You are a helpful assistant.",
            messages: [{ role: "user", content: userMessage }],
          }),
        });

        const predData = await predictionResponse.json();
        actualAnswer = predData.content?.[0]?.text || "";
      } catch (e) {
        console.error(`Failed to get prediction for row ${i}:`, e);
        continue;
      }

      // Score with each metric
      const rowScores: Record<string, number> = {};
      const rowReasoning: Record<string, string> = {};

      for (const metric of metrics) {
        let score = 0.5;
        let reason = "";

        if (metric.metric_type === "string_match") {
          // Fuzzy string match
          const expected = expectedAnswer.toLowerCase().trim();
          const actual = actualAnswer.toLowerCase().trim();
          if (expected === actual) {
            score = 1.0;
            reason = "Exact match";
          } else if (actual.includes(expected) || expected.includes(actual)) {
            score = 0.5;
            reason = "Partial match";
          } else {
            score = 0.0;
            reason = "No match";
          }
        } else if (metric.metric_type === "llm_judge") {
          // Use Claude as judge
          const rules = metric.rules as { should?: string[]; should_not?: string[] } | null;
          const judgePrompt = `You are evaluating an AI assistant's response quality.

**Question asked to the AI:**
${userMessage}

**Expected/Reference Answer:**
${expectedAnswer}

**Actual AI Response:**
${actualAnswer}

**Evaluation Criteria - "${metric.name}":**
${metric.description || "Evaluate the quality of the response."}

The response SHOULD:
${rules?.should?.map((s: string) => `- ${s}`).join("\n") || "- Be accurate and helpful"}

The response SHOULD NOT:
${rules?.should_not?.map((s: string) => `- ${s}`).join("\n") || "- Be inaccurate or misleading"}

**Scoring:**
- 0.0 = Completely fails the criteria
- 0.5 = Partially meets criteria
- 1.0 = Fully meets criteria

Respond with ONLY a JSON object in this exact format:
{"score": <number between 0 and 1>, "reason": "<brief 1-2 sentence explanation>"}`;

          try {
            const judgeResponse = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": anthropicKey,
                "Content-Type": "application/json",
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({
                model: "claude-3-5-haiku-20241022",
                max_tokens: 256,
                messages: [{ role: "user", content: judgePrompt }],
              }),
            });

            const judgeData = await judgeResponse.json();
            const judgeText = judgeData.content?.[0]?.text || '{"score": 0.5, "reason": "Unable to evaluate"}';

            const jsonMatch = judgeText.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              score = Math.max(0, Math.min(1, Number(parsed.score) || 0.5));
              reason = parsed.reason || "No reason provided";
            }
          } catch (e) {
            console.error(`Judge evaluation failed for metric ${metric.name}:`, e);
            reason = "Evaluation failed";
          }
        }

        rowScores[metric.name] = score;
        rowReasoning[metric.name] = reason;
        results[metric.name].total += score;
        results[metric.name].count += 1;
        results[metric.name].scores.push(score);
      }

      detailedResults.push({
        input: userMessage.substring(0, 500),
        expected: expectedAnswer.substring(0, 500),
        actual: actualAnswer.substring(0, 500),
        scores: rowScores,
        reasoning: rowReasoning,
      });

      console.log(`Processed sample ${i + 1}/${samples.length}`);
    }

    // Calculate aggregate results
    const aggregateResults: Record<string, {
      average: number;
      min: number;
      max: number;
      count: number;
    }> = {};

    for (const [name, data] of Object.entries(results)) {
      if (data.scores.length > 0) {
        aggregateResults[name] = {
          average: data.total / data.count,
          min: Math.min(...data.scores),
          max: Math.max(...data.scores),
          count: data.count,
        };
      }
    }

    console.log("Evaluation complete, results:", aggregateResults);

    // Update evaluation with results
    await supabase
      .from("evaluations")
      .update({
        status: "completed",
        results: aggregateResults,
        detailed_results: detailedResults,
        completed_at: new Date().toISOString(),
      })
      .eq("id", evaluationId);

    return new Response(
      JSON.stringify({ success: true, results: aggregateResults }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Evaluation error:", error);
    
    // Update evaluation as failed
    if (evaluationId) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await supabase
        .from("evaluations")
        .update({ 
          status: "failed", 
          error_message: errorMessage,
          completed_at: new Date().toISOString()
        })
        .eq("id", evaluationId);
    }

    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
