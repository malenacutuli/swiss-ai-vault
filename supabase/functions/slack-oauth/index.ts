import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SLACK_CLIENT_ID = Deno.env.get('SLACK_CLIENT_ID')!;
const SLACK_CLIENT_SECRET = Deno.env.get('SLACK_CLIENT_SECRET')!;
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || Deno.env.get('EXTERNAL_SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('EXTERNAL_SUPABASE_SERVICE_ROLE_KEY')!;

const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/slack-oauth/callback`;
const SLACK_SCOPES = 'channels:read,channels:history,users:read,team:read';
// Use environment variable for frontend URL, fallback to Lovable preview domain
const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://d6ec0fb6-7421-4eea-a7d4-a0683f6f1c47.lovableproject.com';

// Simple encryption for storing credentials (in production, use proper key management)
async function encryptCredentials(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(data);
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(SLACK_CLIENT_SECRET.slice(0, 32).padEnd(32, '0')),
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    dataBuffer
  );
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

serve(async (req) => {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log(`[slack-oauth] Request to path: ${path}, method: ${req.method}`);

  try {
    // Route: /slack-oauth/authorize - Start OAuth flow
    if (path.endsWith('/authorize') || path === '/slack-oauth') {
      // Get user ID from JWT - accept from header OR query param
      const authHeader = req.headers.get('Authorization');
      const queryToken = url.searchParams.get('token');
      const token = authHeader?.replace('Bearer ', '') || queryToken;
      
      if (!token) {
        console.error('[slack-oauth] No authorization token');
        return Response.redirect(`${FRONTEND_URL}/chat?error=unauthorized`, 302);
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        console.error('[slack-oauth] Auth error:', authError);
        return Response.redirect(`${FRONTEND_URL}/chat?error=unauthorized`, 302);
      }

      // Generate state token (includes user ID for callback verification)
      const state = crypto.randomUUID() + '|' + user.id;
      const stateEncoded = btoa(state);

      // Store state in database for verification
      await supabase.from('chat_integrations').upsert({
        user_id: user.id,
        integration_type: 'slack_pending',
        integration_name: 'Slack (pending)',
        encrypted_access_token: stateEncoded, // Temporary storage for state
        is_active: false,
        metadata: { state_created_at: new Date().toISOString() }
      }, { 
        onConflict: 'user_id,integration_type',
        ignoreDuplicates: false 
      });

      // Build Slack OAuth URL
      const slackAuthUrl = new URL('https://slack.com/oauth/v2/authorize');
      slackAuthUrl.searchParams.set('client_id', SLACK_CLIENT_ID);
      slackAuthUrl.searchParams.set('scope', SLACK_SCOPES);
      slackAuthUrl.searchParams.set('redirect_uri', REDIRECT_URI);
      slackAuthUrl.searchParams.set('state', stateEncoded);

      console.log(`[slack-oauth] Redirecting to Slack OAuth for user: ${user.id}`);

      return Response.redirect(slackAuthUrl.toString(), 302);
    }

    // Route: /slack-oauth/callback - Handle OAuth callback
    if (path.endsWith('/callback')) {
      const code = url.searchParams.get('code');
      const stateParam = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        console.error('[slack-oauth] Slack returned error:', error);
        return Response.redirect(`${FRONTEND_URL}/chat?error=slack_denied`, 302);
      }

      if (!code || !stateParam) {
        console.error('[slack-oauth] Missing code or state');
        return Response.redirect(`${FRONTEND_URL}/chat?error=invalid_request`, 302);
      }

      // Decode state to get user ID
      let userId: string;
      try {
        const decoded = atob(stateParam);
        const parts = decoded.split('|');
        if (parts.length !== 2) throw new Error('Invalid state format');
        userId = parts[1];
      } catch (e) {
        console.error('[slack-oauth] Invalid state:', e);
        return Response.redirect(`${FRONTEND_URL}/chat?error=invalid_state`, 302);
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

      // Verify state matches what we stored
      const { data: pendingIntegration } = await supabase
        .from('chat_integrations')
        .select('*')
        .eq('user_id', userId)
        .eq('integration_type', 'slack_pending')
        .single();

      if (!pendingIntegration || pendingIntegration.encrypted_access_token !== stateParam) {
        console.error('[slack-oauth] State mismatch');
        return Response.redirect(`${FRONTEND_URL}/chat?error=invalid_state`, 302);
      }

      // Exchange code for access token
      console.log('[slack-oauth] Exchanging code for token...');
      const tokenResponse = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: SLACK_CLIENT_ID,
          client_secret: SLACK_CLIENT_SECRET,
          code: code,
          redirect_uri: REDIRECT_URI,
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenData.ok) {
        console.error('[slack-oauth] Token exchange failed:', tokenData.error);
        return Response.redirect(`${FRONTEND_URL}/chat?error=token_failed`, 302);
      }

      console.log('[slack-oauth] Token exchange successful for team:', tokenData.team?.name);

      // Encrypt the access token before storage
      const encryptedToken = await encryptCredentials(tokenData.access_token);

      // Delete pending integration
      await supabase
        .from('chat_integrations')
        .delete()
        .eq('user_id', userId)
        .eq('integration_type', 'slack_pending');

      // Check if Slack integration already exists
      const { data: existingIntegration } = await supabase
        .from('chat_integrations')
        .select('id')
        .eq('user_id', userId)
        .eq('integration_type', 'slack')
        .single();

      if (existingIntegration) {
        // Update existing integration
        await supabase
          .from('chat_integrations')
          .update({
            encrypted_access_token: encryptedToken,
            is_active: true,
            metadata: {
              team_id: tokenData.team?.id,
              team_name: tokenData.team?.name,
              bot_user_id: tokenData.bot_user_id,
              scope: tokenData.scope,
              connected_at: new Date().toISOString(),
            },
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingIntegration.id);

        console.log('[slack-oauth] Updated existing Slack integration');
      } else {
        // Create new integration
        await supabase.from('chat_integrations').insert({
          user_id: userId,
          integration_type: 'slack',
          integration_name: `Slack - ${tokenData.team?.name || 'Workspace'}`,
          encrypted_access_token: encryptedToken,
          is_active: true,
          metadata: {
            team_id: tokenData.team?.id,
            team_name: tokenData.team?.name,
            bot_user_id: tokenData.bot_user_id,
            scope: tokenData.scope,
            connected_at: new Date().toISOString(),
          },
        });

        console.log('[slack-oauth] Created new Slack integration');
      }

      return Response.redirect(`${FRONTEND_URL}/chat?success=slack`, 302);
    }

    // Unknown route
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('[slack-oauth] Error:', error);
    return Response.redirect(`${FRONTEND_URL}/chat?error=server_error`, 302);
  }
});
