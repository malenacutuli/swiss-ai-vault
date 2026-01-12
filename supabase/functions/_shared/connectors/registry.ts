// supabase/functions/_shared/connectors/registry.ts

import { ConnectorDefinition } from './types.ts';

export const CONNECTOR_DEFINITIONS: Record<string, ConnectorDefinition> = {
  google_gmail: {
    id: 'google_gmail',
    name: 'Gmail',
    description: 'Send and receive emails via Gmail',
    icon_url: '/connectors/gmail.svg',
    category: 'communication',
    auth_methods: ['oauth2'],
    oauth_config: {
      authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_url: 'https://oauth2.googleapis.com/token',
      revoke_url: 'https://oauth2.googleapis.com/revoke',
      scope_separator: ' ',
      pkce_required: true,
      state_required: true
    },
    required_scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send'
    ],
    optional_scopes: [
      'https://www.googleapis.com/auth/gmail.modify'
    ],
    webhook_support: true,
    rate_limit: { requests: 250, window_seconds: 1 }
  },

  google_calendar: {
    id: 'google_calendar',
    name: 'Google Calendar',
    description: 'Manage calendar events',
    icon_url: '/connectors/gcal.svg',
    category: 'calendar',
    auth_methods: ['oauth2'],
    oauth_config: {
      authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_url: 'https://oauth2.googleapis.com/token',
      revoke_url: 'https://oauth2.googleapis.com/revoke',
      scope_separator: ' ',
      pkce_required: true,
      state_required: true
    },
    required_scopes: [
      'https://www.googleapis.com/auth/calendar.readonly',
      'https://www.googleapis.com/auth/calendar.events'
    ],
    webhook_support: true,
    rate_limit: { requests: 100, window_seconds: 1 }
  },

  google_drive: {
    id: 'google_drive',
    name: 'Google Drive',
    description: 'Access and manage files in Google Drive',
    icon_url: '/connectors/gdrive.svg',
    category: 'storage',
    auth_methods: ['oauth2'],
    oauth_config: {
      authorization_url: 'https://accounts.google.com/o/oauth2/v2/auth',
      token_url: 'https://oauth2.googleapis.com/token',
      revoke_url: 'https://oauth2.googleapis.com/revoke',
      scope_separator: ' ',
      pkce_required: true,
      state_required: true
    },
    required_scopes: [
      'https://www.googleapis.com/auth/drive.readonly'
    ],
    optional_scopes: [
      'https://www.googleapis.com/auth/drive.file'
    ],
    webhook_support: true,
    rate_limit: { requests: 100, window_seconds: 1 }
  },

  slack: {
    id: 'slack',
    name: 'Slack',
    description: 'Send messages and manage Slack workspace',
    icon_url: '/connectors/slack.svg',
    category: 'communication',
    auth_methods: ['oauth2'],
    oauth_config: {
      authorization_url: 'https://slack.com/oauth/v2/authorize',
      token_url: 'https://slack.com/api/oauth.v2.access',
      revoke_url: 'https://slack.com/api/auth.revoke',
      scope_separator: ',',
      pkce_required: false,
      state_required: true
    },
    required_scopes: ['chat:write', 'channels:read'],
    optional_scopes: ['files:write', 'users:read'],
    webhook_support: true,
    rate_limit: { requests: 50, window_seconds: 60 }
  },

  notion: {
    id: 'notion',
    name: 'Notion',
    description: 'Access and update Notion pages and databases',
    icon_url: '/connectors/slack.svg',
    category: 'productivity',
    auth_methods: ['oauth2'],
    oauth_config: {
      authorization_url: 'https://api.notion.com/v1/oauth/authorize',
      token_url: 'https://api.notion.com/v1/oauth/token',
      scope_separator: ' ',
      pkce_required: false,
      state_required: true
    },
    required_scopes: [],
    webhook_support: false,
    rate_limit: { requests: 3, window_seconds: 1 }
  },

  stripe: {
    id: 'stripe',
    name: 'Stripe',
    description: 'Process payments and manage subscriptions',
    icon_url: '/connectors/stripe.svg',
    category: 'payment',
    auth_methods: ['api_key'],
    required_scopes: [],
    webhook_support: true,
    rate_limit: { requests: 100, window_seconds: 1 }
  }
};

export function getConnectorDefinition(connectorId: string): ConnectorDefinition | null {
  return CONNECTOR_DEFINITIONS[connectorId] || null;
}

export function listConnectors(category?: string): ConnectorDefinition[] {
  const connectors = Object.values(CONNECTOR_DEFINITIONS);
  if (category) {
    return connectors.filter(c => c.category === category);
  }
  return connectors;
}
