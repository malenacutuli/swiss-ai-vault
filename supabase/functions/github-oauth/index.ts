import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GITHUB_CLIENT_ID = Deno.env.get('GITHUB_CLIENT_ID_INTEGRATION')!;
const GITHUB_CLIENT_SECRET = Deno.env.get('GITHUB_CLIENT_SECRET_INTEGRATION')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('EXTERNAL_SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;

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

  console.log(`GitHub OAuth request: ${path}`);

  try {
    // Route: /github-oauth/authorize - Start OAuth flow
    if (path.endsWith('/authorize')) {
      // Accept token from header OR query param
      const authHeader = req.headers.get('Authorization');
      const queryToken = url.searchParams.get('token');
      const token = authHeader?.replace('Bearer ', '') || queryToken;
      
      if (!token) {
        return new Response(JSON.stringify({ error: 'Authorization required' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid authorization' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate state token
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

      console.log(`Generated GitHub OAuth URL for user ${user.id}`);

      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Route: /github-oauth/callback - Handle OAuth callback
    if (path.endsWith('/callback')) {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        console.error('GitHub OAuth error:', error);
        return Response.redirect(`${url.origin}/chat?error=github_auth_failed`);
      }

      if (!code || !state) {
        console.error('Missing code or state');
        return Response.redirect(`${url.origin}/chat?error=invalid_callback`);
      }

      // Verify state
      let stateData;
      try {
        stateData = JSON.parse(atob(state));
      } catch {
        console.error('Invalid state token');
        return Response.redirect(`${url.origin}/chat?error=invalid_state`);
      }

      const { user_id, timestamp } = stateData;
      
      // Check state expiry (15 minutes)
      if (Date.now() - timestamp > 15 * 60 * 1000) {
        console.error('State token expired');
        return Response.redirect(`${url.origin}/chat?error=state_expired`);
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
        console.error('Token exchange failed:', errorText);
        return Response.redirect(`${url.origin}/chat?error=token_exchange_failed`);
      }

      const tokenData = await tokenResponse.json();

      if (tokenData.error) {
        console.error('GitHub token error:', tokenData.error);
        return Response.redirect(`${url.origin}/chat?error=token_error`);
      }

      const { access_token, scope } = tokenData;

      console.log('Token exchange successful, scopes:', scope);

      // Get user info
      const userResponse = await fetch(GITHUB_USER_URL, {
        headers: {
          'Authorization': `Bearer ${access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'SwissVault-Integration',
        },
      });

      if (!userResponse.ok) {
        console.error('Failed to get user info');
        return Response.redirect(`${url.origin}/chat?error=userinfo_failed`);
      }

      const userInfo = await userResponse.json();

      console.log(`GitHub connected for: ${userInfo.login}`);

      // Store integration
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Check if integration already exists
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
          console.error('Failed to update integration:', updateError);
          return Response.redirect(`${url.origin}/chat?error=db_error`);
        }
      } else {
        const { error: insertError } = await supabase
          .from('chat_integrations')
          .insert(integrationData);

        if (insertError) {
          console.error('Failed to insert integration:', insertError);
          return Response.redirect(`${url.origin}/chat?error=db_error`);
        }
      }

      console.log(`GitHub integration saved for user ${user_id}`);

      return Response.redirect(`${url.origin}/chat?success=github`);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('GitHub OAuth error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
