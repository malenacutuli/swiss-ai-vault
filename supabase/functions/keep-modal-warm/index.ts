import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Define Modal health endpoints to ping
const MODAL_ENDPOINTS = [
  {
    name: 'inference-small',
    healthUrl: 'https://malena--swissvault-inference-health.modal.run',
    description: 'Small models (1B-3B)',
  },
  {
    name: 'inference-7b',
    healthUrl: 'https://malena--swissvault-inference-7b-health.modal.run',
    description: '7B+ models',
  },
];

interface EndpointResult {
  name: string;
  status: 'warm' | 'cold' | 'error';
  latency: number;
  httpStatus?: number;
  error?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const results: EndpointResult[] = [];
  const startTime = Date.now();

  console.log('[keep-warm] Starting warmth check for Modal endpoints...');

  // Also check the main VLLM_ENDPOINT if configured
  const VLLM_ENDPOINT = Deno.env.get('VLLM_ENDPOINT');
  
  // Ping health endpoints in parallel
  const pingPromises = MODAL_ENDPOINTS.map(async (endpoint) => {
    const pingStart = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);
      
      const response = await fetch(endpoint.healthUrl, {
        method: 'GET',
        headers: { 
          'X-Keep-Warm': 'true',
          'Accept': 'application/json',
        },
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);
      
      const result: EndpointResult = {
        name: endpoint.name,
        status: response.ok ? 'warm' : 'cold',
        latency: Date.now() - pingStart,
        httpStatus: response.status,
      };
      
      console.log(`[keep-warm] ${endpoint.name}: ${result.status} (${result.latency}ms)`);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[keep-warm] ${endpoint.name} failed:`, errorMessage);
      
      return {
        name: endpoint.name,
        status: 'error' as const,
        latency: Date.now() - pingStart,
        error: errorMessage,
      };
    }
  });

  // Also ping the main VLLM endpoint with a minimal request if configured
  if (VLLM_ENDPOINT) {
    pingPromises.push((async () => {
      const pingStart = Date.now();
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);
        
        const response = await fetch(VLLM_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'Qwen/Qwen2.5-0.5B-Instruct',
            messages: [{ role: 'user', content: 'ping' }],
            max_tokens: 1,
          }),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        return {
          name: 'vllm-main',
          status: response.ok ? 'warm' : 'cold',
          latency: Date.now() - pingStart,
          httpStatus: response.status,
        } as EndpointResult;
      } catch (error) {
        return {
          name: 'vllm-main',
          status: 'error' as const,
          latency: Date.now() - pingStart,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })());
  }

  const endpointResults = await Promise.all(pingPromises);
  results.push(...endpointResults);

  const totalLatency = Date.now() - startTime;
  const warmCount = results.filter(r => r.status === 'warm').length;
  
  console.log(`[keep-warm] Completed: ${warmCount}/${results.length} warm, total ${totalLatency}ms`);

  return new Response(JSON.stringify({
    success: true,
    timestamp: new Date().toISOString(),
    totalLatency,
    warmCount,
    totalEndpoints: results.length,
    endpoints: results,
  }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
