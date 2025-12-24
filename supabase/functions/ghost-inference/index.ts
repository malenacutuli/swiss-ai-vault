import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

/**
 * Ghost Inference - Zero-Retention AI Inference
 * 
 * CRITICAL PRIVACY GUARANTEES:
 * 1. NO message content is ever logged
 * 2. NO prompts or responses stored in database
 * 3. Only metadata (tokens, model, timestamp) is recorded
 * 4. All inference happens on Swiss-hosted infrastructure
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GhostRequest {
  model: string;
  messages: { role: string; content: string }[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  system_prompt?: string;
}

interface Message {
  role: string;
  content: string;
}

// Swiss-hosted model endpoints (AWS Zurich / Swiss data centers)
const SWISS_MODELS: Record<string, { endpoint: string; modelName: string }> = {
  'llama-3.1-70b-swiss': {
    endpoint: Deno.env.get('VLLM_ENDPOINT') || 'https://swiss-vllm.swissvault.ai/v1/chat/completions',
    modelName: 'meta-llama/Llama-3.1-70B-Instruct'
  },
  'qwen-2.5-72b-swiss': {
    endpoint: Deno.env.get('VLLM_ENDPOINT') || 'https://swiss-vllm.swissvault.ai/v1/chat/completions',
    modelName: 'Qwen/Qwen2.5-72B-Instruct'
  },
  'mistral-7b-swiss': {
    endpoint: Deno.env.get('VLLM_ENDPOINT') || 'https://swiss-vllm.swissvault.ai/v1/chat/completions',
    modelName: 'mistralai/Mistral-7B-Instruct-v0.3'
  }
};

// Minimum credits required to make a request
const MIN_CREDITS_REQUIRED = 100;

/**
 * Estimate token count from messages
 * Uses a simple heuristic: ~4 characters per token
 */
function estimateTokens(messages: Message[]): number {
  const totalChars = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  return Math.ceil(totalChars / 4);
}

/**
 * Estimate tokens from response text
 */
function estimateOutputTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    // 1. Verify user is authenticated
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.log('[Ghost Inference] No authorization header');
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create Supabase client with user's auth
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      console.log('[Ghost Inference] Auth failed:', authError?.message);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = user.id;
    console.log(`[Ghost Inference] User ${userId.slice(0, 8)}... authenticated`);

    // 2. Check user usage via RPC (properly checks all credit types)
    const { data: usageCheck, error: usageError } = await supabase
      .rpc('check_user_usage', {
        p_user_id: userId,
        p_usage_type: 'text',
        p_estimated_cost_cents: 0
      });

    if (usageError) {
      console.error('[Ghost Inference] Usage check error:', usageError);
      // Don't block on RPC error - allow request to proceed
    }

    // Only block if explicitly not allowed
    if (usageCheck && usageCheck.allowed === false) {
      console.log(`[Ghost Inference] Insufficient credits - reason: ${usageCheck.reason}`);
      return new Response(
        JSON.stringify({ 
          error: usageCheck.reason || 'Insufficient credits',
          balance: usageCheck.balance || 0,
          daily_remaining: usageCheck.daily_remaining || 0,
          required: MIN_CREDITS_REQUIRED
        }),
        { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[Ghost Inference] Credits OK - balance: ${usageCheck?.balance}, daily: ${usageCheck?.daily_remaining}`);

    // 3. Parse and validate request
    const body = await req.json() as GhostRequest;
    const { model, messages, stream = false, temperature = 0.7, top_p = 0.9, max_tokens = 4096, system_prompt } = body;

    // Prepend system prompt if provided
    const finalMessages = system_prompt 
      ? [{ role: 'system', content: system_prompt }, ...messages]
      : messages;

    if (!model || !messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: model and messages required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 4. Validate model is Swiss-hosted only
    const modelConfig = SWISS_MODELS[model];
    if (!modelConfig) {
      console.log(`[Ghost Inference] Invalid model: ${model}`);
      return new Response(
        JSON.stringify({ 
          error: 'Only Swiss-hosted models allowed in Ghost Mode',
          allowedModels: Object.keys(SWISS_MODELS)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate input tokens (for deduction estimation)
    const inputTokens = estimateTokens(messages);
    console.log(`[Ghost Inference] Model: ${model}, Input tokens: ~${inputTokens}, Stream: ${stream}`);

    // 5. Forward to Swiss vLLM (NO content logging)
    // CRITICAL: We do NOT log any message content here
    const vllmResponse = await fetch(modelConfig.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth header if VLLM requires it
        ...(Deno.env.get('VLLM_API_KEY') && { 
          'Authorization': `Bearer ${Deno.env.get('VLLM_API_KEY')}` 
        })
      },
      body: JSON.stringify({
        model: modelConfig.modelName,
        messages: finalMessages,
        stream,
        temperature,
        top_p,
        max_tokens
      })
    });

    if (!vllmResponse.ok) {
      const errorText = await vllmResponse.text();
      console.error(`[Ghost Inference] vLLM error: ${vllmResponse.status} - ${errorText.slice(0, 200)}`);
      return new Response(
        JSON.stringify({ error: 'Inference failed', details: 'Swiss AI service unavailable' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Handle streaming response
    if (stream) {
      // For streaming, we'll estimate output tokens and deduct after
      // Create a transform stream to count output tokens
      let outputTokenEstimate = 0;
      
      const transformStream = new TransformStream({
        transform(chunk, controller) {
          // Pass through the chunk
          controller.enqueue(chunk);
          
          // Estimate tokens from chunk (rough approximation)
          const text = new TextDecoder().decode(chunk);
          outputTokenEstimate += Math.ceil(text.length / 4);
        },
        async flush() {
          // Deduct credits after streaming completes
          const totalTokens = inputTokens + outputTokenEstimate;
          
          // Use service role for credit deduction
          const serviceClient = createClient(
            supabaseUrl,
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
          );
          
          await serviceClient.rpc('deduct_ghost_credits', {
            p_user_id: userId,
            p_amount: totalTokens
          });
          
          // Log usage metadata only (NO content)
          await serviceClient.from('ghost_usage').insert({
            user_id: userId,
            model_id: model,
            input_tokens: inputTokens,
            output_tokens: outputTokenEstimate
          });
          
          console.log(`[Ghost Inference] Stream complete. Tokens: ${inputTokens}+${outputTokenEstimate}=${totalTokens}`);
        }
      });

      const responseStream = vllmResponse.body?.pipeThrough(transformStream);
      
      return new Response(responseStream, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive'
        }
      });
    }

    // 7. Handle non-streaming response
    const responseData = await vllmResponse.json();
    
    // Calculate output tokens from response
    let outputTokens = 0;
    if (responseData.usage?.completion_tokens) {
      outputTokens = responseData.usage.completion_tokens;
    } else if (responseData.choices?.[0]?.message?.content) {
      outputTokens = estimateOutputTokens(responseData.choices[0].message.content);
    }
    
    const totalTokens = inputTokens + outputTokens;
    const processingTime = Date.now() - startTime;
    
    // Use service role for credit deduction and logging
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Deduct credits
    const { data: deductResult, error: deductError } = await serviceClient.rpc('deduct_ghost_credits', {
      p_user_id: userId,
      p_amount: totalTokens
    });
    
    if (deductError) {
      console.error('[Ghost Inference] Credit deduction failed:', deductError);
      // Still return the response, but log the issue
    }

    // 8. Log usage WITHOUT content - CRITICAL PRIVACY REQUIREMENT
    await serviceClient.from('ghost_usage').insert({
      user_id: userId,
      model_id: model,
      input_tokens: inputTokens,
      output_tokens: outputTokens
      // NEVER log: messages, prompts, responses, or any content
    });

    console.log(`[Ghost Inference] Complete. Tokens: ${inputTokens}+${outputTokens}=${totalTokens}, Time: ${processingTime}ms`);

    // Return response
    return new Response(JSON.stringify(responseData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[Ghost Inference] Error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error', message: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
