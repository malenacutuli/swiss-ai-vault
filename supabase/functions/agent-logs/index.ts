// Agent Logs Edge Function
// SIMPLIFIED - returns empty logs to avoid cross-project auth issues
// Real logs come from agent-status endpoint

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

serve(async (req) => {
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

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
