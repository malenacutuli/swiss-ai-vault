import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const GITHUB_CLIENT_ID = Deno.env.get('GITHUB_CLIENT_ID_INTEGRATION')!;
const GITHUB_CLIENT_SECRET = Deno.env.get('GITHUB_CLIENT_SECRET_INTEGRATION')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('EXTERNAL_SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;
const FRONTEND_URL = "https://swissvault.lovable.app";

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/github-oauth/callback`;
const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize';
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const GITHUB_USER_URL = 'https://api.github.com/user';

const SCOPES = 'repo read:org read:user';

function encryptToken(token: string): string {
  return btoa(token);
}

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[github-oauth] ${req.method} ${path}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ============================================
    // HANDLE POST REQUESTS (from supabase.functions.invoke)
    // ============================================
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      const action = body.action;

      console.log(`[github-oauth] POST action: ${action}`);

      // ACTION: authorize - Return OAuth URL
      if (action === 'authorize') {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
          return new Response(
            JSON.stringify({ error: 'Authorization required' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        const token = authHeader.replace('Bearer ', '');
        const { data: { user }, error: userError } = await supabase.auth.getUser(token);

        if (userError || !user) {
          return new Response(
            JSON.stringify({ error: 'Invalid token' }),
            { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }

        // Generate state for CSRF protection
        const state = btoa(JSON.stringify({
          user_id: user.id,
          timestamp: Date.now(),
          nonce: crypto.randomUUID()
        }));

        // Build GitHub OAuth URL
        const authUrl = new URL(GITHUB_AUTH_URL);
        authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
        authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
        authUrl.searchParams.set('scope', SCOPES);
        authUrl.searchParams.set('state', state);

        console.log(`[github-oauth] Generated auth URL for user ${user.id}`);

        return new Response(
          JSON.stringify({ url: authUrl.toString() }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ============================================
    // HANDLE GET /authorize (legacy path-based routing)
    // ============================================
    if (path.endsWith('/authorize')) {
      const authHeader = req.headers.get('Authorization');
      const queryToken = url.searchParams.get('token');
      const token = authHeader?.replace('Bearer ', '') || queryToken;
      
      if (!token) {
        return new Response(JSON.stringify({ error: 'Authorization required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const state = btoa(JSON.stringify({
        user_id: user.id,
        timestamp: Date.now(),
        nonce: crypto.randomUUID()
      }));

      const authUrl = new URL(GITHUB_AUTH_URL);
      authUrl.searchParams.set('client_id', GITHUB_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      authUrl.searchParams.set('scope', SCOPES);
      authUrl.searchParams.set('state', state);

      console.log(`[github-oauth] Generated auth URL for user ${user.id}`);

      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ============================================
    // HANDLE GET /callback - OAuth callback from GitHub
    // ============================================
    if (path.endsWith('/callback')) {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        console.error('[github-oauth] Error from GitHub:', error);
        return Response.redirect(`${FRONTEND_URL}/chat?error=github_auth_failed`, 302);
      }

      if (!code || !state) {
        console.error('[github-oauth] Missing code or state');
        return Response.redirect(`${FRONTEND_URL}/chat?error=invalid_callback`, 302);
      }

      // Verify state
      let stateData;
      try {
        stateData = JSON.parse(atob(state));
      } catch {
        console.error('[github-oauth] Invalid state token');
        return Response.redirect(`${FRONTEND_URL}/chat?error=invalid_state`, 302);
      }

      const { user_id, timestamp } = stateData;
      
      // Check state expiry (15 minutes)
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        console.error('[github-oauth] State token expired');
        return Response.redirect(`${FRONTEND_URL}/chat?error=state_expired`, 302);
      }

      // Exchange code for access token
      const tokenResponse = await fetch(GITHUB_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          client_secret: GITHUB_CLIENT_SECRET,
          code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('[github-oauth] Token exchange failed:', errorText);
        return Response.redirect(`${FRONTEND_URL}/chat?error=token_exchange_failed`, 302);
      }

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        console.error('[github-oauth] Token error:', tokenData.error);
        return Response.redirect(`${FRONTEND_URL}/chat?error=token_error`, 302);
      }

      const { access_token, scope } = tokenData;

      console.log('[github-oauth] Token exchange successful, scopes:', scope);

      // Get user info
      const userResponse = await fetch(GITHUB_USER_URL, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SwissVault-Integration',
        },
      });

      if (!userResponse.ok) {
        console.error('[github-oauth] Failed to get user info');
        return Response.redirect(`${FRONTEND_URL}/chat?error=userinfo_failed`, 302);
      }

      const userInfo = await userResponse.json();

      console.log(`[github-oauth] Connected for: ${userInfo.login}`);

      // Store integration
      const { data: existing } = await supabase
        .from('chat_integrations')
        .select('id')
        .eq('user_id', user_id)
        .eq('integration_type', 'github')
        .maybeSingle();

      const integrationData = {
        user_id,
        integration_type: 'github',
        integration_name: userInfo.login,
        encrypted_access_token: encryptToken(access_token),
        metadata: {
          username: userInfo.login,
          avatar_url: userInfo.avatar_url,
          name: userInfo.name,
          email: userInfo.email,
          bio: userInfo.bio,
          public_repos: userInfo.public_repos,
          followers: userInfo.followers,
          html_url: userInfo.html_url,
          scopes: scope,
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
          console.error('[github-oauth] Failed to update integration:', updateError);
          return Response.redirect(`${FRONTEND_URL}/chat?error=db_error`, 302);
        }
      } else {
        const { error: insertError } = await supabase
          .from('chat_integrations')
          .insert(integrationData);

        if (insertError) {
          console.error('[github-oauth] Failed to insert integration:', insertError);
          return Response.redirect(`${FRONTEND_URL}/chat?error=db_error`, 302);
        }
      }

      console.log(`[github-oauth] Integration saved for user ${user_id}`);
      return Response.redirect(`${FRONTEND_URL}/chat?success=github`, 302);
    }

    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[github-oauth] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
