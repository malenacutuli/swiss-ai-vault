// Webhook to receive fine-tuning status updates from external workers

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
};

interface WebhookPayload {
  job_id: string;
  experiment_id?: string;
  event: "started" | "progress" | "completed" | "failed";
  data?: {
    step?: number;
    loss?: number;
    progress?: number;
    model_path?: string;
    gguf_path?: string;
    error?: string;
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify webhook secret - REQUIRED for security
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    
    if (!expectedSecret) {
      console.error("WEBHOOK_SECRET not configured - rejecting request");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    
    if (webhookSecret !== expectedSecret) {
      console.error("Invalid webhook secret");
      return new Response(
        JSON.stringify({ error: "Invalid webhook secret" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    
    console.log(`Using Supabase URL: ${supabaseUrl?.substring(0, 30)}...`);
    console.log(`Service role key configured: ${!!supabaseKey}`);
    
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: WebhookPayload = await req.json();
    const { job_id, experiment_id, event, data } = payload;

    console.log(`Webhook received: ${event} for job ${job_id}`);

    if (event === "started") {
      // Update job status to training
      await supabase
        .from("finetuning_jobs")
        .update({ 
          status: "training", 
          started_at: new Date().toISOString() 
        })
        .eq("id", job_id);

      if (experiment_id) {
        await supabase
          .from("experiments")
          .update({ 
            status: "training", 
            started_at: new Date().toISOString() 
          })
          .eq("id", experiment_id);
      }
    }

    if (event === "progress" && data) {
      // Update job with progress
      const updates: Record<string, unknown> = {};
      
      if (data.loss !== undefined) {
        // Get current training_metrics and append loss
        const { data: job } = await supabase
          .from("finetuning_jobs")
          .select("training_metrics")
          .eq("id", job_id)
          .single();

        const metrics = (job?.training_metrics as Record<string, unknown>) || {};
        const lossHistory = (metrics.loss_history as number[]) || [];
        lossHistory.push(data.loss);
        
        updates.training_metrics = {
          ...metrics,
          loss_history: lossHistory,
          current_loss: data.loss,
          current_step: data.step,
          progress: data.progress,
        };
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from("finetuning_jobs")
          .update(updates)
          .eq("id", job_id);
      }

      // Also update experiment if provided
      if (experiment_id && data.loss !== undefined) {
        const { data: experiment } = await supabase
          .from("experiments")
          .select("training_loss")
          .eq("id", experiment_id)
          .single();

        const trainingLoss = (experiment?.training_loss as number[]) || [];
        trainingLoss.push(data.loss);

        await supabase
          .from("experiments")
          .update({ training_loss: trainingLoss })
          .eq("id", experiment_id);
      }
    }

    if (event === "completed" && data) {
      // Update job as completed
      await supabase
        .from("finetuning_jobs")
        .update({ 
          status: "completed", 
          completed_at: new Date().toISOString(),
          s3_checkpoint_path: data.model_path || null,
          s3_gguf_path: data.gguf_path || null,
        })
        .eq("id", job_id);

      if (experiment_id) {
        await supabase
          .from("experiments")
          .update({ 
            status: "completed", 
            completed_at: new Date().toISOString(),
            final_loss: data.loss,
          })
          .eq("id", experiment_id);
      }

      // Create model record from completed job
      const { data: job } = await supabase
        .from("finetuning_jobs")
        .select("user_id, project_id, name, base_model")
        .eq("id", job_id)
        .single();

      if (job) {
        const modelId = `sv-${job.base_model.replace(/[^a-z0-9]/gi, '-')}-${job_id.substring(0, 8)}`;
        
        await supabase
          .from("models")
          .insert({
            user_id: job.user_id,
            finetuning_job_id: job_id,
            model_id: modelId,
            name: job.name,
            base_model: job.base_model,
            is_deployed: false,
            s3_checkpoint_path: data.model_path || null,
            s3_gguf_path: data.gguf_path || null,
          });

        console.log(`Created model ${modelId} from job ${job_id}`);
      }
    }

    if (event === "failed" && data) {
      await supabase
        .from("finetuning_jobs")
        .update({ 
          status: "failed", 
          error_message: data.error || "Unknown error",
          completed_at: new Date().toISOString() 
        })
        .eq("id", job_id);

      if (experiment_id) {
        await supabase
          .from("experiments")
          .update({ 
            status: "failed",
            completed_at: new Date().toISOString() 
          })
          .eq("id", experiment_id);
      }

      console.error(`Job ${job_id} failed: ${data.error}`);
    }

    return new Response(JSON.stringify({ success: true, event, job_id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Webhook error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
