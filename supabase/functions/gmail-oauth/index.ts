import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID')!;
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('EXTERNAL_SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/gmail-oauth/callback`;
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v2/userinfo';

const SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/userinfo.email',
].join(' ');

// Simple encryption for storing tokens
function encryptToken(token: string): string {
  return btoa(token);
}

function decryptToken(encrypted: string): string {
  return atob(encrypted);
}

// Generate PKCE code verifier
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// Generate PKCE code challenge (SHA256)
async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`Gmail OAuth request: ${path}`);

  try {
    // Route: /gmail-oauth/authorize - Start OAuth flow
    if (path.endsWith('/authorize')) {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Authorization required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate PKCE code verifier and challenge
      const codeVerifier = generateCodeVerifier();
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      // Generate state token with user ID and code verifier
      const state = btoa(JSON.stringify({
        user_id: user.id,
        code_verifier: codeVerifier,
        timestamp: Date.now(),
        nonce: crypto.randomUUID()
      }));

      // Build Google OAuth URL
      const authUrl = new URL(GOOGLE_AUTH_URL);
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', SCOPES);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('code_challenge', codeChallenge);
      authUrl.searchParams.set('code_challenge_method', 'S256');

      console.log(`Generated Gmail OAuth URL for user ${user.id}`);

      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: /gmail-oauth/callback - Handle OAuth callback
    if (path.endsWith('/callback')) {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        console.error('Gmail OAuth error:', error);
        return Response.redirect(`${url.origin}/dashboard/settings?error=gmail_auth_failed`);
      }

      if (!code || !state) {
        console.error('Missing code or state');
        return Response.redirect(`${url.origin}/dashboard/settings?error=invalid_callback`);
      }

      // Verify state and extract data
      let stateData;
      try {
        stateData = JSON.parse(atob(state));
      } catch {
        console.error('Invalid state token');
        return Response.redirect(`${url.origin}/dashboard/settings?error=invalid_state`);
      }

      const { user_id, code_verifier, timestamp } = stateData;
      
      // Check state expiry (15 minutes)
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        console.error('State token expired');
        return Response.redirect(`${url.origin}/dashboard/settings?error=state_expired`);
      }

      // Exchange code for tokens with PKCE verifier
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          code,
          code_verifier,
          grant_type: 'authorization_code',
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token exchange failed:', errorText);
        return Response.redirect(`${url.origin}/dashboard/settings?error=token_exchange_failed`);
      }

      const tokenData = await tokenResponse.json();
      console.log('Token exchange successful');

      const {
        access_token,
        refresh_token,
        expires_in,
      } = tokenData;

      // Get user email
      const userInfoResponse = await fetch(GOOGLE_USERINFO_URL, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
        },
      });

      if (!userInfoResponse.ok) {
        console.error('Failed to get user info');
        return Response.redirect(`${url.origin}/dashboard/settings?error=userinfo_failed`);
      }

      const userInfo = await userInfoResponse.json();
      const email = userInfo.email;

      console.log(`Gmail connected for: ${email}`);

      // Calculate token expiry
      const tokenExpiry = new Date(Date.now() + (expires_in * 1000)).toISOString();

      // Store integration in database
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Check if integration already exists
      const { data: existing } = await supabase
        .from('chat_integrations')
        .select('id')
        .eq('user_id', user_id)
        .eq('integration_type', 'gmail')
        .maybeSingle();

      const integrationData = {
        user_id,
        integration_type: 'gmail',
        integration_name: email,
        encrypted_access_token: encryptToken(access_token),
        encrypted_refresh_token: refresh_token ? encryptToken(refresh_token) : null,
        token_expires_at: tokenExpiry,
        metadata: {
          email,
          token_expiry: tokenExpiry,
        },
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (existing) {
        const { error: updateError } = await supabase
          .from('chat_integrations')
          .update(integrationData)
          .eq('id', existing.id);

        if (updateError) {
          console.error('Failed to update integration:', updateError);
          return Response.redirect(`${url.origin}/dashboard/settings?error=db_error`);
        }
      } else {
        const { error: insertError } = await supabase
          .from('chat_integrations')
          .insert(integrationData);

        if (insertError) {
          console.error('Failed to insert integration:', insertError);
          return Response.redirect(`${url.origin}/dashboard/settings?error=db_error`);
        }
      }

      console.log(`Gmail integration saved for user ${user_id}`);

      return Response.redirect(`${url.origin}/dashboard/settings?gmail=connected`);
    }

    // Route: /gmail-oauth/refresh - Refresh access token
    if (path.endsWith('/refresh')) {
      const { integration_id } = await req.json();

      if (!integration_id) {
        return new Response(JSON.stringify({ error: 'integration_id required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: integration, error: intError } = await supabase
        .from('chat_integrations')
        .select('*')
        .eq('id', integration_id)
        .single();

      if (intError || !integration) {
        return new Response(JSON.stringify({ error: 'Integration not found' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      if (!integration.encrypted_refresh_token) {
        return new Response(JSON.stringify({ error: 'No refresh token available' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const refreshToken = decryptToken(integration.encrypted_refresh_token);

      // Refresh the token
      const tokenResponse = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('Token refresh failed:', errorText);
        return new Response(JSON.stringify({ error: 'Token refresh failed' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const tokenData = await tokenResponse.json();
      const tokenExpiry = new Date(Date.now() + (tokenData.expires_in * 1000)).toISOString();

      // Update stored token
      await supabase
        .from('chat_integrations')
        .update({
          encrypted_access_token: encryptToken(tokenData.access_token),
          token_expires_at: tokenExpiry,
          metadata: {
            ...integration.metadata,
            token_expiry: tokenExpiry,
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', integration_id);

      console.log(`Gmail token refreshed for integration ${integration_id}`);

      return new Response(JSON.stringify({ 
        success: true,
        expires_at: tokenExpiry,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Gmail OAuth error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
