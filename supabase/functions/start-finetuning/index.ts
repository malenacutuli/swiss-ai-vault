import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fine-tuning pricing by method
const FINETUNING_PRICING: Record<string, number> = {
  lora: 2.50,
  qlora: 2.00,
  full: 5.00,
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    
    console.log(`Using Supabase URL: ${supabaseUrl?.substring(0, 30)}...`);
    console.log(`Service role key configured: ${!!supabaseKey}`);
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

    // Calculate credit cost based on method
    const method = job.method?.toLowerCase() || "lora";
    const creditCost = FINETUNING_PRICING[method] || FINETUNING_PRICING.lora;
    
    console.log(`Deducting ${creditCost} credits for ${method} fine-tuning job`);

    // Deduct credits before starting the job
    const { data: deductResult, error: deductError } = await supabase.rpc('deduct_credits', {
      p_user_id: job.user_id,
      p_amount: creditCost,
      p_service_type: 'FINE_TUNING',
      p_description: `Fine-tuning job: ${job.name} (${method})`,
      p_metadata: { job_id: job_id, method: method, base_model: job.base_model }
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
      
      // Refund credits on Modal failure
      console.log(`Refunding ${creditCost} credits due to Modal failure`);
      const { error: refundError } = await supabase
        .from("user_credits")
        .update({ 
          balance: supabase.rpc('add_credits_unsafe', { amount: creditCost }),
          updated_at: new Date().toISOString()
        })
        .eq("user_id", job.user_id);
      
      // Simpler refund approach - directly update balance
      const { data: currentCredits } = await supabase
        .from("user_credits")
        .select("balance")
        .eq("user_id", job.user_id)
        .single();
      
      if (currentCredits) {
        await supabase
          .from("user_credits")
          .update({ 
            balance: Number(currentCredits.balance) + creditCost,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", job.user_id);
        
        // Record refund transaction
        await supabase.from("credit_transactions").insert({
          user_id: job.user_id,
          service_type: "REFUND",
          credits_used: -creditCost,
          description: `Refund for failed fine-tuning job: ${job.name}`,
          metadata: { job_id: job_id, reason: "modal_failure" }
        });
        
        console.log(`Refunded ${creditCost} credits to user ${job.user_id}`);
      }
      
      // Update job status to failed
      await supabase
        .from("finetuning_jobs")
        .update({ status: "failed", error_message: `Modal error: ${response.status}` })
        .eq("id", job_id);
      
      return new Response(
        JSON.stringify({ error: `Modal endpoint error: ${response.status}`, credits_refunded: true }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await response.json();
    console.log(`Modal response for job ${job_id}:`, result);

    return new Response(JSON.stringify({ 
      success: true, 
      experiment_id: experimentId,
      credits_charged: creditCost,
      transaction_id: deductResult.transaction_id,
      ...result 
    }), {
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
