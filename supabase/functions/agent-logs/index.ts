// Agent Logs Edge Function
// SIMPLIFIED - returns empty logs to avoid cross-project auth issues
// Real logs come from agent-status endpoint

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  return new Response(
    JSON.stringify({
      logs: [],
      count: 0,
      next_cursor: null,
      has_more: false,
      message: 'Use agent-status for logs',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
});
