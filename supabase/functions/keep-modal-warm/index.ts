import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const VLLM_ENDPOINT = Deno.env.get('VLLM_ENDPOINT');
  
  if (!VLLM_ENDPOINT) {
    console.log('[keep-warm] No VLLM_ENDPOINT configured');
    return new Response(JSON.stringify({ status: 'skipped', reason: 'No endpoint configured' }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
  
  try {
    console.log('[keep-warm] Pinging vLLM endpoint to keep warm...');
    
    // Send a minimal request to keep the container warm
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
    
    const response = await fetch(VLLM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'Qwen/Qwen2.5-0.5B-Instruct', // Smallest model for minimal cost
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
      }),
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    console.log('[keep-warm] Modal ping response:', response.status);
    
    return new Response(JSON.stringify({ 
      status: 'warm', 
      response_code: response.status,
      timestamp: new Date().toISOString()
    }), { 
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[keep-warm] Modal ping failed:', errorMessage);
    
    return new Response(JSON.stringify({ 
      status: 'cold', 
      error: errorMessage,
      timestamp: new Date().toISOString()
    }), { 
      status: 200, // Return 200 even on failure so cron doesn't retry
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

