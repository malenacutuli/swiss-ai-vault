import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OIDCTokenResponse {
  access_token: string;
  id_token?: string;
  token_type: string;
  expires_in?: number;
  refresh_token?: string;
  scope?: string;
}

interface OIDCUserInfo {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  [key: string]: unknown;
}

// Generate secure random string
function generateRandomString(length: number): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, byte => chars[byte % chars.length]).join('');
}

// Generate PKCE code verifier and challenge
async function generatePKCE(): Promise<{ verifier: string; challenge: string }> {
  const verifier = generateRandomString(64);
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return { verifier, challenge };
}

// Helper to redirect with error
function redirectWithError(message: string): Response {
  const errorUrl = `/auth?error=${encodeURIComponent(message)}&sso=failed`;
  return Response.redirect(errorUrl, 302);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const url = new URL(req.url);
  const action = url.pathname.split('/').pop() || 'callback';
  const baseUrl = supabaseUrl;
  const callbackUrl = `${baseUrl}/functions/v1/sso-callback`;

  try {
    // Handle SSO initiation
    if (action === 'initiate' || req.method === 'POST') {
      const body = await req.json();
      const { config_id, email, redirect_uri, original_url } = body;

      let ssoConfig: Record<string, unknown> | null = null;

      if (config_id) {
        const { data } = await supabase
          .from('sso_configurations')
          .select('*')
          .eq('id', config_id)
          .eq('enabled', true)
          .single();
        ssoConfig = data;
      } else if (email) {
        const domain = email.split('@')[1];
        const { data } = await supabase
          .from('sso_configurations')
          .select('*')
          .eq('enabled', true)
          .contains('domain_whitelist', [domain])
          .single();
        ssoConfig = data;
      }

      if (!ssoConfig) {
        return new Response(
          JSON.stringify({ error: 'No SSO configuration found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const state = generateRandomString(32);
      const nonce = generateRandomString(32);
      const { verifier, challenge } = await generatePKCE();

      await supabase.from('sso_sessions').insert({
        sso_config_id: ssoConfig.id,
        state,
        nonce,
        code_verifier: verifier,
        redirect_uri,
        original_url,
      });

      let authUrl: string;
      const provider = ssoConfig.provider as string;

      if (provider === 'oidc' || provider === 'azure_ad' || provider === 'okta') {
        const scopes = (ssoConfig.scopes as string[]) || ['openid', 'email', 'profile'];
        const params = new URLSearchParams({
          client_id: ssoConfig.client_id as string,
          response_type: 'code',
          scope: scopes.join(' '),
          redirect_uri: callbackUrl,
          state,
          nonce,
          code_challenge: challenge,
          code_challenge_method: 'S256',
        });
        authUrl = `${ssoConfig.authorization_url}?${params.toString()}`;
      } else if (provider === 'saml') {
        authUrl = `${ssoConfig.metadata_url}?SAMLRequest=${encodeURIComponent(state)}`;
      } else {
        return new Response(
          JSON.stringify({ error: 'Unsupported provider' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`[sso-callback] Initiated SSO for ${provider}`);

      return new Response(
        JSON.stringify({ 
          authorization_url: authUrl,
          state,
          provider,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Handle OAuth callback
    if (action === 'callback' || url.searchParams.has('code') || url.searchParams.has('state')) {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const error = url.searchParams.get('error');
      const errorDescription = url.searchParams.get('error_description');

      if (error) {
        console.error(`[sso-callback] OAuth error: ${error} - ${errorDescription}`);
        return redirectWithError(errorDescription || error);
      }

      if (!code || !state) {
        return new Response(
          JSON.stringify({ error: 'Missing code or state parameter' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: session } = await supabase
        .from('sso_sessions')
        .select('*, sso_configurations(*)')
        .eq('state', state)
        .eq('status', 'pending')
        .gt('expires_at', new Date().toISOString())
        .single();

      if (!session) {
        return redirectWithError('Invalid or expired SSO session');
      }

      const ssoConfig = session.sso_configurations as Record<string, unknown>;
      
      try {
        // Exchange code for tokens
        const tokenResponse = await fetch(ssoConfig.token_url as string, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: ssoConfig.client_id as string,
            client_secret: (ssoConfig.client_secret_encrypted as string) || '',
            code,
            redirect_uri: callbackUrl,
            code_verifier: session.code_verifier || '',
          }),
        });

        if (!tokenResponse.ok) {
          throw new Error('Failed to exchange authorization code');
        }

        const tokens: OIDCTokenResponse = await tokenResponse.json();

        let userInfo: OIDCUserInfo;
        if (tokens.id_token) {
          const payload = JSON.parse(
            atob(tokens.id_token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))
          );
          userInfo = payload;
        } else if (ssoConfig.userinfo_url) {
          const userInfoResponse = await fetch(ssoConfig.userinfo_url as string, {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          });
          userInfo = await userInfoResponse.json();
        } else {
          throw new Error('Unable to get user information');
        }

        const attributeMapping = (ssoConfig.attribute_mapping as Record<string, string>) || {};
        const email = userInfo[attributeMapping.email || 'email'] as string;
        const name = userInfo[attributeMapping.name || 'name'] as string;

        if (!email) {
          throw new Error('Email not provided by identity provider');
        }

        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .single();

        let userId: string;

        if (existingUser) {
          userId = existingUser.id;
          await supabase.from('users').update({ full_name: name }).eq('id', userId);
        } else if (ssoConfig.auto_provision_users) {
          const { data: authUser, error: createError } = await supabase.auth.admin.createUser({
            email,
            email_confirm: true,
            user_metadata: { full_name: name, sso_provider: ssoConfig.provider },
          });

          if (createError) throw new Error(`Failed to create user: ${createError.message}`);
          userId = authUser.user.id;

          await supabase.from('organization_members').insert({
            org_id: ssoConfig.organization_id,
            user_id: userId,
            role: (ssoConfig.default_role as string) || 'member',
          });
        } else {
          throw new Error('User does not exist and auto-provisioning is disabled');
        }

        const { data: signInData, error: signInError } = await supabase.auth.admin.generateLink({
          type: 'magiclink',
          email,
          options: { redirectTo: session.original_url || session.redirect_uri || '/' },
        });

        if (signInError) throw new Error(`Failed to generate session: ${signInError.message}`);

        await supabase.from('sso_sessions').update({
          status: 'completed',
          user_id: userId,
          completed_at: new Date().toISOString(),
        }).eq('id', session.id);

        await supabase.from('sso_configurations')
          .update({ last_used_at: new Date().toISOString() })
          .eq('id', ssoConfig.id);

        console.log(`[sso-callback] SSO login successful for ${email}`);

        const magicLinkUrl = signInData.properties?.action_link;
        if (magicLinkUrl) {
          return Response.redirect(magicLinkUrl, 302);
        }

        const redirectUrl = session.original_url || session.redirect_uri || '/';
        return Response.redirect(`${redirectUrl}?sso=success`, 302);

      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'SSO authentication failed';
        
        await supabase.from('sso_sessions').update({
          status: 'failed',
          error_message: errorMessage,
        }).eq('id', session.id);

        console.error(`[sso-callback] SSO failed: ${errorMessage}`);
        return redirectWithError(errorMessage);
      }
    }

    // Handle metadata request
    if (action === 'metadata') {
      const configId = url.searchParams.get('config_id');
      
      if (!configId) {
        return new Response(
          JSON.stringify({ error: 'Missing config_id' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const { data: config } = await supabase
        .from('sso_configurations')
        .select('*')
        .eq('id', configId)
        .single();

      if (!config) {
        return new Response(
          JSON.stringify({ error: 'Configuration not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (config.provider === 'saml') {
        const metadata = `<?xml version="1.0" encoding="UTF-8"?>
<EntityDescriptor xmlns="urn:oasis:names:tc:SAML:2.0:metadata" entityID="${config.entity_id || callbackUrl}">
  <SPSSODescriptor AuthnRequestsSigned="true" WantAssertionsSigned="true" protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol">
    <NameIDFormat>urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress</NameIDFormat>
    <AssertionConsumerService Binding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST" Location="${callbackUrl}" index="0"/>
  </SPSSODescriptor>
</EntityDescriptor>`;
        return new Response(metadata, { headers: { ...corsHeaders, 'Content-Type': 'application/xml' } });
      }

      return new Response(
        JSON.stringify({
          issuer: config.issuer_url,
          authorization_endpoint: config.authorization_url,
          token_endpoint: config.token_url,
          userinfo_endpoint: config.userinfo_url,
          callback_url: callbackUrl,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Unknown action' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('[sso-callback] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'SSO authentication failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
