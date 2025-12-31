import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const GOOGLE_CLIENT_ID = Deno.env.get('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = Deno.env.get('GOOGLE_CLIENT_SECRET');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

// Proper AES-GCM encryption for tokens
async function encryptToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const dataBuffer = encoder.encode(token);
  // Use a portion of GOOGLE_CLIENT_SECRET as key material (padded to 32 bytes for AES-256)
  const keyMaterial = encoder.encode((GOOGLE_CLIENT_SECRET || '').slice(0, 32).padEnd(32, '0'));
  const key = await crypto.subtle.importKey(
    'raw',
    keyMaterial,
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
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const isCallback = url.pathname.endsWith('/callback');

  try {
    if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
      throw new Error('Google OAuth credentials not configured');
    }

    // Get redirect base URL from request origin or env
    const origin = req.headers.get('origin') || Deno.env.get('APP_URL') || 'https://lovable.dev';
    const redirectUri = `${SUPABASE_URL}/functions/v1/googledrive-oauth/callback`;

    if (isCallback) {
      // Handle OAuth callback
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');

      if (error) {
        console.error('[GoogleDrive OAuth] Error:', error);
        return Response.redirect(`${origin}/chat?error=google_auth_failed`);
      }

      if (!code || !state) {
        return Response.redirect(`${origin}/chat?error=missing_params`);
      }

      // Verify state and get user
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      const { data: stateData, error: stateError } = await supabase
        .from('oauth_states')
        .select('user_id, expires_at')
        .eq('state', state)
        .eq('provider', 'googledrive')
        .single();

      if (stateError || !stateData) {
        console.error('[GoogleDrive OAuth] Invalid state:', stateError);
        return Response.redirect(`${origin}/chat?error=invalid_state`);
      }

      // Check expiry
      if (new Date(stateData.expires_at) < new Date()) {
        await supabase.from('oauth_states').delete().eq('state', state);
        return Response.redirect(`${origin}/chat?error=state_expired`);
      }

      // Exchange code for tokens
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      const tokens = await tokenResponse.json();

      if (!tokenResponse.ok || !tokens.access_token) {
        console.error('[GoogleDrive OAuth] Token exchange failed:', tokens);
        return Response.redirect(`${origin}/chat?error=token_exchange_failed`);
      }

      // Get user info for integration name
      const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userInfoResponse.json();

      // Encrypt tokens with AES-GCM before storage
      const encryptedAccessToken = await encryptToken(tokens.access_token);
      const encryptedRefreshToken = tokens.refresh_token ? await encryptToken(tokens.refresh_token) : null;

      // Store integration
      const expiresAt = tokens.expires_in 
        ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
        : null;

      const { error: insertError } = await supabase
        .from('chat_integrations')
        .upsert({
          user_id: stateData.user_id,
          integration_type: 'googledrive',
          integration_name: userInfo.email || 'Google Drive',
          encrypted_access_token: encryptedAccessToken,
          encrypted_refresh_token: encryptedRefreshToken,
          token_expires_at: expiresAt,
          is_active: true,
          metadata: { scope: tokens.scope },
        }, {
          onConflict: 'user_id,integration_type',
        });

      if (insertError) {
        console.error('[GoogleDrive OAuth] Failed to store integration:', insertError);
        return Response.redirect(`${origin}/chat?error=storage_failed`);
      }

      // Cleanup state
      await supabase.from('oauth_states').delete().eq('state', state);

      console.log('[GoogleDrive OAuth] Successfully connected for user:', stateData.user_id);
      return Response.redirect(`${origin}/chat?integration=googledrive&success=true`);

    } else {
      // Initialize OAuth flow
      const authHeader = req.headers.get('Authorization');
      if (!authHeader) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);

      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Invalid token' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Generate state for CSRF protection
      const state = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      await supabase.from('oauth_states').insert({
        state,
        user_id: user.id,
        provider: 'googledrive',
        expires_at: expiresAt,
      });

      // Build authorization URL with Drive scope
      const scopes = [
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive.file',
        'https://www.googleapis.com/auth/userinfo.email',
      ].join(' ');

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', GOOGLE_CLIENT_ID);
      authUrl.searchParams.set('redirect_uri', redirectUri);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', scopes);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('prompt', 'consent');

      return new Response(JSON.stringify({ url: authUrl.toString() }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  } catch (error) {
    console.error('[GoogleDrive OAuth] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
