// supabase/functions/_shared/connectors/types.ts

export type ConnectorCategory =
  | 'communication'  // Gmail, Slack, Teams
  | 'productivity'   // Notion, Google Docs, Trello
  | 'calendar'       // Google Calendar, Outlook
  | 'storage'        // Google Drive, Dropbox, OneDrive
  | 'crm'            // Salesforce, HubSpot
  | 'payment'        // Stripe
  | 'custom';

export type AuthMethod = 'oauth2' | 'api_key' | 'basic' | 'bearer';

export interface ConnectorDefinition {
  id: string;
  name: string;
  description: string;
  icon_url: string;
  category: ConnectorCategory;
  auth_methods: AuthMethod[];
  oauth_config?: OAuthConfig;
  required_scopes: string[];
  optional_scopes?: string[];
  webhook_support: boolean;
  rate_limit?: { requests: number; window_seconds: number };
}

export interface OAuthConfig {
  authorization_url: string;
  token_url: string;
  revoke_url?: string;
  scope_separator: string;
  pkce_required: boolean;
  state_required: boolean;
}

export interface ConnectorCredentials {
  id: string;
  user_id: string;
  connector_id: string;
  auth_method: AuthMethod;
  access_token_encrypted: string;
  refresh_token_encrypted?: string;
  token_expires_at?: string;
  scopes: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ConnectorAction {
  action: string;
  parameters: Record<string, unknown>;
}

export interface ConnectorResult {
  success: boolean;
  data?: unknown;
  error?: string;
  rate_limit_remaining?: number;
}

export interface Connector {
  definition: ConnectorDefinition;
  initialize(credentials: ConnectorCredentials): Promise<void>;
  validateCredentials(): Promise<{ valid: boolean; error?: string }>;
  execute(action: ConnectorAction): Promise<ConnectorResult>;
  refreshToken?(): Promise<ConnectorCredentials>;
  dispose(): Promise<void>;
}
