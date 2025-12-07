import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const NOTION_CLIENT_ID = Deno.env.get('NOTION_CLIENT_ID')!;
const NOTION_CLIENT_SECRET = Deno.env.get('NOTION_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('EXTERNAL_SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/notion-oauth/callback`;
const NOTION_AUTH_URL = 'https://api.notion.com/v1/oauth/authorize';
const NOTION_TOKEN_URL = 'https://api.notion.com/v1/oauth/token';

// Simple encryption for storing tokens (in production, use proper encryption)
function encryptToken(token: string): string {
  // Base64 encode for simple obfuscation - in production use proper AES encryption
  return btoa(token);
}

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`Notion OAuth request: ${path}`);

  try {
    // Route: /notion-oauth/authorize - Start OAuth flow
    if (path.endsWith('/authorize')) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      // Verify JWT and get user
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate state token with user ID
      const state = btoa(JSON.stringify({
        user_id: user.id,
        timestamp: Date.now(),
        nonce: crypto.randomUUID()
      }));

      // Build Notion OAuth URL
      const authUrl = new URL(NOTION_AUTH_URL);
      authUrl.searchParams.set('client_id', NOTION_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('owner', 'user');
      authUrl.searchParams.set('state', state);

      console.log(`Generated OAuth URL for user ${user.id}`);

      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: /notion-oauth/callback - Handle OAuth callback
    if (path.endsWith('/callback')) {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        console.error('Notion OAuth error:', error);
        return Response.redirect(`${url.origin}/dashboard/settings?error=notion_auth_failed`);
      }

      if (!code || !state) {
        console.error('Missing code or state');
        return Response.redirect(`${url.origin}/dashboard/settings?error=invalid_callback`);
      }

      // Verify state and extract user ID
      let stateData;
      try {
        stateData = JSON.parse(atob(state));
      } catch {
        console.error('Invalid state token');
        return Response.redirect(`${url.origin}/dashboard/settings?error=invalid_state`);
      }

      const { user_id, timestamp } = stateData;
      
      // Check state expiry (15 minutes)
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        console.error('State token expired');
        return Response.redirect(`${url.origin}/dashboard/settings?error=state_expired`);
      }

      // Exchange code for access token
      const basicAuth = btoa(`${NOTION_CLIENT_ID}:${NOTION_CLIENT_SECRET}`);
      
      const tokenResponse = await fetch(NOTION_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${basicAuth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        return Response.redirect(`${url.origin}/dashboard/settings?error=token_exchange_failed`);
      }

      const tokenData = await tokenResponse.json();
      console.log('Token exchange successful:', {
        workspace_id: tokenData.workspace_id,
        workspace_name: tokenData.workspace_name,
        bot_id: tokenData.bot_id,
      });

      const {
        access_token,
        workspace_id,
        workspace_name,
        bot_id,
      } = tokenData;

      // Store integration in database
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Check if integration already exists for this user and workspace
      const { data: existing } = await supabase
        .from('chat_integrations')
        .select('id')
        .eq('user_id', user_id)
        .eq('integration_type', 'notion')
        .single();

      const integrationData = {
        user_id,
        integration_type: 'notion',
        integration_name: workspace_name || 'Notion Workspace',
        encrypted_access_token: encryptToken(access_token),
        metadata: {
          workspace_id,
          workspace_name,
          bot_id,
        },
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        // Update existing integration
        const { error: updateError } = await supabase
          .from('chat_integrations')
          .update(integrationData)
          .eq('id', existing.id);

        if (updateError) {
          console.error('Failed to update integration:', updateError);
          return Response.redirect(`${url.origin}/dashboard/settings?error=db_error`);
        }
      } else {
        // Create new integration
        const { error: insertError } = await supabase
          .from('chat_integrations')
          .insert(integrationData);

        if (insertError) {
          console.error('Failed to insert integration:', insertError);
          return Response.redirect(`${url.origin}/dashboard/settings?error=db_error`);
        }
      }

      console.log(`Notion integration saved for user ${user_id}`);

      // Redirect to success page
      return Response.redirect(`${url.origin}/dashboard/settings?notion=connected`);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Notion OAuth error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
