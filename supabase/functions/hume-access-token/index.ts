import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

  try {
    // Get Hume API credentials
    const humeApiKey = Deno.env.get('HUME_API_KEY');
    const humeSecretKey = Deno.env.get('HUME_SECRET_KEY');

    if (!humeApiKey || !humeSecretKey) {
      console.error('Hume API credentials not configured');
      return new Response(
        JSON.stringify({ error: 'Hume API not configured' }),
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
      console.error('Hume token error:', errorText);
      return new Response(
        JSON.stringify({ error: 'Failed to get Hume access token' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const tokenData = await tokenResponse.json();
    
    console.log('Hume access token generated for voice avatar');

    return new Response(
      JSON.stringify({ 
        accessToken: tokenData.access_token,
        expiresIn: tokenData.expires_in 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in hume-access-token:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
