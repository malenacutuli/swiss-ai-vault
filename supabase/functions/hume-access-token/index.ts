import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { getCorsHeaders, handleCors } from '../_shared/cors.ts';

serve(async (req) => {
  // Handle CORS preflight
  const corsResponse = handleCors(req);
  if (corsResponse) return corsResponse;

  const corsHeaders = getCorsHeaders(req);

  try {
    // Get voice provider API credentials
    const humeApiKey = Deno.env.get('HUME_API_KEY');
    const humeSecretKey = Deno.env.get('HUME_SECRET_KEY');

    if (!humeApiKey || !humeSecretKey) {
      console.error('[Voice] API credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Voice service is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Fetch access token from Hume API
    const credentials = btoa(`${humeApiKey}:${humeSecretKey}`);
    
    const tokenResponse = await fetch('https://api.hume.ai/oauth2-cc/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('[Voice] Token error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to get voice access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    
    console.log('[Voice] Access token generated');

    return new Response(
      JSON.stringify({ 
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[Voice] Error generating token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
