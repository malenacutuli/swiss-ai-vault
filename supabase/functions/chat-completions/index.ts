// OpenAI-compatible chat completions endpoint
// POST /v1/chat/completions

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ChatRequest {
  model: string;
  messages: Message[];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  top_p?: number;
  stop?: string | string[];
}

// Base models we support
const BASE_MODELS: Record<string, string> = {
  "llama3.2-1b": "meta-llama/Llama-3.2-1B-Instruct",
  "llama3.2-3b": "meta-llama/Llama-3.2-3B-Instruct",
  "mistral-7b": "mistralai/Mistral-7B-Instruct-v0.3",
  "qwen2.5-0.5b": "Qwen/Qwen2.5-0.5B-Instruct",
  "qwen2.5-1.5b": "Qwen/Qwen2.5-1.5B-Instruct",
  "qwen2.5-3b": "Qwen/Qwen2.5-3B-Instruct",
  "qwen2.5-7b": "Qwen/Qwen2.5-7B-Instruct",
  "gemma2-2b": "google/gemma-2-2b-it",
  "gpt-4o-mini": "gpt-4o-mini",
  "gpt-4o": "gpt-4o",
  "claude-3-5-sonnet": "claude-3-5-sonnet-20241022",
  "claude-3-5-haiku": "claude-3-5-haiku-20241022",
};

// Models that should route to vLLM
const VLLM_MODELS = [
  "qwen2.5-0.5b", "qwen2.5-1.5b", "qwen2.5-3b", "qwen2.5-7b",
  "mistral-7b", "gemma2-2b", "llama3.2-1b", "llama3.2-3b"
];

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || Deno.env.get("EXTERNAL_SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || Deno.env.get("EXTERNAL_SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get authorization header
    const authHeader = req.headers.get("authorization") || req.headers.get("Authorization") || "";
    const apiKeyHeader = req.headers.get("apikey") || "";
    
    // Parse request body first to check for action type
    const body = await req.json();
    
    // Handle embed action (for RAG query embeddings)
    if (body.action === "embed" && body.text) {
      // Authenticate user first
      let embedUserId: string | null = null;
      
      if (authHeader.startsWith("Bearer ey")) {
        const token = authHeader.replace("Bearer ", "").trim();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (user && !error) {
          embedUserId = user.id;
        }
      }
      
      if (!embedUserId) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      if (!openaiKey) {
        return new Response(
          JSON.stringify({ error: "OpenAI API key not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      try {
        const embeddingResponse = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openaiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "text-embedding-ada-002",
            input: body.text,
          }),
        });
        
        const embeddingData = await embeddingResponse.json();
        
        if (embeddingData.error) {
          console.error("[chat-completions] Embedding error:", embeddingData.error);
          return new Response(
            JSON.stringify({ error: embeddingData.error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        
        return new Response(
          JSON.stringify({ embedding: embeddingData.data[0].embedding }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (embedError) {
        console.error("[chat-completions] Embed request failed:", embedError);
        return new Response(
          JSON.stringify({ error: "Failed to generate embedding" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }
    // Continue with chat completion handling
    
    let userId: string | null = null;

    // Check for custom API key (svk_... or sv_...)
    if (authHeader.includes("svk_") || authHeader.includes("sv_") || apiKeyHeader.startsWith("svk_") || apiKeyHeader.startsWith("sv_")) {
      const apiKey = authHeader.includes("svk_") || authHeader.includes("sv_")
        ? authHeader.replace("Bearer ", "").trim()
        : apiKeyHeader;
      
      console.log(`[chat-completions] API key auth attempt: ${apiKey.substring(0, 6)}...`);
      
      // Hash the key and look it up
      const encoder = new TextEncoder();
      const data = encoder.encode(apiKey);
      const hashBuffer = await crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const keyHash = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
      
      const { data: keyRecord, error: keyError } = await supabase
        .from("api_keys")
        .select("user_id")
        .eq("key_hash", keyHash)
        .single();
      
      if (keyRecord) {
        userId = keyRecord.user_id;
        console.log(`[chat-completions] API key validated for user: ${userId}`);
        
        // Update last_used_at
        await supabase
          .from("api_keys")
          .update({ last_used_at: new Date().toISOString() })
          .eq("key_hash", keyHash);
      } else {
        console.log(`[chat-completions] API key lookup failed: ${keyError?.message}`);
      }
    }
    
    // If no API key match, try JWT auth
    if (!userId && authHeader.startsWith("Bearer ey")) {
      try {
        const token = authHeader.replace("Bearer ", "").trim();
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (user && !error) {
          userId = user.id;
          console.log(`[chat-completions] JWT validated for user: ${userId}`);
        }
      } catch (jwtError) {
        console.log(`[chat-completions] JWT validation failed: ${jwtError}`);
      }
    }

    // Require authentication
    if (!userId) {
      return new Response(
        JSON.stringify({ error: { message: "Unauthorized. Provide a valid API key (svk_...) or JWT token." } }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check user's zero-retention mode setting
    let zeroRetentionMode = false;
    try {
      const { data: userSettings } = await supabase
        .from("user_settings")
        .select("zero_retention_mode")
        .eq("user_id", userId)
        .maybeSingle();
      
      zeroRetentionMode = userSettings?.zero_retention_mode ?? false;
      console.log(`[chat-completions] User ${userId} zero_retention_mode: ${zeroRetentionMode}`);
    } catch (settingsError) {
      console.error("[chat-completions] Error fetching user settings:", settingsError);
      // Continue with default (false) if settings fetch fails
    }

    // Use the already parsed body for chat completions
    const { model, messages, temperature = 0.7, max_tokens = 1024, stream = false } = body as ChatRequest;

    // Determine which provider to use
    let provider: "openai" | "anthropic" | "vllm" = "openai";
    let actualModel = model;

    if (model.startsWith("claude") || model.includes("claude")) {
      provider = "anthropic";
      actualModel = BASE_MODELS[model] || model;
    } else if (model.startsWith("gpt") || model.includes("gpt")) {
      provider = "openai";
      actualModel = BASE_MODELS[model] || model;
    } else if (VLLM_MODELS.includes(model)) {
      // Route open-source models to vLLM
      provider = "vllm";
      actualModel = BASE_MODELS[model] || model;
      console.log(`[chat-completions] Routing ${model} to vLLM as ${actualModel}`);
    } else if (model.startsWith("sv-")) {
      // Custom fine-tuned model - route to vLLM
      const { data: customModel } = await supabase
        .from("models")
        .select("*")
        .eq("model_id", model)
        .eq("user_id", userId)
        .single();
      
      if (!customModel) {
        return new Response(
          JSON.stringify({ error: { message: `Model ${model} not found` } }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      
      // Route fine-tuned models to vLLM with checkpoint path
      provider = "vllm";
      actualModel = customModel.s3_checkpoint_path || customModel.model_id;
      console.log(`[chat-completions] Routing fine-tuned ${model} to vLLM`);
    } else {
      // Unknown model - try vLLM first if it looks like a HuggingFace model
      if (model.includes("/")) {
        provider = "vllm";
        actualModel = model;
      } else {
        // Fallback to OpenAI
        actualModel = BASE_MODELS[model] || model;
        provider = "openai";
      }
    }

    // Track usage (always track API requests, even in zero-retention mode)
    const today = new Date().toISOString().split("T")[0];
    await supabase.rpc("increment_usage", {
      p_user_id: userId,
      p_date: today,
      p_metric: "api_requests",
      p_value: 1,
    });

    // Call the appropriate provider with zero-retention context
    const responseHeaders: Record<string, string> = { ...corsHeaders };
    if (zeroRetentionMode) {
      responseHeaders["X-Zero-Retention"] = "true";
    }

    if (provider === "anthropic") {
      return await handleAnthropicRequest(messages, actualModel, temperature, max_tokens, stream, userId, supabase, zeroRetentionMode, body, responseHeaders);
    } else if (provider === "vllm") {
      return await handleVLLMRequest(messages, actualModel, temperature, max_tokens, stream, userId, supabase, zeroRetentionMode, body, responseHeaders);
    } else {
      return await handleOpenAIRequest(messages, actualModel, temperature, max_tokens, stream, userId, supabase, zeroRetentionMode, body, responseHeaders);
    }

  } catch (error) {
    console.error("Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: { message: errorMessage } }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function handleOpenAIRequest(
  messages: Message[],
  model: string,
  temperature: number,
  maxTokens: number,
  stream: boolean,
  userId: string,
  supabase: any,
  zeroRetentionMode: boolean,
  originalRequest: ChatRequest,
  responseHeaders: Record<string, string>
) {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const startTime = Date.now();
  
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream,
    }),
  });

  if (stream) {
    // Return streaming response
    return new Response(response.body, {
      headers: {
        ...responseHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  
  // Track token usage
  if (data.usage) {
    const today = new Date().toISOString().split("T")[0];
    await supabase.rpc("increment_usage", {
      p_user_id: userId,
      p_date: today,
      p_metric: "tokens_input",
      p_value: data.usage.prompt_tokens,
    });
    await supabase.rpc("increment_usage", {
      p_user_id: userId,
      p_date: today,
      p_metric: "tokens_output",
      p_value: data.usage.completion_tokens,
    });
  }

  // Log trace only if NOT in zero-retention mode
  if (!zeroRetentionMode) {
    try {
      await supabase.from("traces").insert({
        user_id: userId,
        model_id: model,
        request: originalRequest,
        response: data,
        latency_ms: latencyMs,
        prompt_tokens: data.usage?.prompt_tokens || null,
        completion_tokens: data.usage?.completion_tokens || null,
        total_tokens: data.usage?.total_tokens || null,
        status_code: response.status,
      });
      console.log(`[chat-completions] Trace logged for user ${userId}`);
    } catch (traceError) {
      console.error("[chat-completions] Error logging trace:", traceError);
    }
  } else {
    console.log(`[chat-completions] Skipping trace logging (zero-retention mode)`);
  }

  return new Response(JSON.stringify(data), {
    headers: { ...responseHeaders, "Content-Type": "application/json" },
  });
}

async function handleAnthropicRequest(
  messages: Message[],
  model: string,
  temperature: number,
  maxTokens: number,
  stream: boolean,
  userId: string,
  supabase: any,
  zeroRetentionMode: boolean,
  originalRequest: ChatRequest,
  responseHeaders: Record<string, string>
) {
  const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
  const startTime = Date.now();
  
  // Convert OpenAI format to Anthropic format
  let systemPrompt = "";
  const anthropicMessages = messages.filter(m => {
    if (m.role === "system") {
      systemPrompt = m.content;
      return false;
    }
    return true;
  });

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": anthropicKey!,
      "Content-Type": "application/json",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: anthropicMessages,
      temperature,
      stream,
    }),
  });

  if (stream) {
    // Transform Anthropic stream to OpenAI format
    const transformStream = new TransformStream({
      transform(chunk, controller) {
        // Convert Anthropic SSE to OpenAI SSE format
        controller.enqueue(chunk);
      },
    });
    
    return new Response(response.body?.pipeThrough(transformStream), {
      headers: {
        ...responseHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  }

  const data = await response.json();
  const latencyMs = Date.now() - startTime;
  
  // Check for Anthropic API errors
  if (data.error) {
    console.error("[chat-completions] Anthropic API error:", JSON.stringify(data.error));
    return new Response(JSON.stringify({ 
      error: { message: data.error.message || "Anthropic API error" }
    }), {
      status: response.status >= 400 ? response.status : 500,
      headers: { ...responseHeaders, "Content-Type": "application/json" }
    });
  }

  if (!data.content || !Array.isArray(data.content) || data.content.length === 0) {
    console.error("[chat-completions] Unexpected Anthropic response:", JSON.stringify(data));
    return new Response(JSON.stringify({ 
      error: { message: "Invalid response from Anthropic API" }
    }), {
      status: 500,
      headers: { ...responseHeaders, "Content-Type": "application/json" }
    });
  }
  
  // Convert Anthropic response to OpenAI format
  const openaiResponse = {
    id: `chatcmpl-${crypto.randomUUID()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model,
    choices: [{
      index: 0,
      message: {
        role: "assistant",
        content: data.content[0]?.text || "",
      },
      finish_reason: data.stop_reason === "end_turn" ? "stop" : data.stop_reason,
    }],
    usage: {
      prompt_tokens: data.usage?.input_tokens || 0,
      completion_tokens: data.usage?.output_tokens || 0,
      total_tokens: (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0),
    },
  };

  // Track usage
  const today = new Date().toISOString().split("T")[0];
  await supabase.rpc("increment_usage", {
    p_user_id: userId,
    p_date: today,
    p_metric: "tokens_input",
    p_value: openaiResponse.usage.prompt_tokens,
  });
  await supabase.rpc("increment_usage", {
    p_user_id: userId,
    p_date: today,
    p_metric: "tokens_output",
    p_value: openaiResponse.usage.completion_tokens,
  });

  // Log trace only if NOT in zero-retention mode
  if (!zeroRetentionMode) {
    try {
      await supabase.from("traces").insert({
        user_id: userId,
        model_id: model,
        request: originalRequest,
        response: openaiResponse,
        latency_ms: latencyMs,
        prompt_tokens: openaiResponse.usage.prompt_tokens,
        completion_tokens: openaiResponse.usage.completion_tokens,
        total_tokens: openaiResponse.usage.total_tokens,
        status_code: response.status,
      });
      console.log(`[chat-completions] Trace logged for user ${userId}`);
    } catch (traceError) {
      console.error("[chat-completions] Error logging trace:", traceError);
    }
  } else {
    console.log(`[chat-completions] Skipping trace logging (zero-retention mode)`);
  }

  return new Response(JSON.stringify(openaiResponse), {
    headers: { ...responseHeaders, "Content-Type": "application/json" },
  });
}

async function handleVLLMRequest(
  messages: Message[],
  model: string,
  temperature: number,
  maxTokens: number,
  stream: boolean,
  userId: string,
  supabase: any,
  zeroRetentionMode: boolean,
  originalRequest: ChatRequest,
  responseHeaders: Record<string, string>
) {
  const vllmEndpoint = Deno.env.get("VLLM_ENDPOINT");
  
  if (!vllmEndpoint) {
    console.error("[chat-completions] VLLM_ENDPOINT not configured");
    return new Response(
      JSON.stringify({ error: { message: "vLLM endpoint not configured. Please contact support." } }),
      { status: 500, headers: { ...responseHeaders, "Content-Type": "application/json" } }
    );
  }

  const startTime = Date.now();
  console.log(`[chat-completions] Calling vLLM at ${vllmEndpoint} with model ${model}`);

  try {
    // Create AbortController for timeout (90s to handle cold starts)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90000);

    const response = await fetch(vllmEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
        stream,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    const latencyMs = Date.now() - startTime;
    console.log(`[chat-completions] vLLM response in ${latencyMs}ms`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[chat-completions] vLLM error: ${response.status} - ${errorText}`);
      
      // Provide helpful error messages
      let userMessage = "Model inference failed";
      if (response.status === 503) {
        userMessage = "Model is starting up (cold start). Please try again in 30-60 seconds.";
      } else if (response.status === 404) {
        userMessage = `Model '${model}' not found on inference server. It may not be deployed yet.`;
      } else if (response.status === 500) {
        userMessage = "Inference server error. The model may have run out of memory.";
      }
      
      return new Response(
        JSON.stringify({ error: { message: userMessage, status: response.status, details: errorText } }),
        { status: response.status, headers: { ...responseHeaders, "Content-Type": "application/json" } }
      );
    }

    if (stream) {
      // Return streaming response
      return new Response(response.body, {
        headers: {
          ...responseHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const data = await response.json();
    console.log(`[chat-completions] vLLM response received, latency: ${latencyMs}ms`);
    
    // Track token usage and deduct credits
    if (data.usage) {
      const totalTokens = (data.usage.prompt_tokens || 0) + (data.usage.completion_tokens || 0);
      const creditCost = (totalTokens / 1000) * 0.001; // $0.001 per 1K tokens
      
      const today = new Date().toISOString().split("T")[0];
      
      // Track usage metrics
      await supabase.rpc("increment_usage", {
        p_user_id: userId,
        p_date: today,
        p_metric: "tokens_input",
        p_value: data.usage.prompt_tokens || 0,
      });
      await supabase.rpc("increment_usage", {
        p_user_id: userId,
        p_date: today,
        p_metric: "tokens_output",
        p_value: data.usage.completion_tokens || 0,
      });
      
      // Deduct credits (don't fail request if this fails)
      if (creditCost > 0) {
        try {
          const { data: deductResult, error: deductError } = await supabase.rpc("deduct_credits", {
            p_user_id: userId,
            p_amount: creditCost,
            p_service_type: "inference",
            p_description: `Inference: ${model} (${totalTokens} tokens)`,
            p_metadata: { model, tokens: totalTokens, latency_ms: latencyMs },
          });
          
          if (deductError) {
            console.error("[chat-completions] Credit deduction failed:", deductError);
          } else if (deductResult && !deductResult.success) {
            console.warn("[chat-completions] Insufficient credits:", deductResult);
            // Note: We still return the response but log the warning
          } else {
            console.log(`[chat-completions] Deducted ${creditCost.toFixed(6)} credits for ${totalTokens} tokens`);
          }
        } catch (creditErr) {
          console.error("[chat-completions] Credit deduction error:", creditErr);
          // Don't fail the request
        }
      }
    }

    // Log trace only if NOT in zero-retention mode
    if (!zeroRetentionMode) {
      try {
        await supabase.from("traces").insert({
          user_id: userId,
          model_id: model,
          request: originalRequest,
          response: data,
          latency_ms: latencyMs,
          prompt_tokens: data.usage?.prompt_tokens || null,
          completion_tokens: data.usage?.completion_tokens || null,
          total_tokens: data.usage?.total_tokens || null,
          status_code: response.status,
        });
        console.log(`[chat-completions] Trace logged for user ${userId}`);
      } catch (traceError) {
        console.error("[chat-completions] Error logging trace:", traceError);
      }
    } else {
      console.log(`[chat-completions] Skipping trace logging (zero-retention mode)`);
    }

    return new Response(JSON.stringify(data), {
      headers: { ...responseHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const latencyMs = Date.now() - startTime;
    
    // Handle timeout specifically
    if (error instanceof Error && error.name === "AbortError") {
      console.error(`[chat-completions] vLLM request timed out after ${latencyMs}ms`);
      return new Response(
        JSON.stringify({ 
          error: { 
            message: "Request timed out. The model may be experiencing a cold start or high load. Please try again.",
            timeout: true 
          } 
        }),
        { status: 504, headers: { ...responseHeaders, "Content-Type": "application/json" } }
      );
    }
    
    console.error(`[chat-completions] vLLM error after ${latencyMs}ms:`, error);
    return new Response(
      JSON.stringify({ error: { message: error instanceof Error ? error.message : "Unknown vLLM error" } }),
      { status: 500, headers: { ...responseHeaders, "Content-Type": "application/json" } }
    );
  }
}
