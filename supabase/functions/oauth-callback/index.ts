// supabase/functions/oauth-callback/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { getConnectorDefinition } from "../_shared/connectors/registry.ts";
import { storeCredentials } from "../_shared/connectors/credentials.ts";

const FRONTEND_URL = Deno.env.get('FRONTEND_URL') || 'https://swissbrain.ai';

serve(async (req) => {
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (error) {
    return Response.redirect(`${FRONTEND_URL}/settings/integrations?error=${error}`);
  }

  if (!code || !state) {
    return Response.redirect(`${FRONTEND_URL}/settings/integrations?error=missing_params`);
  }

  // Decode state
  let stateData: { connectorId: string; userId: string; redirectPath?: string };
  try {
    stateData = JSON.parse(atob(state));
  } catch {
    return Response.redirect(`${FRONTEND_URL}/settings/integrations?error=invalid_state`);
  }

  const { connectorId, userId, redirectPath } = stateData;
  const definition = getConnectorDefinition(connectorId);

  if (!definition?.oauth_config) {
    return Response.redirect(`${FRONTEND_URL}/settings/integrations?error=unknown_connector`);
  }

  // Exchange code for tokens
  const clientId = Deno.env.get(`${connectorId.toUpperCase()}_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${connectorId.toUpperCase()}_CLIENT_SECRET`);
  const redirectUri = `${Deno.env.get('SUPABASE_URL')}/functions/v1/oauth-callback`;

  const tokenResponse = await fetch(definition.oauth_config.token_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId!,
      client_secret: clientSecret!,
      redirect_uri: redirectUri
    })
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    console.error('Token exchange failed:', errorText);
    return Response.redirect(`${FRONTEND_URL}/settings/integrations?error=token_exchange_failed`);
  }

  const tokens = await tokenResponse.json();

  // Store credentials
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : undefined;

    await storeCredentials(
      supabase,
      userId,
      connectorId,
      tokens.access_token,
      tokens.refresh_token,
      expiresAt,
      tokens.scope?.split(definition.oauth_config.scope_separator)
    );

    const successPath = redirectPath || '/settings/integrations';
    return Response.redirect(`${FRONTEND_URL}${successPath}?connected=${connectorId}`);

  } catch (err) {
    console.error('Failed to store credentials:', err);
    return Response.redirect(`${FRONTEND_URL}/settings/integrations?error=storage_failed`);
  }
});
