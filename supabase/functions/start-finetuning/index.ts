import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const modalEndpoint = Deno.env.get("MODAL_ENDPOINT")!;
    const modalSecret = Deno.env.get("MODAL_SECRET")!;
    const webhookSecret = Deno.env.get("WEBHOOK_SECRET")!;
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { job_id } = await req.json();

    console.log(`Starting fine-tuning job: ${job_id}`);

    // Get job details
    const { data: job, error: jobError } = await supabase
      .from("finetuning_jobs")
      .select("*")
      .eq("id", job_id)
      .single();

    if (jobError || !job) {
      console.error("Job not found:", jobError);
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create experiment if not exists
    const experimentId = crypto.randomUUID();
    const { error: experimentError } = await supabase.from("experiments").insert({
      id: experimentId,
      job_id: job_id,
      name: "Experiment 1",
      config: job.hyperparameters,
      status: "queued",
      training_loss: [],
    });

    if (experimentError) {
      console.error("Failed to create experiment:", experimentError);
    }

    // Update job status
    const { error: updateError } = await supabase
      .from("finetuning_jobs")
      .update({ status: "queued" })
      .eq("id", job_id);

    if (updateError) {
      console.error("Failed to update job status:", updateError);
    }

    console.log(`Calling Modal endpoint for job ${job_id}`);

    // Call Modal endpoint
    const response = await fetch(modalEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret: modalSecret,
        job_id: job_id,
        experiment_id: experimentId,
        snapshot_id: job.snapshot_id,
        base_model: job.base_model,
        method: job.method,
        config: job.hyperparameters,
        webhook_url: `${supabaseUrl}/functions/v1/webhook-finetuning`,
        webhook_secret: webhookSecret,
        supabase_url: supabaseUrl,
        supabase_key: supabaseKey,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Modal endpoint error: ${response.status} - ${errorText}`);
      
      // Update job status to failed
      await supabase
        .from("finetuning_jobs")
        .update({ status: "failed", error_message: `Modal error: ${response.status}` })
        .eq("id", job_id);
      
      return new Response(
        JSON.stringify({ error: `Modal endpoint error: ${response.status}` }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log(`Modal response for job ${job_id}:`, result);

    return new Response(JSON.stringify({ success: true, experiment_id: experimentId, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Error in start-finetuning:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
