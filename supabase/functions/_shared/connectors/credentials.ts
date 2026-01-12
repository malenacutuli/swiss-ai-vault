// supabase/functions/_shared/connectors/credentials.ts

import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { ConnectorCredentials } from './types.ts';
import { encrypt, decrypt } from './encryption.ts';
import { getConnectorDefinition } from './registry.ts';

export async function storeCredentials(
  supabase: SupabaseClient,
  userId: string,
  connectorId: string,
  accessToken: string,
  refreshToken?: string,
  expiresAt?: Date,
  scopes?: string[],
  metadata?: Record<string, unknown>
): Promise<string> {
  const definition = getConnectorDefinition(connectorId);
  if (!definition) {
    throw new Error(`Unknown connector: ${connectorId}`);
  }

  const accessTokenEncrypted = await encrypt(accessToken);
  const refreshTokenEncrypted = refreshToken ? await encrypt(refreshToken) : null;

  const { data, error } = await supabase
    .from('connector_credentials')
    .upsert({
      user_id: userId,
      connector_id: connectorId,
      auth_method: definition.auth_methods[0],
      access_token_encrypted: accessTokenEncrypted,
      refresh_token_encrypted: refreshTokenEncrypted,
      token_expires_at: expiresAt?.toISOString(),
      scopes: scopes || definition.required_scopes,
      metadata: metadata || {},
      updated_at: new Date().toISOString()
    }, {
      onConflict: 'user_id,connector_id'
    })
    .select('id')
    .single();

  if (error) {
    throw new Error(`Failed to store credentials: ${error.message}`);
  }

  return data.id;
}

export async function getCredentials(
  supabase: SupabaseClient,
  userId: string,
  connectorId: string
): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: Date } | null> {
  const { data, error } = await supabase
    .from('connector_credentials')
    .select('*')
    .eq('user_id', userId)
    .eq('connector_id', connectorId)
    .single();

  if (error || !data) {
    return null;
  }

  const accessToken = await decrypt(data.access_token_encrypted);
  const refreshToken = data.refresh_token_encrypted
    ? await decrypt(data.refresh_token_encrypted)
    : undefined;

  return {
    accessToken,
    refreshToken,
    expiresAt: data.token_expires_at ? new Date(data.token_expires_at) : undefined
  };
}

export async function refreshCredentials(
  supabase: SupabaseClient,
  userId: string,
  connectorId: string
): Promise<{ accessToken: string; expiresAt: Date } | null> {
  const definition = getConnectorDefinition(connectorId);
  if (!definition?.oauth_config) {
    return null;
  }

  const current = await getCredentials(supabase, userId, connectorId);
  if (!current?.refreshToken) {
    return null;
  }

  // Exchange refresh token
  const clientId = Deno.env.get(`${connectorId.toUpperCase()}_CLIENT_ID`);
  const clientSecret = Deno.env.get(`${connectorId.toUpperCase()}_CLIENT_SECRET`);

  const response = await fetch(definition.oauth_config.token_url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: current.refreshToken,
      client_id: clientId!,
      client_secret: clientSecret!
    })
  });

  if (!response.ok) {
    console.error('Token refresh failed:', await response.text());
    return null;
  }

  const tokens = await response.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000);

  // Update stored credentials
  await storeCredentials(
    supabase,
    userId,
    connectorId,
    tokens.access_token,
    tokens.refresh_token || current.refreshToken,
    expiresAt
  );

  return {
    accessToken: tokens.access_token,
    expiresAt
  };
}

export async function revokeCredentials(
  supabase: SupabaseClient,
  userId: string,
  connectorId: string
): Promise<boolean> {
  const definition = getConnectorDefinition(connectorId);
  const credentials = await getCredentials(supabase, userId, connectorId);

  // Revoke at provider if supported
  if (definition?.oauth_config?.revoke_url && credentials?.accessToken) {
    try {
      await fetch(definition.oauth_config.revoke_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token: credentials.accessToken })
      });
    } catch (e) {
      console.error('Revoke failed:', e);
    }
  }

  // Delete from database
  const { error } = await supabase
    .from('connector_credentials')
    .delete()
    .eq('user_id', userId)
    .eq('connector_id', connectorId);

  return !error;
}
