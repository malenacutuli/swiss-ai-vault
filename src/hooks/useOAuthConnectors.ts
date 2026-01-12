// src/hooks/useOAuthConnectors.ts
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface OAuthConnector {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  category: string;
  connected: boolean;
  connected_at?: string;
  scopes?: string[];
}

export interface ConnectorDefinition {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  category: string;
  auth_methods: string[];
  required_scopes: string[];
}

const AVAILABLE_CONNECTORS: ConnectorDefinition[] = [
  {
    id: 'google_gmail',
    name: 'Gmail',
    description: 'Send and receive emails',
    icon_url: '/connectors/gmail.svg',
    category: 'communication',
    auth_methods: ['oauth2'],
    required_scopes: ['gmail.readonly', 'gmail.send']
  },
  {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Manage calendar events',
    icon_url: '/connectors/gcal.svg',
    category: 'calendar',
    auth_methods: ['oauth2'],
    required_scopes: ['calendar.readonly', 'calendar.events']
  },
  {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Access files and documents',
    icon_url: '/connectors/gdrive.svg',
    category: 'storage',
    auth_methods: ['oauth2'],
    required_scopes: ['drive.readonly']
  },
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages to channels',
    icon_url: '/connectors/slack.svg',
    category: 'communication',
    auth_methods: ['oauth2'],
    required_scopes: ['chat:write', 'channels:read']
  },
  {
    id: 'notion',
    name: 'Notion',
    description: 'Access pages and databases',
    icon_url: '/connectors/notion.svg',
    category: 'productivity',
    auth_methods: ['oauth2'],
    required_scopes: []
  }
];

export function useOAuthConnectors() {
  const { user } = useAuth();
  const [connectors, setConnectors] = useState<OAuthConnector[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch connected connectors
  const fetchConnectors = useCallback(async () => {
    if (!user) {
      setConnectors([]);
      setIsLoading(false);
      return;
    }

    try {
      const { data: credentials, error: fetchError } = await supabase
        .from('connector_credentials')
        .select('connector_id, created_at, scopes')
        .eq('user_id', user.id);

      if (fetchError) throw fetchError;

      const connectedIds = new Set(credentials?.map(c => c.connector_id) || []);

      const merged: OAuthConnector[] = AVAILABLE_CONNECTORS.map(connector => ({
        id: connector.id,
        name: connector.name,
        description: connector.description,
        icon_url: connector.icon_url,
        category: connector.category,
        connected: connectedIds.has(connector.id),
        connected_at: credentials?.find(c => c.connector_id === connector.id)?.created_at,
        scopes: credentials?.find(c => c.connector_id === connector.id)?.scopes
      }));

      setConnectors(merged);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchConnectors();
  }, [fetchConnectors]);

  // Initiate OAuth flow
  const connect = useCallback(async (connectorId: string) => {
    if (!user) throw new Error('Not authenticated');

    const connector = AVAILABLE_CONNECTORS.find(c => c.id === connectorId);
    if (!connector) throw new Error('Unknown connector');

    // Generate PKCE code verifier
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Create state token
    const state = btoa(JSON.stringify({
      connectorId,
      userId: user.id,
      redirectPath: '/settings/integrations'
    }));

    // Store PKCE verifier
    await supabase.from('oauth_states').insert({
      state_token: state,
      user_id: user.id,
      connector_id: connectorId,
      pkce_verifier: codeVerifier,
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 min
    });

    // Build OAuth URL
    const oauthUrls: Record<string, string> = {
      google_gmail: 'https://accounts.google.com/o/oauth2/v2/auth',
      google_calendar: 'https://accounts.google.com/o/oauth2/v2/auth',
      google_drive: 'https://accounts.google.com/o/oauth2/v2/auth',
      slack: 'https://slack.com/oauth/v2/authorize',
      notion: 'https://api.notion.com/v1/oauth/authorize'
    };

    const clientIds: Record<string, string> = {
      google_gmail: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      google_calendar: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      google_drive: import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
      slack: import.meta.env.VITE_SLACK_CLIENT_ID || '',
      notion: import.meta.env.VITE_NOTION_CLIENT_ID || ''
    };

    const scopes: Record<string, string> = {
      google_gmail: 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/gmail.send',
      google_calendar: 'https://www.googleapis.com/auth/calendar.readonly https://www.googleapis.com/auth/calendar.events',
      google_drive: 'https://www.googleapis.com/auth/drive.readonly',
      slack: 'chat:write,channels:read',
      notion: ''
    };

    const redirectUri = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/oauth-callback`;

    const params = new URLSearchParams({
      client_id: clientIds[connectorId],
      redirect_uri: redirectUri,
      response_type: 'code',
      state,
      scope: scopes[connectorId],
      access_type: 'offline',
      prompt: 'consent'
    });

    // Add PKCE for Google
    if (connectorId.startsWith('google_')) {
      params.append('code_challenge', codeChallenge);
      params.append('code_challenge_method', 'S256');
    }

    window.location.href = `${oauthUrls[connectorId]}?${params.toString()}`;
  }, [user]);

  // Disconnect connector
  const disconnect = useCallback(async (connectorId: string) => {
    if (!user) throw new Error('Not authenticated');

    const { error: deleteError } = await supabase
      .from('connector_credentials')
      .delete()
      .eq('user_id', user.id)
      .eq('connector_id', connectorId);

    if (deleteError) throw deleteError;

    await fetchConnectors();
  }, [user, fetchConnectors]);

  return {
    connectors,
    isLoading,
    error,
    connect,
    disconnect,
    refresh: fetchConnectors
  };
}

// PKCE helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(hash)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
