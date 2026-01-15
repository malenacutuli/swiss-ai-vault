# Manus Implementation Playbook Part 3: Integrations, Security & Testing

> **Document Version:** 1.0  
> **Last Updated:** January 2025  
> **Author:** Manus AI  
> **Scope:** Connector SDK, Security Hardening, Acceptance & Load Testing

This document completes the Manus implementation playbook with detailed specifications for the integration layer, security hardening, and comprehensive testing strategies. All sections include exact schemas, TypeScript pseudocode, and interface contracts.

---

## Table of Contents

1. [Connector SDK & Integrations](#1-connector-sdk--integrations)
2. [Security Hardening](#2-security-hardening)
3. [Acceptance & Load Testing](#3-acceptance--load-testing)
4. [Implementation Order](#4-implementation-order)
5. [References](#5-references)

---

## 1. Connector SDK & Integrations

### PR-022: Connector SDK Architecture

#### 1.1 Connector Interface Contract

The Connector SDK defines a standardized interface for all third-party integrations. Every connector must implement this contract to ensure consistent behavior across the platform.

```typescript
// packages/connector-sdk/src/types/connector.ts

/**
 * Base interface that all connectors must implement.
 * This contract ensures consistent behavior across all integrations.
 */
export interface Connector {
  /** Unique identifier for this connector type */
  readonly id: string;
  
  /** Human-readable name */
  readonly name: string;
  
  /** Semantic version of the connector */
  readonly version: string;
  
  /** Connector category for marketplace organization */
  readonly category: ConnectorCategory;
  
  /** Authentication method(s) supported */
  readonly authMethods: AuthMethod[];
  
  /** Required OAuth scopes (if OAuth is used) */
  readonly requiredScopes: string[];
  
  /** Optional scopes that enable additional features */
  readonly optionalScopes: ScopeDefinition[];
  
  /** Rate limit configuration */
  readonly rateLimits: RateLimitConfig;
  
  /** Capabilities this connector provides */
  readonly capabilities: ConnectorCapability[];
  
  /** Initialize the connector with credentials */
  initialize(config: ConnectorConfig): Promise<void>;
  
  /** Validate that credentials are working */
  validateCredentials(): Promise<ValidationResult>;
  
  /** Execute an action */
  execute(action: ConnectorAction): Promise<ConnectorResult>;
  
  /** Handle incoming webhooks */
  handleWebhook?(payload: WebhookPayload): Promise<WebhookResponse>;
  
  /** Clean up resources */
  dispose(): Promise<void>;
}

export type ConnectorCategory = 
  | 'communication'      // Slack, Discord, Email
  | 'productivity'       // Google Workspace, Microsoft 365
  | 'development'        // GitHub, GitLab, Jira
  | 'storage'           // Dropbox, Google Drive, S3
  | 'crm'               // Salesforce, HubSpot
  | 'database'          // PostgreSQL, MySQL, MongoDB
  | 'analytics'         // Google Analytics, Mixpanel
  | 'payment'           // Stripe, PayPal
  | 'ai'                // OpenAI, Anthropic, Cohere
  | 'custom';           // User-defined connectors

export interface AuthMethod {
  type: 'oauth2' | 'api_key' | 'basic' | 'bearer' | 'custom';
  config: AuthMethodConfig;
}

export interface ScopeDefinition {
  scope: string;
  name: string;
  description: string;
  capabilities: string[];
  sensitive: boolean;
}

export interface RateLimitConfig {
  /** Requests per second */
  rps: number;
  
  /** Requests per minute */
  rpm: number;
  
  /** Requests per hour */
  rph: number;
  
  /** Daily request limit */
  daily: number;
  
  /** Concurrent request limit */
  concurrent: number;
  
  /** Burst allowance */
  burst: number;
  
  /** Backoff strategy when rate limited */
  backoffStrategy: BackoffStrategy;
}

export type ConnectorCapability =
  | 'read'
  | 'write'
  | 'delete'
  | 'list'
  | 'search'
  | 'stream'
  | 'webhook'
  | 'batch'
  | 'realtime';
```

#### 1.2 Connector Registry and Discovery

```typescript
// packages/connector-sdk/src/registry/registry.ts

export interface ConnectorRegistry {
  /** Register a new connector */
  register(connector: ConnectorManifest): Promise<RegistrationResult>;
  
  /** Unregister a connector */
  unregister(connectorId: string): Promise<void>;
  
  /** Get connector by ID */
  get(connectorId: string): Promise<ConnectorManifest | null>;
  
  /** List all connectors */
  list(filter?: ConnectorFilter): Promise<ConnectorManifest[]>;
  
  /** Search connectors */
  search(query: string): Promise<ConnectorManifest[]>;
  
  /** Get connector instance */
  getInstance(connectorId: string, tenantId: string): Promise<Connector>;
}

export interface ConnectorManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  category: ConnectorCategory;
  icon: string;
  
  // Authentication
  authMethods: AuthMethod[];
  requiredScopes: string[];
  optionalScopes: ScopeDefinition[];
  
  // Capabilities
  capabilities: ConnectorCapability[];
  actions: ActionDefinition[];
  triggers: TriggerDefinition[];
  
  // Rate limits
  rateLimits: RateLimitConfig;
  
  // Marketplace
  pricing: ConnectorPricing;
  status: 'draft' | 'review' | 'published' | 'deprecated';
  
  // Metadata
  documentation: string;
  changelog: ChangelogEntry[];
  createdAt: Date;
  updatedAt: Date;
}

export interface ActionDefinition {
  id: string;
  name: string;
  description: string;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  requiredScopes: string[];
  rateLimitOverride?: Partial<RateLimitConfig>;
}

export interface TriggerDefinition {
  id: string;
  name: string;
  description: string;
  type: 'webhook' | 'polling' | 'realtime';
  outputSchema: JSONSchema;
  config: TriggerConfig;
}

// Database schema for connector registry
export const connectorManifests = pgTable('connector_manifests', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  version: text('version').notNull(),
  description: text('description'),
  author: text('author').notNull(),
  category: text('category').notNull(),
  icon: text('icon'),
  
  authMethods: jsonb('auth_methods').notNull(),
  requiredScopes: jsonb('required_scopes').notNull().default([]),
  optionalScopes: jsonb('optional_scopes').notNull().default([]),
  
  capabilities: jsonb('capabilities').notNull(),
  actions: jsonb('actions').notNull(),
  triggers: jsonb('triggers').notNull().default([]),
  
  rateLimits: jsonb('rate_limits').notNull(),
  pricing: jsonb('pricing'),
  
  status: text('status').notNull().default('draft'),
  documentation: text('documentation'),
  changelog: jsonb('changelog').notNull().default([]),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  categoryIdx: index('connector_category_idx').on(table.category),
  statusIdx: index('connector_status_idx').on(table.status),
  authorIdx: index('connector_author_idx').on(table.author)
}));

// Connector instance per tenant
export const connectorInstances = pgTable('connector_instances', {
  id: text('id').primaryKey(),
  connectorId: text('connector_id').notNull().references(() => connectorManifests.id),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  
  // Encrypted credential reference
  credentialId: text('credential_id').references(() => connectorCredentials.id),
  
  // Instance-specific configuration
  config: jsonb('config').notNull().default({}),
  
  // Granted scopes
  grantedScopes: jsonb('granted_scopes').notNull().default([]),
  
  // Status
  status: text('status').notNull().default('pending'),
  lastValidatedAt: timestamp('last_validated_at'),
  validationError: text('validation_error'),
  
  // Approval workflow
  approvedBy: text('approved_by'),
  approvedAt: timestamp('approved_at'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  tenantConnectorIdx: uniqueIndex('tenant_connector_idx').on(table.tenantId, table.connectorId),
  statusIdx: index('connector_instance_status_idx').on(table.status)
}));
```

#### 1.3 Credential Storage with Encryption

```typescript
// packages/connector-sdk/src/credentials/storage.ts

export interface CredentialStorage {
  /** Store credentials securely */
  store(credential: CredentialInput): Promise<StoredCredential>;
  
  /** Retrieve credentials (decrypted) */
  retrieve(credentialId: string, tenantId: string): Promise<DecryptedCredential>;
  
  /** Update credentials */
  update(credentialId: string, credential: Partial<CredentialInput>): Promise<StoredCredential>;
  
  /** Delete credentials */
  delete(credentialId: string): Promise<void>;
  
  /** Rotate credentials */
  rotate(credentialId: string): Promise<RotationResult>;
  
  /** List credentials for tenant */
  list(tenantId: string): Promise<CredentialSummary[]>;
}

export interface CredentialInput {
  tenantId: string;
  connectorId: string;
  name: string;
  type: 'oauth2' | 'api_key' | 'basic' | 'bearer' | 'custom';
  
  // Raw credential data (will be encrypted)
  data: CredentialData;
  
  // Metadata
  expiresAt?: Date;
  rotationPolicy?: RotationPolicy;
}

export type CredentialData = 
  | OAuth2Credential
  | ApiKeyCredential
  | BasicCredential
  | BearerCredential
  | CustomCredential;

export interface OAuth2Credential {
  type: 'oauth2';
  accessToken: string;
  refreshToken?: string;
  tokenType: string;
  expiresAt?: Date;
  scope: string;
}

export interface ApiKeyCredential {
  type: 'api_key';
  key: string;
  headerName?: string;
  prefix?: string;
}

export interface BasicCredential {
  type: 'basic';
  username: string;
  password: string;
}

export interface BearerCredential {
  type: 'bearer';
  token: string;
}

export interface CustomCredential {
  type: 'custom';
  fields: Record<string, string>;
}

export interface RotationPolicy {
  enabled: boolean;
  intervalDays: number;
  notifyBeforeDays: number;
  autoRotate: boolean;
}

// Database schema for credentials
export const connectorCredentials = pgTable('connector_credentials', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull().references(() => tenants.id),
  connectorId: text('connector_id').notNull().references(() => connectorManifests.id),
  
  name: text('name').notNull(),
  type: text('type').notNull(),
  
  // Encrypted credential data (using envelope encryption)
  encryptedData: bytea('encrypted_data').notNull(),
  
  // Data Encryption Key (DEK) encrypted with tenant's Key Encryption Key (KEK)
  encryptedDek: bytea('encrypted_dek').notNull(),
  
  // KMS key ID used to encrypt the DEK
  kmsKeyId: text('kms_key_id').notNull(),
  
  // Encryption metadata
  encryptionVersion: integer('encryption_version').notNull().default(1),
  algorithm: text('algorithm').notNull().default('AES-256-GCM'),
  
  // Rotation
  rotationPolicy: jsonb('rotation_policy'),
  lastRotatedAt: timestamp('last_rotated_at'),
  nextRotationAt: timestamp('next_rotation_at'),
  rotationCount: integer('rotation_count').notNull().default(0),
  
  // Lifecycle
  expiresAt: timestamp('expires_at'),
  revokedAt: timestamp('revoked_at'),
  revokedBy: text('revoked_by'),
  revokedReason: text('revoked_reason'),
  
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  tenantIdx: index('credential_tenant_idx').on(table.tenantId),
  connectorIdx: index('credential_connector_idx').on(table.connectorId),
  expiresIdx: index('credential_expires_idx').on(table.expiresAt)
}));

// Credential access audit log
export const credentialAccessLog = pgTable('credential_access_log', {
  id: text('id').primaryKey(),
  credentialId: text('credential_id').notNull().references(() => connectorCredentials.id),
  tenantId: text('tenant_id').notNull(),
  
  action: text('action').notNull(), // 'retrieve', 'rotate', 'revoke', 'update'
  actorId: text('actor_id').notNull(),
  actorType: text('actor_type').notNull(), // 'user', 'system', 'agent'
  
  // Context
  runId: text('run_id'),
  stepId: text('step_id'),
  connectorAction: text('connector_action'),
  
  // Request metadata
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  requestId: text('request_id'),
  
  // Result
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
  
  timestamp: timestamp('timestamp').defaultNow().notNull()
}, (table) => ({
  credentialIdx: index('access_log_credential_idx').on(table.credentialId),
  tenantIdx: index('access_log_tenant_idx').on(table.tenantId),
  timestampIdx: index('access_log_timestamp_idx').on(table.timestamp)
}));

// Implementation
export class SecureCredentialStorage implements CredentialStorage {
  constructor(
    private kms: KMSClient,
    private db: Database,
    private auditLogger: AuditLogger
  ) {}
  
  async store(input: CredentialInput): Promise<StoredCredential> {
    // 1. Generate a new Data Encryption Key (DEK)
    const dek = crypto.randomBytes(32);
    
    // 2. Encrypt the credential data with DEK
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    
    const credentialJson = JSON.stringify(input.data);
    const encrypted = Buffer.concat([
      cipher.update(credentialJson, 'utf8'),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    
    // Combine IV + encrypted data + auth tag
    const encryptedData = Buffer.concat([iv, encrypted, authTag]);
    
    // 3. Get tenant's KEK from KMS
    const kmsKeyId = await this.getTenantKmsKey(input.tenantId);
    
    // 4. Encrypt DEK with KEK (envelope encryption)
    const encryptedDek = await this.kms.encrypt({
      KeyId: kmsKeyId,
      Plaintext: dek,
      EncryptionContext: {
        tenantId: input.tenantId,
        credentialType: input.type
      }
    });
    
    // 5. Store in database
    const credentialId = generateId('cred');
    
    await this.db.insert(connectorCredentials).values({
      id: credentialId,
      tenantId: input.tenantId,
      connectorId: input.connectorId,
      name: input.name,
      type: input.type,
      encryptedData,
      encryptedDek: encryptedDek.CiphertextBlob,
      kmsKeyId,
      rotationPolicy: input.rotationPolicy,
      nextRotationAt: input.rotationPolicy?.enabled
        ? new Date(Date.now() + input.rotationPolicy.intervalDays * 86400000)
        : null,
      expiresAt: input.expiresAt
    });
    
    // 6. Audit log
    await this.auditLogger.log({
      action: 'credential.created',
      tenantId: input.tenantId,
      resourceType: 'credential',
      resourceId: credentialId,
      details: {
        connectorId: input.connectorId,
        type: input.type,
        hasExpiry: !!input.expiresAt,
        hasRotationPolicy: !!input.rotationPolicy?.enabled
      }
    });
    
    // 7. Clear sensitive data from memory
    dek.fill(0);
    
    return {
      id: credentialId,
      tenantId: input.tenantId,
      connectorId: input.connectorId,
      name: input.name,
      type: input.type,
      createdAt: new Date()
    };
  }
  
  async retrieve(credentialId: string, tenantId: string): Promise<DecryptedCredential> {
    // 1. Fetch encrypted credential
    const credential = await this.db.query.connectorCredentials.findFirst({
      where: and(
        eq(connectorCredentials.id, credentialId),
        eq(connectorCredentials.tenantId, tenantId),
        isNull(connectorCredentials.revokedAt)
      )
    });
    
    if (!credential) {
      throw new CredentialNotFoundError(credentialId);
    }
    
    // 2. Check expiry
    if (credential.expiresAt && credential.expiresAt < new Date()) {
      throw new CredentialExpiredError(credentialId);
    }
    
    // 3. Decrypt DEK using KMS
    const decryptedDek = await this.kms.decrypt({
      KeyId: credential.kmsKeyId,
      CiphertextBlob: credential.encryptedDek,
      EncryptionContext: {
        tenantId,
        credentialType: credential.type
      }
    });
    
    // 4. Decrypt credential data using DEK
    const encryptedBuffer = credential.encryptedData;
    const iv = encryptedBuffer.slice(0, 16);
    const authTag = encryptedBuffer.slice(-16);
    const encryptedContent = encryptedBuffer.slice(16, -16);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', decryptedDek.Plaintext, iv);
    decipher.setAuthTag(authTag);
    
    const decrypted = Buffer.concat([
      decipher.update(encryptedContent),
      decipher.final()
    ]);
    
    const credentialData = JSON.parse(decrypted.toString('utf8'));
    
    // 5. Audit log
    await this.db.insert(credentialAccessLog).values({
      id: generateId('access'),
      credentialId,
      tenantId,
      action: 'retrieve',
      actorId: getCurrentActorId(),
      actorType: getCurrentActorType(),
      success: true,
      timestamp: new Date()
    });
    
    // 6. Clear sensitive data from memory
    decryptedDek.Plaintext.fill(0);
    
    return {
      id: credentialId,
      type: credential.type as CredentialData['type'],
      data: credentialData,
      expiresAt: credential.expiresAt
    };
  }
  
  async rotate(credentialId: string): Promise<RotationResult> {
    const credential = await this.db.query.connectorCredentials.findFirst({
      where: eq(connectorCredentials.id, credentialId)
    });
    
    if (!credential) {
      throw new CredentialNotFoundError(credentialId);
    }
    
    // For OAuth2, attempt token refresh
    if (credential.type === 'oauth2') {
      return this.rotateOAuth2(credential);
    }
    
    // For API keys, notify user (cannot auto-rotate)
    return {
      success: false,
      requiresManualRotation: true,
      message: 'API key rotation requires manual intervention'
    };
  }
  
  private async rotateOAuth2(credential: any): Promise<RotationResult> {
    // Decrypt current credential
    const decrypted = await this.retrieve(credential.id, credential.tenantId);
    const oauth = decrypted.data as OAuth2Credential;
    
    if (!oauth.refreshToken) {
      return {
        success: false,
        requiresManualRotation: true,
        message: 'No refresh token available'
      };
    }
    
    // Get connector config for token endpoint
    const connector = await this.db.query.connectorManifests.findFirst({
      where: eq(connectorManifests.id, credential.connectorId)
    });
    
    const authConfig = connector?.authMethods.find(m => m.type === 'oauth2')?.config;
    
    // Refresh token
    const response = await fetch(authConfig.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: oauth.refreshToken,
        client_id: authConfig.clientId,
        client_secret: authConfig.clientSecret
      })
    });
    
    if (!response.ok) {
      return {
        success: false,
        requiresManualRotation: true,
        message: 'Token refresh failed'
      };
    }
    
    const tokens = await response.json();
    
    // Update credential with new tokens
    await this.update(credential.id, {
      data: {
        type: 'oauth2',
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token || oauth.refreshToken,
        tokenType: tokens.token_type,
        expiresAt: tokens.expires_in 
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : undefined,
        scope: tokens.scope || oauth.scope
      }
    });
    
    // Update rotation metadata
    await this.db.update(connectorCredentials)
      .set({
        lastRotatedAt: new Date(),
        nextRotationAt: credential.rotationPolicy?.enabled
          ? new Date(Date.now() + credential.rotationPolicy.intervalDays * 86400000)
          : null,
        rotationCount: sql`${connectorCredentials.rotationCount} + 1`
      })
      .where(eq(connectorCredentials.id, credential.id));
    
    return {
      success: true,
      rotatedAt: new Date(),
      nextRotationAt: credential.rotationPolicy?.enabled
        ? new Date(Date.now() + credential.rotationPolicy.intervalDays * 86400000)
        : undefined
    };
  }
}
```

#### 1.4 OAuth Scope Management

```typescript
// packages/connector-sdk/src/scopes/manager.ts

export interface ScopeManager {
  /** Request scopes for a connector */
  requestScopes(request: ScopeRequest): Promise<ScopeRequestResult>;
  
  /** Grant scopes (after user approval) */
  grantScopes(instanceId: string, scopes: string[]): Promise<void>;
  
  /** Revoke scopes */
  revokeScopes(instanceId: string, scopes: string[]): Promise<void>;
  
  /** Check if scope is granted */
  hasScope(instanceId: string, scope: string): Promise<boolean>;
  
  /** Get all granted scopes */
  getGrantedScopes(instanceId: string): Promise<GrantedScope[]>;
  
  /** Validate action against granted scopes */
  validateAction(instanceId: string, action: string): Promise<ScopeValidation>;
}

export interface ScopeRequest {
  tenantId: string;
  connectorId: string;
  requestedScopes: string[];
  reason: string;
  requestedBy: string;
}

export interface GrantedScope {
  scope: string;
  grantedAt: Date;
  grantedBy: string;
  expiresAt?: Date;
}

export interface ScopeValidation {
  valid: boolean;
  missingScopes: string[];
  message?: string;
}

// Database schema for scope grants
export const scopeGrants = pgTable('scope_grants', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id').notNull().references(() => connectorInstances.id),
  tenantId: text('tenant_id').notNull(),
  
  scope: text('scope').notNull(),
  
  grantedBy: text('granted_by').notNull(),
  grantedAt: timestamp('granted_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at'),
  
  revokedBy: text('revoked_by'),
  revokedAt: timestamp('revoked_at'),
  revokedReason: text('revoked_reason'),
  
  // Audit trail
  requestId: text('request_id'),
  approvalId: text('approval_id')
}, (table) => ({
  instanceScopeIdx: uniqueIndex('instance_scope_idx').on(table.instanceId, table.scope),
  tenantIdx: index('scope_grant_tenant_idx').on(table.tenantId)
}));

// Scope request workflow
export const scopeRequests = pgTable('scope_requests', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  connectorId: text('connector_id').notNull(),
  instanceId: text('instance_id'),
  
  requestedScopes: jsonb('requested_scopes').notNull(),
  reason: text('reason').notNull(),
  
  requestedBy: text('requested_by').notNull(),
  requestedAt: timestamp('requested_at').defaultNow().notNull(),
  
  status: text('status').notNull().default('pending'), // pending, approved, rejected, expired
  
  reviewedBy: text('reviewed_by'),
  reviewedAt: timestamp('reviewed_at'),
  reviewNotes: text('review_notes'),
  
  expiresAt: timestamp('expires_at').notNull()
});

export class ScopeManagerImpl implements ScopeManager {
  constructor(
    private db: Database,
    private auditLogger: AuditLogger,
    private notifier: Notifier
  ) {}
  
  async requestScopes(request: ScopeRequest): Promise<ScopeRequestResult> {
    // 1. Validate requested scopes exist
    const connector = await this.db.query.connectorManifests.findFirst({
      where: eq(connectorManifests.id, request.connectorId)
    });
    
    if (!connector) {
      throw new ConnectorNotFoundError(request.connectorId);
    }
    
    const allScopes = [
      ...connector.requiredScopes,
      ...connector.optionalScopes.map(s => s.scope)
    ];
    
    const invalidScopes = request.requestedScopes.filter(s => !allScopes.includes(s));
    if (invalidScopes.length > 0) {
      throw new InvalidScopesError(invalidScopes);
    }
    
    // 2. Check for sensitive scopes that require approval
    const sensitiveScopes = connector.optionalScopes
      .filter(s => s.sensitive && request.requestedScopes.includes(s.scope));
    
    const requiresApproval = sensitiveScopes.length > 0;
    
    // 3. Create scope request
    const requestId = generateId('scopereq');
    
    await this.db.insert(scopeRequests).values({
      id: requestId,
      tenantId: request.tenantId,
      connectorId: request.connectorId,
      requestedScopes: request.requestedScopes,
      reason: request.reason,
      requestedBy: request.requestedBy,
      status: requiresApproval ? 'pending' : 'approved',
      expiresAt: new Date(Date.now() + 7 * 86400000) // 7 days
    });
    
    // 4. If no approval needed, auto-grant
    if (!requiresApproval) {
      // Get or create instance
      let instance = await this.db.query.connectorInstances.findFirst({
        where: and(
          eq(connectorInstances.tenantId, request.tenantId),
          eq(connectorInstances.connectorId, request.connectorId)
        )
      });
      
      if (instance) {
        await this.grantScopes(instance.id, request.requestedScopes);
      }
      
      return {
        requestId,
        status: 'approved',
        grantedScopes: request.requestedScopes
      };
    }
    
    // 5. Notify admins for approval
    await this.notifier.notifyAdmins(request.tenantId, {
      type: 'scope_request',
      title: 'Scope Request Requires Approval',
      message: `${request.requestedBy} requested sensitive scopes for ${connector.name}`,
      data: {
        requestId,
        connectorId: request.connectorId,
        sensitiveScopes: sensitiveScopes.map(s => s.scope)
      }
    });
    
    return {
      requestId,
      status: 'pending_approval',
      pendingScopes: sensitiveScopes.map(s => s.scope)
    };
  }
  
  async validateAction(instanceId: string, action: string): Promise<ScopeValidation> {
    // Get instance and connector
    const instance = await this.db.query.connectorInstances.findFirst({
      where: eq(connectorInstances.id, instanceId)
    });
    
    if (!instance) {
      return { valid: false, missingScopes: [], message: 'Instance not found' };
    }
    
    const connector = await this.db.query.connectorManifests.findFirst({
      where: eq(connectorManifests.id, instance.connectorId)
    });
    
    // Find action definition
    const actionDef = connector?.actions.find(a => a.id === action);
    if (!actionDef) {
      return { valid: false, missingScopes: [], message: 'Action not found' };
    }
    
    // Get granted scopes
    const grants = await this.db.query.scopeGrants.findMany({
      where: and(
        eq(scopeGrants.instanceId, instanceId),
        isNull(scopeGrants.revokedAt),
        or(
          isNull(scopeGrants.expiresAt),
          gt(scopeGrants.expiresAt, new Date())
        )
      )
    });
    
    const grantedScopes = new Set(grants.map(g => g.scope));
    
    // Check required scopes
    const missingScopes = actionDef.requiredScopes.filter(s => !grantedScopes.has(s));
    
    if (missingScopes.length > 0) {
      return {
        valid: false,
        missingScopes,
        message: `Missing required scopes: ${missingScopes.join(', ')}`
      };
    }
    
    return { valid: true, missingScopes: [] };
  }
}
```

#### 1.5 Connector Rate Limiting

```typescript
// packages/connector-sdk/src/ratelimit/limiter.ts

export interface ConnectorRateLimiter {
  /** Check if request is allowed */
  checkLimit(key: RateLimitKey): Promise<RateLimitResult>;
  
  /** Record a request */
  recordRequest(key: RateLimitKey): Promise<void>;
  
  /** Get current usage */
  getUsage(key: RateLimitKey): Promise<RateLimitUsage>;
  
  /** Reset limits (admin only) */
  resetLimits(key: RateLimitKey): Promise<void>;
}

export interface RateLimitKey {
  tenantId: string;
  connectorId: string;
  instanceId?: string;
  action?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: RateLimitRemaining;
  retryAfter?: number;  // Seconds until retry is allowed
  limitType?: 'rps' | 'rpm' | 'rph' | 'daily' | 'concurrent';
}

export interface RateLimitRemaining {
  rps: number;
  rpm: number;
  rph: number;
  daily: number;
  concurrent: number;
}

export interface RateLimitUsage {
  current: {
    rps: number;
    rpm: number;
    rph: number;
    daily: number;
    concurrent: number;
  };
  limits: RateLimitConfig;
  resetTimes: {
    rpm: Date;
    rph: Date;
    daily: Date;
  };
}

export class SlidingWindowRateLimiter implements ConnectorRateLimiter {
  constructor(
    private redis: Redis,
    private db: Database
  ) {}
  
  async checkLimit(key: RateLimitKey): Promise<RateLimitResult> {
    const limits = await this.getLimits(key);
    const now = Date.now();
    
    // Check each limit type
    const checks = await Promise.all([
      this.checkSlidingWindow(key, 'rps', 1000, limits.rps),
      this.checkSlidingWindow(key, 'rpm', 60000, limits.rpm),
      this.checkSlidingWindow(key, 'rph', 3600000, limits.rph),
      this.checkSlidingWindow(key, 'daily', 86400000, limits.daily),
      this.checkConcurrent(key, limits.concurrent)
    ]);
    
    // Find the most restrictive limit
    const failedCheck = checks.find(c => !c.allowed);
    
    if (failedCheck) {
      // Record rate limit hit
      rateLimitHitsCounter.inc({
        tenant_id: key.tenantId,
        connector_id: key.connectorId,
        limit_type: failedCheck.limitType
      });
      
      return {
        allowed: false,
        remaining: this.calculateRemaining(checks),
        retryAfter: failedCheck.retryAfter,
        limitType: failedCheck.limitType
      };
    }
    
    return {
      allowed: true,
      remaining: this.calculateRemaining(checks)
    };
  }
  
  async recordRequest(key: RateLimitKey): Promise<void> {
    const now = Date.now();
    const baseKey = this.buildRedisKey(key);
    
    const pipeline = this.redis.pipeline();
    
    // Add to sliding windows
    ['rps', 'rpm', 'rph', 'daily'].forEach(window => {
      const windowKey = `${baseKey}:${window}`;
      pipeline.zadd(windowKey, now, `${now}:${generateId('req')}`);
    });
    
    // Increment concurrent counter
    pipeline.incr(`${baseKey}:concurrent`);
    
    // Set expiries
    pipeline.expire(`${baseKey}:rps`, 2);
    pipeline.expire(`${baseKey}:rpm`, 120);
    pipeline.expire(`${baseKey}:rph`, 7200);
    pipeline.expire(`${baseKey}:daily`, 172800);
    pipeline.expire(`${baseKey}:concurrent`, 3600);
    
    await pipeline.exec();
  }
  
  async releaseRequest(key: RateLimitKey): Promise<void> {
    const baseKey = this.buildRedisKey(key);
    await this.redis.decr(`${baseKey}:concurrent`);
  }
  
  private async checkSlidingWindow(
    key: RateLimitKey,
    window: string,
    windowMs: number,
    limit: number
  ): Promise<{ allowed: boolean; count: number; retryAfter?: number; limitType: string }> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const redisKey = `${this.buildRedisKey(key)}:${window}`;
    
    // Remove old entries and count current
    const pipeline = this.redis.pipeline();
    pipeline.zremrangebyscore(redisKey, 0, windowStart);
    pipeline.zcard(redisKey);
    
    const results = await pipeline.exec();
    const count = results?.[1]?.[1] as number || 0;
    
    if (count >= limit) {
      // Calculate retry after
      const oldestInWindow = await this.redis.zrange(redisKey, 0, 0, 'WITHSCORES');
      const oldestTime = oldestInWindow?.[1] ? parseInt(oldestInWindow[1]) : now;
      const retryAfter = Math.ceil((oldestTime + windowMs - now) / 1000);
      
      return {
        allowed: false,
        count,
        retryAfter: Math.max(1, retryAfter),
        limitType: window
      };
    }
    
    return { allowed: true, count, limitType: window };
  }
  
  private async checkConcurrent(
    key: RateLimitKey,
    limit: number
  ): Promise<{ allowed: boolean; count: number; limitType: string }> {
    const redisKey = `${this.buildRedisKey(key)}:concurrent`;
    const count = parseInt(await this.redis.get(redisKey) || '0');
    
    return {
      allowed: count < limit,
      count,
      limitType: 'concurrent'
    };
  }
  
  private async getLimits(key: RateLimitKey): Promise<RateLimitConfig> {
    // Check for action-specific override
    if (key.action && key.instanceId) {
      const instance = await this.db.query.connectorInstances.findFirst({
        where: eq(connectorInstances.id, key.instanceId)
      });
      
      const connector = await this.db.query.connectorManifests.findFirst({
        where: eq(connectorManifests.id, instance?.connectorId || key.connectorId)
      });
      
      const actionDef = connector?.actions.find(a => a.id === key.action);
      if (actionDef?.rateLimitOverride) {
        return { ...connector!.rateLimits, ...actionDef.rateLimitOverride };
      }
      
      return connector!.rateLimits;
    }
    
    // Default connector limits
    const connector = await this.db.query.connectorManifests.findFirst({
      where: eq(connectorManifests.id, key.connectorId)
    });
    
    return connector!.rateLimits;
  }
  
  private buildRedisKey(key: RateLimitKey): string {
    const parts = ['ratelimit', key.tenantId, key.connectorId];
    if (key.instanceId) parts.push(key.instanceId);
    if (key.action) parts.push(key.action);
    return parts.join(':');
  }
}
```

#### 1.6 Connector Auditing

```typescript
// packages/connector-sdk/src/audit/logger.ts

export interface ConnectorAuditEvent {
  id: string;
  timestamp: Date;
  
  // Context
  tenantId: string;
  connectorId: string;
  instanceId?: string;
  
  // Actor
  actorId: string;
  actorType: 'user' | 'agent' | 'system' | 'webhook';
  
  // Event
  eventType: ConnectorEventType;
  eventCategory: 'lifecycle' | 'action' | 'credential' | 'scope' | 'webhook';
  
  // Details
  action?: string;
  input?: Record<string, any>;  // Sanitized input (no secrets)
  output?: Record<string, any>; // Sanitized output
  
  // Result
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
  
  // Performance
  durationMs?: number;
  
  // Metadata
  runId?: string;
  stepId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export type ConnectorEventType =
  // Lifecycle
  | 'connector.installed'
  | 'connector.uninstalled'
  | 'connector.enabled'
  | 'connector.disabled'
  | 'connector.configured'
  
  // Actions
  | 'action.executed'
  | 'action.failed'
  | 'action.rate_limited'
  
  // Credentials
  | 'credential.created'
  | 'credential.retrieved'
  | 'credential.rotated'
  | 'credential.revoked'
  | 'credential.expired'
  
  // Scopes
  | 'scope.requested'
  | 'scope.granted'
  | 'scope.revoked'
  | 'scope.denied'
  
  // Webhooks
  | 'webhook.received'
  | 'webhook.processed'
  | 'webhook.failed'
  | 'webhook.verified'
  | 'webhook.rejected';

// Database schema
export const connectorAuditLog = pgTable('connector_audit_log', {
  id: text('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  
  tenantId: text('tenant_id').notNull(),
  connectorId: text('connector_id').notNull(),
  instanceId: text('instance_id'),
  
  actorId: text('actor_id').notNull(),
  actorType: text('actor_type').notNull(),
  
  eventType: text('event_type').notNull(),
  eventCategory: text('event_category').notNull(),
  
  action: text('action'),
  input: jsonb('input'),
  output: jsonb('output'),
  
  success: boolean('success').notNull(),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  
  durationMs: integer('duration_ms'),
  
  runId: text('run_id'),
  stepId: text('step_id'),
  requestId: text('request_id'),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent')
}, (table) => ({
  tenantIdx: index('connector_audit_tenant_idx').on(table.tenantId),
  connectorIdx: index('connector_audit_connector_idx').on(table.connectorId),
  timestampIdx: index('connector_audit_timestamp_idx').on(table.timestamp),
  eventTypeIdx: index('connector_audit_event_type_idx').on(table.eventType),
  actorIdx: index('connector_audit_actor_idx').on(table.actorId)
}));

export class ConnectorAuditLogger {
  private buffer: ConnectorAuditEvent[] = [];
  private flushInterval = 5000;
  private maxBufferSize = 100;
  
  constructor(
    private db: Database,
    private sensitiveFieldDetector: SensitiveFieldDetector
  ) {
    setInterval(() => this.flush(), this.flushInterval);
  }
  
  async log(event: Omit<ConnectorAuditEvent, 'id' | 'timestamp'>): Promise<void> {
    // Sanitize sensitive fields
    const sanitizedEvent: ConnectorAuditEvent = {
      ...event,
      id: generateId('audit'),
      timestamp: new Date(),
      input: this.sanitize(event.input),
      output: this.sanitize(event.output)
    };
    
    this.buffer.push(sanitizedEvent);
    
    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush();
    }
    
    // Real-time streaming for security events
    if (this.isSecurityEvent(event.eventType)) {
      await this.streamToSIEM(sanitizedEvent);
    }
  }
  
  private sanitize(data: Record<string, any> | undefined): Record<string, any> | undefined {
    if (!data) return undefined;
    
    const sanitized = { ...data };
    
    for (const key of Object.keys(sanitized)) {
      if (this.sensitiveFieldDetector.isSensitive(key)) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
        sanitized[key] = this.sanitize(sanitized[key]);
      }
    }
    
    return sanitized;
  }
  
  private isSecurityEvent(eventType: ConnectorEventType): boolean {
    const securityEvents: ConnectorEventType[] = [
      'credential.created',
      'credential.retrieved',
      'credential.rotated',
      'credential.revoked',
      'scope.granted',
      'scope.revoked',
      'webhook.rejected'
    ];
    return securityEvents.includes(eventType);
  }
  
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const events = [...this.buffer];
    this.buffer = [];
    
    try {
      await this.db.insert(connectorAuditLog).values(events);
    } catch (error) {
      this.buffer.unshift(...events);
      console.error('Failed to flush connector audit events:', error);
    }
  }
  
  private async streamToSIEM(event: ConnectorAuditEvent): Promise<void> {
    if (!process.env.SIEM_ENDPOINT) return;
    
    await fetch(process.env.SIEM_ENDPOINT, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SIEM_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'manus-connector',
        event
      })
    }).catch(err => console.error('SIEM streaming failed:', err));
  }
}

// Sensitive field detection
export class SensitiveFieldDetector {
  private sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /auth/i,
    /credential/i,
    /private[_-]?key/i,
    /access[_-]?key/i,
    /bearer/i,
    /ssn/i,
    /social[_-]?security/i,
    /credit[_-]?card/i,
    /cvv/i,
    /pin/i
  ];
  
  isSensitive(fieldName: string): boolean {
    return this.sensitivePatterns.some(pattern => pattern.test(fieldName));
  }
}
```

#### 1.7 Webhook Handling

```typescript
// packages/connector-sdk/src/webhooks/handler.ts

export interface WebhookHandler {
  /** Register a webhook endpoint */
  register(config: WebhookConfig): Promise<WebhookEndpoint>;
  
  /** Handle incoming webhook */
  handle(request: WebhookRequest): Promise<WebhookResponse>;
  
  /** Verify webhook signature */
  verify(request: WebhookRequest, config: WebhookConfig): Promise<boolean>;
  
  /** List registered webhooks */
  list(instanceId: string): Promise<WebhookEndpoint[]>;
  
  /** Delete webhook */
  delete(webhookId: string): Promise<void>;
}

export interface WebhookConfig {
  instanceId: string;
  connectorId: string;
  triggerId: string;
  
  // Verification
  verificationMethod: 'hmac' | 'signature' | 'token' | 'none';
  verificationSecret?: string;
  
  // Processing
  retryPolicy: RetryPolicy;
  timeout: number;
  
  // Filtering
  eventTypes?: string[];
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  instanceId: string;
  connectorId: string;
  triggerId: string;
  
  status: 'active' | 'paused' | 'failed';
  lastReceivedAt?: Date;
  lastSuccessAt?: Date;
  failureCount: number;
  
  createdAt: Date;
}

export interface WebhookRequest {
  webhookId: string;
  method: string;
  headers: Record<string, string>;
  body: any;
  rawBody: Buffer;
  timestamp: Date;
}

// Database schema
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: text('id').primaryKey(),
  instanceId: text('instance_id').notNull().references(() => connectorInstances.id),
  connectorId: text('connector_id').notNull(),
  triggerId: text('trigger_id').notNull(),
  
  // Generated URL path
  urlPath: text('url_path').notNull().unique(),
  
  // Verification
  verificationMethod: text('verification_method').notNull(),
  verificationSecretEncrypted: bytea('verification_secret_encrypted'),
  
  // Processing config
  retryPolicy: jsonb('retry_policy').notNull(),
  timeout: integer('timeout').notNull().default(30000),
  eventTypes: jsonb('event_types'),
  
  // Status
  status: text('status').notNull().default('active'),
  lastReceivedAt: timestamp('last_received_at'),
  lastSuccessAt: timestamp('last_success_at'),
  failureCount: integer('failure_count').notNull().default(0),
  
  createdAt: timestamp('created_at').defaultNow().notNull()
});

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  webhookId: text('webhook_id').notNull().references(() => webhookEndpoints.id),
  
  // Request
  requestHeaders: jsonb('request_headers').notNull(),
  requestBody: jsonb('request_body'),
  
  // Verification
  signatureValid: boolean('signature_valid'),
  
  // Processing
  status: text('status').notNull(), // 'pending', 'processing', 'success', 'failed'
  attempts: integer('attempts').notNull().default(0),
  lastAttemptAt: timestamp('last_attempt_at'),
  nextAttemptAt: timestamp('next_attempt_at'),
  
  // Result
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  errorMessage: text('error_message'),
  
  // Timing
  processingDurationMs: integer('processing_duration_ms'),
  
  receivedAt: timestamp('received_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at')
});

export class WebhookHandlerImpl implements WebhookHandler {
  constructor(
    private db: Database,
    private queue: Queue,
    private auditLogger: ConnectorAuditLogger,
    private credentialStorage: CredentialStorage
  ) {}
  
  async register(config: WebhookConfig): Promise<WebhookEndpoint> {
    const webhookId = generateId('webhook');
    const urlPath = this.generateSecureUrlPath();
    
    // Encrypt verification secret if provided
    let encryptedSecret: Buffer | undefined;
    if (config.verificationSecret) {
      encryptedSecret = await this.encryptSecret(config.verificationSecret);
    }
    
    await this.db.insert(webhookEndpoints).values({
      id: webhookId,
      instanceId: config.instanceId,
      connectorId: config.connectorId,
      triggerId: config.triggerId,
      urlPath,
      verificationMethod: config.verificationMethod,
      verificationSecretEncrypted: encryptedSecret,
      retryPolicy: config.retryPolicy,
      timeout: config.timeout,
      eventTypes: config.eventTypes
    });
    
    const fullUrl = `${process.env.WEBHOOK_BASE_URL}/webhooks/${urlPath}`;
    
    await this.auditLogger.log({
      tenantId: await this.getTenantId(config.instanceId),
      connectorId: config.connectorId,
      instanceId: config.instanceId,
      actorId: getCurrentActorId(),
      actorType: 'user',
      eventType: 'webhook.registered',
      eventCategory: 'webhook',
      success: true
    });
    
    return {
      id: webhookId,
      url: fullUrl,
      instanceId: config.instanceId,
      connectorId: config.connectorId,
      triggerId: config.triggerId,
      status: 'active',
      failureCount: 0,
      createdAt: new Date()
    };
  }
  
  async handle(request: WebhookRequest): Promise<WebhookResponse> {
    const startTime = Date.now();
    
    // 1. Find webhook endpoint
    const endpoint = await this.db.query.webhookEndpoints.findFirst({
      where: eq(webhookEndpoints.id, request.webhookId)
    });
    
    if (!endpoint || endpoint.status !== 'active') {
      return { status: 404, body: { error: 'Webhook not found' } };
    }
    
    // 2. Create delivery record
    const deliveryId = generateId('delivery');
    await this.db.insert(webhookDeliveries).values({
      id: deliveryId,
      webhookId: request.webhookId,
      requestHeaders: request.headers,
      requestBody: request.body,
      status: 'pending'
    });
    
    // 3. Verify signature
    const signatureValid = await this.verify(request, endpoint);
    
    await this.db.update(webhookDeliveries)
      .set({ signatureValid })
      .where(eq(webhookDeliveries.id, deliveryId));
    
    if (!signatureValid) {
      await this.db.update(webhookDeliveries)
        .set({ 
          status: 'failed',
          errorMessage: 'Invalid signature',
          completedAt: new Date()
        })
        .where(eq(webhookDeliveries.id, deliveryId));
      
      await this.auditLogger.log({
        tenantId: await this.getTenantId(endpoint.instanceId),
        connectorId: endpoint.connectorId,
        instanceId: endpoint.instanceId,
        actorId: 'webhook',
        actorType: 'webhook',
        eventType: 'webhook.rejected',
        eventCategory: 'webhook',
        success: false,
        errorMessage: 'Invalid signature'
      });
      
      return { status: 401, body: { error: 'Invalid signature' } };
    }
    
    // 4. Check event type filter
    if (endpoint.eventTypes && endpoint.eventTypes.length > 0) {
      const eventType = this.extractEventType(request.body);
      if (!endpoint.eventTypes.includes(eventType)) {
        await this.db.update(webhookDeliveries)
          .set({ 
            status: 'success',
            completedAt: new Date(),
            processingDurationMs: Date.now() - startTime
          })
          .where(eq(webhookDeliveries.id, deliveryId));
        
        return { status: 200, body: { message: 'Event type filtered' } };
      }
    }
    
    // 5. Queue for processing
    await this.queue.add('webhook.process', {
      deliveryId,
      webhookId: request.webhookId,
      instanceId: endpoint.instanceId,
      connectorId: endpoint.connectorId,
      triggerId: endpoint.triggerId,
      payload: request.body
    }, {
      attempts: endpoint.retryPolicy.maxRetries,
      backoff: {
        type: endpoint.retryPolicy.backoffType,
        delay: endpoint.retryPolicy.initialDelayMs
      }
    });
    
    // 6. Update endpoint stats
    await this.db.update(webhookEndpoints)
      .set({ lastReceivedAt: new Date() })
      .where(eq(webhookEndpoints.id, request.webhookId));
    
    await this.auditLogger.log({
      tenantId: await this.getTenantId(endpoint.instanceId),
      connectorId: endpoint.connectorId,
      instanceId: endpoint.instanceId,
      actorId: 'webhook',
      actorType: 'webhook',
      eventType: 'webhook.received',
      eventCategory: 'webhook',
      success: true,
      durationMs: Date.now() - startTime
    });
    
    return { status: 200, body: { deliveryId } };
  }
  
  async verify(request: WebhookRequest, config: any): Promise<boolean> {
    switch (config.verificationMethod) {
      case 'hmac':
        return this.verifyHMAC(request, config);
      case 'signature':
        return this.verifySignature(request, config);
      case 'token':
        return this.verifyToken(request, config);
      case 'none':
        return true;
      default:
        return false;
    }
  }
  
  private async verifyHMAC(request: WebhookRequest, config: any): Promise<boolean> {
    const secret = await this.decryptSecret(config.verificationSecretEncrypted);
    const signatureHeader = request.headers['x-signature'] || 
                           request.headers['x-hub-signature-256'] ||
                           request.headers['x-webhook-signature'];
    
    if (!signatureHeader) return false;
    
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(request.rawBody)
      .digest('hex');
    
    // Handle different signature formats
    const actualSignature = signatureHeader.replace('sha256=', '');
    
    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(actualSignature)
    );
  }
  
  private generateSecureUrlPath(): string {
    return crypto.randomBytes(32).toString('base64url');
  }
}
```


---

## 2. Security Hardening

### PR-023: Tenant Isolation Strategy

#### 2.1 Isolation Architecture

Manus implements a **hybrid isolation strategy** that combines database-level row security with application-level enforcement and infrastructure isolation for sensitive workloads.

| Isolation Level | Implementation | Use Case |
|-----------------|----------------|----------|
| **Logical** | Row-Level Security (RLS) | Standard multi-tenant data |
| **Schema** | Separate schemas per tenant | Enterprise customers |
| **Physical** | Dedicated database instances | Regulated industries |
| **Compute** | Isolated sandbox pools | Code execution |

```typescript
// packages/security/src/isolation/strategy.ts

export interface TenantIsolationConfig {
  level: 'logical' | 'schema' | 'physical';
  
  // Database isolation
  database: {
    useRLS: boolean;
    separateSchema: boolean;
    dedicatedInstance: boolean;
    connectionPoolSize: number;
  };
  
  // Compute isolation
  compute: {
    dedicatedSandboxPool: boolean;
    isolatedNetwork: boolean;
    resourceQuotas: ResourceQuotas;
  };
  
  // Storage isolation
  storage: {
    separateBucket: boolean;
    encryptionKeyPerTenant: boolean;
    dataResidency?: string;
  };
}

export const ISOLATION_CONFIGS: Record<string, TenantIsolationConfig> = {
  // Free/Pro tiers - shared infrastructure with RLS
  standard: {
    level: 'logical',
    database: {
      useRLS: true,
      separateSchema: false,
      dedicatedInstance: false,
      connectionPoolSize: 5
    },
    compute: {
      dedicatedSandboxPool: false,
      isolatedNetwork: false,
      resourceQuotas: {
        maxConcurrentRuns: 5,
        maxCpuCores: 2,
        maxMemoryMB: 4096,
        maxStorageMB: 10240
      }
    },
    storage: {
      separateBucket: false,
      encryptionKeyPerTenant: false
    }
  },
  
  // Enterprise tier - schema isolation
  enterprise: {
    level: 'schema',
    database: {
      useRLS: true,
      separateSchema: true,
      dedicatedInstance: false,
      connectionPoolSize: 20
    },
    compute: {
      dedicatedSandboxPool: true,
      isolatedNetwork: true,
      resourceQuotas: {
        maxConcurrentRuns: 50,
        maxCpuCores: 8,
        maxMemoryMB: 32768,
        maxStorageMB: 102400
      }
    },
    storage: {
      separateBucket: true,
      encryptionKeyPerTenant: true
    }
  },
  
  // Regulated tier - full physical isolation
  regulated: {
    level: 'physical',
    database: {
      useRLS: true,
      separateSchema: true,
      dedicatedInstance: true,
      connectionPoolSize: 50
    },
    compute: {
      dedicatedSandboxPool: true,
      isolatedNetwork: true,
      resourceQuotas: {
        maxConcurrentRuns: 100,
        maxCpuCores: 16,
        maxMemoryMB: 65536,
        maxStorageMB: 1048576
      }
    },
    storage: {
      separateBucket: true,
      encryptionKeyPerTenant: true,
      dataResidency: 'required'
    }
  }
};

// Row-Level Security implementation
export class RLSEnforcer {
  async setupRLS(tenantId: string): Promise<void> {
    // Create RLS policies for all tenant-scoped tables
    const tables = [
      'runs', 'steps', 'artifacts', 'workspaces', 
      'documents', 'conversations', 'connector_instances'
    ];
    
    for (const table of tables) {
      await this.db.execute(sql`
        -- Enable RLS on table
        ALTER TABLE ${sql.identifier(table)} ENABLE ROW LEVEL SECURITY;
        
        -- Force RLS for table owner too
        ALTER TABLE ${sql.identifier(table)} FORCE ROW LEVEL SECURITY;
        
        -- Create policy for SELECT
        CREATE POLICY ${sql.identifier(`${table}_tenant_select`)}
          ON ${sql.identifier(table)}
          FOR SELECT
          USING (tenant_id = current_setting('app.current_tenant_id')::text);
        
        -- Create policy for INSERT
        CREATE POLICY ${sql.identifier(`${table}_tenant_insert`)}
          ON ${sql.identifier(table)}
          FOR INSERT
          WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::text);
        
        -- Create policy for UPDATE
        CREATE POLICY ${sql.identifier(`${table}_tenant_update`)}
          ON ${sql.identifier(table)}
          FOR UPDATE
          USING (tenant_id = current_setting('app.current_tenant_id')::text)
          WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::text);
        
        -- Create policy for DELETE
        CREATE POLICY ${sql.identifier(`${table}_tenant_delete`)}
          ON ${sql.identifier(table)}
          FOR DELETE
          USING (tenant_id = current_setting('app.current_tenant_id')::text);
      `);
    }
  }
  
  async setTenantContext(tenantId: string): Promise<void> {
    await this.db.execute(sql`
      SET LOCAL app.current_tenant_id = ${tenantId};
    `);
  }
}

// Schema isolation for enterprise tenants
export class SchemaIsolator {
  async createTenantSchema(tenantId: string): Promise<void> {
    const schemaName = `tenant_${tenantId.replace(/-/g, '_')}`;
    
    // Create schema
    await this.db.execute(sql`
      CREATE SCHEMA IF NOT EXISTS ${sql.identifier(schemaName)};
    `);
    
    // Create all tables in tenant schema
    await this.migrateTenantSchema(schemaName);
    
    // Create role for tenant
    await this.db.execute(sql`
      CREATE ROLE ${sql.identifier(`role_${schemaName}`)} NOLOGIN;
      GRANT USAGE ON SCHEMA ${sql.identifier(schemaName)} 
        TO ${sql.identifier(`role_${schemaName}`)};
      GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA ${sql.identifier(schemaName)} 
        TO ${sql.identifier(`role_${schemaName}`)};
    `);
    
    // Store schema mapping
    await this.db.insert(tenantSchemas).values({
      tenantId,
      schemaName,
      createdAt: new Date()
    });
  }
  
  async getTenantConnection(tenantId: string): Promise<DatabaseConnection> {
    const schema = await this.db.query.tenantSchemas.findFirst({
      where: eq(tenantSchemas.tenantId, tenantId)
    });
    
    if (!schema) {
      throw new TenantSchemaNotFoundError(tenantId);
    }
    
    // Return connection with schema search path
    return this.pool.connect({
      searchPath: [schema.schemaName, 'public']
    });
  }
}
```

#### 2.2 Encryption Strategy

```typescript
// packages/security/src/encryption/strategy.ts

export interface EncryptionConfig {
  // At-rest encryption
  atRest: {
    enabled: boolean;
    algorithm: 'AES-256-GCM' | 'ChaCha20-Poly1305';
    keyManagement: 'kms' | 'vault' | 'local';
    keyRotationDays: number;
  };
  
  // In-transit encryption
  inTransit: {
    minTlsVersion: '1.2' | '1.3';
    cipherSuites: string[];
    certificateRotationDays: number;
  };
  
  // In-use encryption (for sensitive operations)
  inUse: {
    enabled: boolean;
    enclaveType?: 'sgx' | 'nitro' | 'sev';
  };
  
  // Field-level encryption
  fieldLevel: {
    enabled: boolean;
    fields: EncryptedFieldConfig[];
  };
}

export interface EncryptedFieldConfig {
  table: string;
  column: string;
  searchable: boolean;  // Use deterministic encryption for searchable fields
  indexable: boolean;
}

export const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
  atRest: {
    enabled: true,
    algorithm: 'AES-256-GCM',
    keyManagement: 'kms',
    keyRotationDays: 90
  },
  inTransit: {
    minTlsVersion: '1.3',
    cipherSuites: [
      'TLS_AES_256_GCM_SHA384',
      'TLS_CHACHA20_POLY1305_SHA256',
      'TLS_AES_128_GCM_SHA256'
    ],
    certificateRotationDays: 30
  },
  inUse: {
    enabled: false  // Enable for regulated tenants
  },
  fieldLevel: {
    enabled: true,
    fields: [
      { table: 'connector_credentials', column: 'encrypted_data', searchable: false, indexable: false },
      { table: 'users', column: 'email', searchable: true, indexable: true },
      { table: 'audit_logs', column: 'actor_ip', searchable: false, indexable: false }
    ]
  }
};

// Envelope encryption implementation
export class EnvelopeEncryption {
  constructor(
    private kms: KMSClient,
    private config: EncryptionConfig
  ) {}
  
  async encrypt(
    plaintext: Buffer,
    context: EncryptionContext
  ): Promise<EncryptedPayload> {
    // 1. Generate Data Encryption Key (DEK)
    const dek = crypto.randomBytes(32);
    
    // 2. Encrypt plaintext with DEK
    const iv = crypto.randomBytes(12);  // 96 bits for GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', dek, iv);
    cipher.setAAD(Buffer.from(JSON.stringify(context)));
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final()
    ]);
    const authTag = cipher.getAuthTag();
    
    // 3. Encrypt DEK with KEK (Key Encryption Key) from KMS
    const kekId = await this.getKEK(context.tenantId);
    const encryptedDek = await this.kms.encrypt({
      KeyId: kekId,
      Plaintext: dek,
      EncryptionContext: {
        tenantId: context.tenantId,
        purpose: context.purpose
      }
    });
    
    // 4. Clear DEK from memory
    dek.fill(0);
    
    // 5. Return encrypted payload
    return {
      version: 1,
      algorithm: 'AES-256-GCM',
      kekId,
      encryptedDek: encryptedDek.CiphertextBlob!.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      ciphertext: encrypted.toString('base64'),
      context
    };
  }
  
  async decrypt(
    payload: EncryptedPayload,
    context: EncryptionContext
  ): Promise<Buffer> {
    // 1. Decrypt DEK using KMS
    const decryptedDek = await this.kms.decrypt({
      KeyId: payload.kekId,
      CiphertextBlob: Buffer.from(payload.encryptedDek, 'base64'),
      EncryptionContext: {
        tenantId: context.tenantId,
        purpose: context.purpose
      }
    });
    
    // 2. Decrypt ciphertext with DEK
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      decryptedDek.Plaintext!,
      Buffer.from(payload.iv, 'base64')
    );
    decipher.setAuthTag(Buffer.from(payload.authTag, 'base64'));
    decipher.setAAD(Buffer.from(JSON.stringify(payload.context)));
    
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.ciphertext, 'base64')),
      decipher.final()
    ]);
    
    // 3. Clear DEK from memory
    decryptedDek.Plaintext!.fill(0);
    
    return decrypted;
  }
  
  private async getKEK(tenantId: string): Promise<string> {
    // Check if tenant has dedicated KEK
    const tenantKey = await this.db.query.tenantEncryptionKeys.findFirst({
      where: and(
        eq(tenantEncryptionKeys.tenantId, tenantId),
        eq(tenantEncryptionKeys.status, 'active')
      )
    });
    
    if (tenantKey) {
      return tenantKey.kmsKeyId;
    }
    
    // Use shared KEK for standard tenants
    return process.env.DEFAULT_KMS_KEY_ID!;
  }
}

// Key rotation
export class KeyRotationManager {
  async rotateKey(tenantId: string): Promise<KeyRotationResult> {
    // 1. Create new key version in KMS
    const currentKey = await this.getCurrentKey(tenantId);
    const newKeyVersion = await this.kms.createKeyVersion(currentKey.kmsKeyId);
    
    // 2. Re-encrypt all DEKs with new key version
    const credentials = await this.db.query.connectorCredentials.findMany({
      where: eq(connectorCredentials.tenantId, tenantId)
    });
    
    for (const cred of credentials) {
      // Decrypt DEK with old key
      const decryptedDek = await this.kms.decrypt({
        KeyId: currentKey.kmsKeyId,
        CiphertextBlob: cred.encryptedDek
      });
      
      // Re-encrypt DEK with new key version
      const reEncryptedDek = await this.kms.encrypt({
        KeyId: currentKey.kmsKeyId,
        Plaintext: decryptedDek.Plaintext!
      });
      
      // Update credential
      await this.db.update(connectorCredentials)
        .set({ encryptedDek: reEncryptedDek.CiphertextBlob })
        .where(eq(connectorCredentials.id, cred.id));
      
      // Clear sensitive data
      decryptedDek.Plaintext!.fill(0);
    }
    
    // 3. Schedule old key version for deletion
    await this.scheduleKeyDeletion(currentKey.kmsKeyId, currentKey.version);
    
    // 4. Audit log
    await this.auditLogger.log({
      action: 'encryption.key_rotated',
      tenantId,
      details: {
        oldVersion: currentKey.version,
        newVersion: newKeyVersion,
        credentialsReEncrypted: credentials.length
      }
    });
    
    return {
      success: true,
      newKeyVersion,
      itemsReEncrypted: credentials.length
    };
  }
}
```

#### 2.3 Secret Handling

```typescript
// packages/security/src/secrets/manager.ts

export interface SecretManager {
  /** Store a secret */
  store(secret: SecretInput): Promise<StoredSecret>;
  
  /** Retrieve a secret */
  retrieve(secretId: string): Promise<string>;
  
  /** Rotate a secret */
  rotate(secretId: string, newValue: string): Promise<void>;
  
  /** Delete a secret */
  delete(secretId: string): Promise<void>;
  
  /** List secrets (metadata only) */
  list(tenantId: string): Promise<SecretMetadata[]>;
}

export interface SecretInput {
  tenantId: string;
  name: string;
  value: string;
  type: 'api_key' | 'password' | 'certificate' | 'token' | 'custom';
  
  // Access control
  allowedServices: string[];
  allowedEnvironments: string[];
  
  // Lifecycle
  expiresAt?: Date;
  rotationPolicy?: RotationPolicy;
}

// Database schema
export const secrets = pgTable('secrets', {
  id: text('id').primaryKey(),
  tenantId: text('tenant_id').notNull(),
  name: text('name').notNull(),
  type: text('type').notNull(),
  
  // Encrypted value (using envelope encryption)
  encryptedValue: bytea('encrypted_value').notNull(),
  encryptedDek: bytea('encrypted_dek').notNull(),
  kmsKeyId: text('kms_key_id').notNull(),
  
  // Version tracking
  version: integer('version').notNull().default(1),
  previousVersionId: text('previous_version_id'),
  
  // Access control
  allowedServices: jsonb('allowed_services').notNull(),
  allowedEnvironments: jsonb('allowed_environments').notNull(),
  
  // Lifecycle
  expiresAt: timestamp('expires_at'),
  rotationPolicy: jsonb('rotation_policy'),
  lastRotatedAt: timestamp('last_rotated_at'),
  nextRotationAt: timestamp('next_rotation_at'),
  
  // Audit
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull()
}, (table) => ({
  tenantNameIdx: uniqueIndex('secret_tenant_name_idx').on(table.tenantId, table.name),
  expiresIdx: index('secret_expires_idx').on(table.expiresAt)
}));

// Secret access log (immutable)
export const secretAccessLog = pgTable('secret_access_log', {
  id: text('id').primaryKey(),
  secretId: text('secret_id').notNull(),
  tenantId: text('tenant_id').notNull(),
  
  action: text('action').notNull(), // 'retrieve', 'rotate', 'delete'
  
  // Actor
  actorId: text('actor_id').notNull(),
  actorType: text('actor_type').notNull(),
  serviceName: text('service_name'),
  
  // Context
  environment: text('environment'),
  ipAddress: text('ip_address'),
  requestId: text('request_id'),
  
  // Result
  success: boolean('success').notNull(),
  denialReason: text('denial_reason'),
  
  timestamp: timestamp('timestamp').defaultNow().notNull()
});

export class SecretManagerImpl implements SecretManager {
  constructor(
    private encryption: EnvelopeEncryption,
    private db: Database,
    private auditLogger: AuditLogger
  ) {}
  
  async retrieve(secretId: string): Promise<string> {
    const context = getCurrentContext();
    
    // 1. Fetch secret
    const secret = await this.db.query.secrets.findFirst({
      where: eq(secrets.id, secretId)
    });
    
    if (!secret) {
      await this.logAccess(secretId, 'retrieve', false, 'Secret not found');
      throw new SecretNotFoundError(secretId);
    }
    
    // 2. Check expiry
    if (secret.expiresAt && secret.expiresAt < new Date()) {
      await this.logAccess(secretId, 'retrieve', false, 'Secret expired');
      throw new SecretExpiredError(secretId);
    }
    
    // 3. Check access control
    if (!this.checkAccess(secret, context)) {
      await this.logAccess(secretId, 'retrieve', false, 'Access denied');
      throw new SecretAccessDeniedError(secretId);
    }
    
    // 4. Decrypt
    const decrypted = await this.encryption.decrypt({
      version: 1,
      algorithm: 'AES-256-GCM',
      kekId: secret.kmsKeyId,
      encryptedDek: secret.encryptedDek.toString('base64'),
      iv: '', // Stored in encrypted value
      authTag: '',
      ciphertext: secret.encryptedValue.toString('base64'),
      context: { tenantId: secret.tenantId, purpose: 'secret' }
    }, {
      tenantId: secret.tenantId,
      purpose: 'secret'
    });
    
    // 5. Log access
    await this.logAccess(secretId, 'retrieve', true);
    
    return decrypted.toString('utf8');
  }
  
  private checkAccess(secret: any, context: RequestContext): boolean {
    // Check service allowlist
    if (secret.allowedServices.length > 0) {
      if (!secret.allowedServices.includes(context.serviceName)) {
        return false;
      }
    }
    
    // Check environment allowlist
    if (secret.allowedEnvironments.length > 0) {
      if (!secret.allowedEnvironments.includes(context.environment)) {
        return false;
      }
    }
    
    return true;
  }
  
  private async logAccess(
    secretId: string,
    action: string,
    success: boolean,
    denialReason?: string
  ): Promise<void> {
    const context = getCurrentContext();
    
    await this.db.insert(secretAccessLog).values({
      id: generateId('saccess'),
      secretId,
      tenantId: context.tenantId,
      action,
      actorId: context.actorId,
      actorType: context.actorType,
      serviceName: context.serviceName,
      environment: context.environment,
      ipAddress: context.ipAddress,
      requestId: context.requestId,
      success,
      denialReason
    });
  }
}
```

#### 2.4 Audit Log Immutability

```typescript
// packages/security/src/audit/immutable.ts

export interface ImmutableAuditLog {
  /** Append an audit event (no updates or deletes allowed) */
  append(event: AuditEvent): Promise<string>;
  
  /** Query audit events */
  query(params: AuditQueryParams): Promise<AuditQueryResult>;
  
  /** Verify integrity of audit chain */
  verifyIntegrity(startId: string, endId: string): Promise<IntegrityResult>;
  
  /** Export audit log for compliance */
  export(params: ExportParams): Promise<ExportResult>;
}

export interface AuditEvent {
  tenantId: string;
  
  // Event identification
  eventType: string;
  eventCategory: string;
  
  // Actor
  actorId: string;
  actorType: 'user' | 'agent' | 'system' | 'service';
  actorName?: string;
  
  // Resource
  resourceType: string;
  resourceId: string;
  
  // Details
  action: string;
  details: Record<string, any>;
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
  sessionId?: string;
  
  // Result
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

// Immutable audit log schema with hash chain
export const immutableAuditLog = pgTable('immutable_audit_log', {
  id: text('id').primaryKey(),
  sequenceNumber: bigserial('sequence_number', { mode: 'number' }).notNull(),
  
  // Hash chain for tamper detection
  previousHash: text('previous_hash').notNull(),
  currentHash: text('current_hash').notNull(),
  
  // Event data
  tenantId: text('tenant_id').notNull(),
  eventType: text('event_type').notNull(),
  eventCategory: text('event_category').notNull(),
  
  actorId: text('actor_id').notNull(),
  actorType: text('actor_type').notNull(),
  actorName: text('actor_name'),
  
  resourceType: text('resource_type').notNull(),
  resourceId: text('resource_id').notNull(),
  
  action: text('action').notNull(),
  details: jsonb('details').notNull(),
  
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  requestId: text('request_id'),
  sessionId: text('session_id'),
  
  success: boolean('success').notNull(),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  
  timestamp: timestamp('timestamp').defaultNow().notNull()
}, (table) => ({
  // Indexes for querying
  tenantIdx: index('audit_tenant_idx').on(table.tenantId),
  timestampIdx: index('audit_timestamp_idx').on(table.timestamp),
  eventTypeIdx: index('audit_event_type_idx').on(table.eventType),
  actorIdx: index('audit_actor_idx').on(table.actorId),
  resourceIdx: index('audit_resource_idx').on(table.resourceType, table.resourceId),
  
  // Unique constraint on sequence number
  sequenceUnique: uniqueIndex('audit_sequence_unique').on(table.sequenceNumber)
}));

// Prevent updates and deletes via database trigger
const AUDIT_IMMUTABILITY_TRIGGER = `
CREATE OR REPLACE FUNCTION prevent_audit_modification()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Audit log entries cannot be modified';
  ELSIF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Audit log entries cannot be deleted';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_immutability_trigger
BEFORE UPDATE OR DELETE ON immutable_audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_modification();
`;

export class ImmutableAuditLogImpl implements ImmutableAuditLog {
  private lastHash: string = 'GENESIS';
  private hashLock = new Mutex();
  
  constructor(
    private db: Database,
    private externalArchive?: ExternalArchive
  ) {}
  
  async append(event: AuditEvent): Promise<string> {
    // Acquire lock to ensure sequential hash chain
    const release = await this.hashLock.acquire();
    
    try {
      const eventId = generateId('audit');
      
      // Get previous hash
      const lastEntry = await this.db.query.immutableAuditLog.findFirst({
        orderBy: [desc(immutableAuditLog.sequenceNumber)]
      });
      
      const previousHash = lastEntry?.currentHash || 'GENESIS';
      
      // Calculate current hash
      const eventData = {
        id: eventId,
        previousHash,
        ...event,
        timestamp: new Date()
      };
      
      const currentHash = this.calculateHash(eventData);
      
      // Insert event
      await this.db.insert(immutableAuditLog).values({
        id: eventId,
        previousHash,
        currentHash,
        ...event
      });
      
      // Archive to external storage for additional tamper protection
      if (this.externalArchive) {
        await this.externalArchive.archive({
          ...eventData,
          currentHash
        });
      }
      
      return eventId;
      
    } finally {
      release();
    }
  }
  
  async verifyIntegrity(startId: string, endId: string): Promise<IntegrityResult> {
    // Fetch all events in range
    const events = await this.db.query.immutableAuditLog.findMany({
      where: and(
        gte(immutableAuditLog.id, startId),
        lte(immutableAuditLog.id, endId)
      ),
      orderBy: [asc(immutableAuditLog.sequenceNumber)]
    });
    
    if (events.length === 0) {
      return { valid: true, eventsChecked: 0 };
    }
    
    const violations: IntegrityViolation[] = [];
    
    for (let i = 0; i < events.length; i++) {
      const event = events[i];
      
      // Verify hash chain
      if (i > 0) {
        const expectedPreviousHash = events[i - 1].currentHash;
        if (event.previousHash !== expectedPreviousHash) {
          violations.push({
            eventId: event.id,
            type: 'chain_break',
            message: `Previous hash mismatch at event ${event.id}`
          });
        }
      }
      
      // Verify current hash
      const calculatedHash = this.calculateHash({
        id: event.id,
        previousHash: event.previousHash,
        tenantId: event.tenantId,
        eventType: event.eventType,
        eventCategory: event.eventCategory,
        actorId: event.actorId,
        actorType: event.actorType,
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        action: event.action,
        details: event.details,
        success: event.success,
        timestamp: event.timestamp
      });
      
      if (calculatedHash !== event.currentHash) {
        violations.push({
          eventId: event.id,
          type: 'hash_mismatch',
          message: `Hash mismatch at event ${event.id}`
        });
      }
    }
    
    return {
      valid: violations.length === 0,
      eventsChecked: events.length,
      violations
    };
  }
  
  async export(params: ExportParams): Promise<ExportResult> {
    const events = await this.query({
      tenantId: params.tenantId,
      startDate: params.startDate,
      endDate: params.endDate,
      limit: params.maxEvents || 100000
    });
    
    // Generate export file
    const exportData = {
      exportId: generateId('export'),
      exportedAt: new Date(),
      params,
      events: events.events,
      integrityHash: this.calculateHash(events.events)
    };
    
    // Sign export
    const signature = await this.signExport(exportData);
    
    return {
      exportId: exportData.exportId,
      eventCount: events.events.length,
      data: exportData,
      signature
    };
  }
  
  private calculateHash(data: any): string {
    const normalized = JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(normalized).digest('hex');
  }
  
  private async signExport(data: any): Promise<string> {
    // Sign with KMS key for non-repudiation
    const dataHash = this.calculateHash(data);
    
    const signature = await this.kms.sign({
      KeyId: process.env.AUDIT_SIGNING_KEY_ID!,
      Message: Buffer.from(dataHash),
      MessageType: 'DIGEST',
      SigningAlgorithm: 'RSASSA_PKCS1_V1_5_SHA_256'
    });
    
    return signature.Signature!.toString('base64');
  }
}
```


---

## 3. Acceptance & Load Testing

### PR-024: End-to-End Test Suite

#### 3.1 Test Architecture

```typescript
// packages/testing/src/e2e/framework.ts

export interface E2ETestConfig {
  baseUrl: string;
  apiUrl: string;
  wsUrl: string;
  
  // Test tenant
  testTenant: {
    id: string;
    apiKey: string;
  };
  
  // Timeouts
  defaultTimeout: number;
  longRunningTimeout: number;
  
  // Parallelism
  maxParallelTests: number;
  
  // Retries
  retryCount: number;
  retryDelay: number;
}

export interface TestSuite {
  name: string;
  description: string;
  tags: string[];
  setup?: () => Promise<void>;
  teardown?: () => Promise<void>;
  tests: TestCase[];
}

export interface TestCase {
  id: string;
  name: string;
  description: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  timeout?: number;
  retries?: number;
  
  // Test steps
  steps: TestStep[];
  
  // Assertions
  assertions: Assertion[];
  
  // Cleanup
  cleanup?: () => Promise<void>;
}

export interface TestStep {
  name: string;
  action: () => Promise<any>;
  expectedResult?: any;
  timeout?: number;
}
```

#### 3.2 Critical Path Test Cases

```typescript
// packages/testing/src/e2e/suites/critical-path.ts

export const criticalPathSuite: TestSuite = {
  name: 'Critical Path Tests',
  description: 'Tests for core functionality that must always work',
  tags: ['critical', 'smoke', 'blocking'],
  
  tests: [
    // ========================================
    // Authentication & Authorization
    // ========================================
    {
      id: 'AUTH-001',
      name: 'User can authenticate via OAuth',
      description: 'Verify OAuth flow completes successfully',
      priority: 'critical',
      tags: ['auth', 'oauth'],
      steps: [
        {
          name: 'Initiate OAuth flow',
          action: async () => {
            const response = await fetch(`${config.apiUrl}/auth/oauth/authorize`, {
              method: 'GET',
              redirect: 'manual'
            });
            expect(response.status).toBe(302);
            return response.headers.get('location');
          }
        },
        {
          name: 'Complete OAuth callback',
          action: async (authUrl: string) => {
            // Simulate OAuth provider callback
            const callbackUrl = `${config.apiUrl}/auth/oauth/callback?code=test_code&state=test_state`;
            const response = await fetch(callbackUrl);
            expect(response.status).toBe(200);
            return response.json();
          }
        },
        {
          name: 'Verify session created',
          action: async (authResult: any) => {
            expect(authResult.accessToken).toBeDefined();
            expect(authResult.user.id).toBeDefined();
          }
        }
      ],
      assertions: [
        { type: 'response_time', maxMs: 2000 },
        { type: 'status_code', expected: 200 }
      ]
    },
    
    {
      id: 'AUTH-002',
      name: 'API key authentication works',
      description: 'Verify API key authentication for programmatic access',
      priority: 'critical',
      tags: ['auth', 'api-key'],
      steps: [
        {
          name: 'Create API key',
          action: async () => {
            const response = await authenticatedFetch(`${config.apiUrl}/api-keys`, {
              method: 'POST',
              body: JSON.stringify({ name: 'Test Key', scopes: ['runs:read', 'runs:write'] })
            });
            expect(response.status).toBe(201);
            return response.json();
          }
        },
        {
          name: 'Use API key for authentication',
          action: async (apiKey: any) => {
            const response = await fetch(`${config.apiUrl}/runs`, {
              headers: { 'Authorization': `Bearer ${apiKey.key}` }
            });
            expect(response.status).toBe(200);
          }
        }
      ],
      assertions: [
        { type: 'response_time', maxMs: 500 }
      ]
    },
    
    // ========================================
    // Run Lifecycle
    // ========================================
    {
      id: 'RUN-001',
      name: 'Simple run completes successfully',
      description: 'Verify a basic run can be created and completed',
      priority: 'critical',
      tags: ['run', 'core'],
      timeout: 60000,
      steps: [
        {
          name: 'Create run',
          action: async () => {
            const response = await authenticatedFetch(`${config.apiUrl}/runs`, {
              method: 'POST',
              body: JSON.stringify({
                prompt: 'What is 2 + 2?',
                config: { maxSteps: 5 }
              })
            });
            expect(response.status).toBe(201);
            return response.json();
          }
        },
        {
          name: 'Wait for run completion',
          action: async (run: any) => {
            return waitForRunCompletion(run.id, 30000);
          }
        },
        {
          name: 'Verify run result',
          action: async (run: any) => {
            expect(run.status).toBe('completed');
            expect(run.result).toBeDefined();
            expect(run.result.answer).toContain('4');
          }
        }
      ],
      assertions: [
        { type: 'run_completed', timeout: 30000 },
        { type: 'no_errors' }
      ]
    },
    
    {
      id: 'RUN-002',
      name: 'Run with tool execution',
      description: 'Verify runs can execute tools correctly',
      priority: 'critical',
      tags: ['run', 'tools'],
      timeout: 120000,
      steps: [
        {
          name: 'Create run requiring tool use',
          action: async () => {
            const response = await authenticatedFetch(`${config.apiUrl}/runs`, {
              method: 'POST',
              body: JSON.stringify({
                prompt: 'Search for the current weather in Zurich',
                config: { 
                  maxSteps: 10,
                  allowedTools: ['web_search']
                }
              })
            });
            return response.json();
          }
        },
        {
          name: 'Wait for completion',
          action: async (run: any) => {
            return waitForRunCompletion(run.id, 60000);
          }
        },
        {
          name: 'Verify tool was used',
          action: async (run: any) => {
            const steps = await getRunSteps(run.id);
            const toolSteps = steps.filter(s => s.type === 'tool_call');
            expect(toolSteps.length).toBeGreaterThan(0);
            expect(toolSteps[0].tool).toBe('web_search');
          }
        }
      ],
      assertions: [
        { type: 'tool_executed', tool: 'web_search' },
        { type: 'run_completed', timeout: 60000 }
      ]
    },
    
    {
      id: 'RUN-003',
      name: 'Run cancellation works',
      description: 'Verify runs can be cancelled mid-execution',
      priority: 'critical',
      tags: ['run', 'cancellation'],
      steps: [
        {
          name: 'Create long-running run',
          action: async () => {
            const response = await authenticatedFetch(`${config.apiUrl}/runs`, {
              method: 'POST',
              body: JSON.stringify({
                prompt: 'Write a 10000 word essay about artificial intelligence',
                config: { maxSteps: 100 }
              })
            });
            return response.json();
          }
        },
        {
          name: 'Wait for run to start',
          action: async (run: any) => {
            await waitForRunStatus(run.id, 'running', 10000);
            return run;
          }
        },
        {
          name: 'Cancel run',
          action: async (run: any) => {
            const response = await authenticatedFetch(`${config.apiUrl}/runs/${run.id}/cancel`, {
              method: 'POST'
            });
            expect(response.status).toBe(200);
            return run;
          }
        },
        {
          name: 'Verify run cancelled',
          action: async (run: any) => {
            const updatedRun = await getRun(run.id);
            expect(updatedRun.status).toBe('cancelled');
          }
        }
      ],
      assertions: [
        { type: 'status', expected: 'cancelled' }
      ]
    },
    
    // ========================================
    // Document Generation
    // ========================================
    {
      id: 'DOC-001',
      name: 'PDF document generation',
      description: 'Verify PDF documents can be generated',
      priority: 'critical',
      tags: ['document', 'pdf'],
      timeout: 60000,
      steps: [
        {
          name: 'Request PDF generation',
          action: async () => {
            const response = await authenticatedFetch(`${config.apiUrl}/documents/generate`, {
              method: 'POST',
              body: JSON.stringify({
                type: 'pdf',
                template: 'report',
                data: {
                  title: 'Test Report',
                  content: 'This is a test report.'
                }
              })
            });
            return response.json();
          }
        },
        {
          name: 'Wait for generation',
          action: async (job: any) => {
            return waitForJobCompletion(job.id, 30000);
          }
        },
        {
          name: 'Verify PDF created',
          action: async (job: any) => {
            expect(job.status).toBe('completed');
            expect(job.result.url).toMatch(/\.pdf$/);
            
            // Verify PDF is downloadable
            const response = await fetch(job.result.url);
            expect(response.status).toBe(200);
            expect(response.headers.get('content-type')).toBe('application/pdf');
          }
        }
      ],
      assertions: [
        { type: 'file_created', extension: 'pdf' },
        { type: 'file_size', minBytes: 1000 }
      ]
    },
    
    {
      id: 'DOC-002',
      name: 'Presentation generation',
      description: 'Verify PPTX presentations can be generated',
      priority: 'critical',
      tags: ['document', 'pptx'],
      timeout: 120000,
      steps: [
        {
          name: 'Request presentation generation',
          action: async () => {
            const response = await authenticatedFetch(`${config.apiUrl}/documents/generate`, {
              method: 'POST',
              body: JSON.stringify({
                type: 'pptx',
                prompt: 'Create a 5-slide presentation about AI trends',
                config: { slideCount: 5 }
              })
            });
            return response.json();
          }
        },
        {
          name: 'Wait for generation',
          action: async (job: any) => {
            return waitForJobCompletion(job.id, 90000);
          }
        },
        {
          name: 'Verify PPTX created',
          action: async (job: any) => {
            expect(job.status).toBe('completed');
            expect(job.result.url).toMatch(/\.pptx$/);
            
            // Verify slide count
            const metadata = await getDocumentMetadata(job.result.id);
            expect(metadata.slideCount).toBe(5);
          }
        }
      ],
      assertions: [
        { type: 'file_created', extension: 'pptx' },
        { type: 'slide_count', expected: 5 }
      ]
    },
    
    // ========================================
    // Connector Integration
    // ========================================
    {
      id: 'CONN-001',
      name: 'Connector installation and execution',
      description: 'Verify connectors can be installed and used',
      priority: 'critical',
      tags: ['connector', 'integration'],
      steps: [
        {
          name: 'Install connector',
          action: async () => {
            const response = await authenticatedFetch(`${config.apiUrl}/connectors/install`, {
              method: 'POST',
              body: JSON.stringify({
                connectorId: 'test-connector',
                config: { apiKey: 'test-key' }
              })
            });
            expect(response.status).toBe(201);
            return response.json();
          }
        },
        {
          name: 'Execute connector action',
          action: async (instance: any) => {
            const response = await authenticatedFetch(`${config.apiUrl}/connectors/${instance.id}/execute`, {
              method: 'POST',
              body: JSON.stringify({
                action: 'test_action',
                input: { message: 'Hello' }
              })
            });
            expect(response.status).toBe(200);
            return response.json();
          }
        },
        {
          name: 'Verify execution result',
          action: async (result: any) => {
            expect(result.success).toBe(true);
            expect(result.output).toBeDefined();
          }
        }
      ],
      assertions: [
        { type: 'connector_installed' },
        { type: 'action_executed' }
      ]
    },
    
    // ========================================
    // Billing & Credits
    // ========================================
    {
      id: 'BILL-001',
      name: 'Credit deduction on run completion',
      description: 'Verify credits are correctly deducted after run',
      priority: 'critical',
      tags: ['billing', 'credits'],
      steps: [
        {
          name: 'Get initial credit balance',
          action: async () => {
            const response = await authenticatedFetch(`${config.apiUrl}/billing/balance`);
            return response.json();
          }
        },
        {
          name: 'Execute run',
          action: async (initialBalance: any) => {
            const runResponse = await authenticatedFetch(`${config.apiUrl}/runs`, {
              method: 'POST',
              body: JSON.stringify({ prompt: 'What is 1 + 1?' })
            });
            const run = await runResponse.json();
            await waitForRunCompletion(run.id, 30000);
            return { initialBalance, runId: run.id };
          }
        },
        {
          name: 'Verify credit deduction',
          action: async ({ initialBalance, runId }: any) => {
            const finalBalance = await authenticatedFetch(`${config.apiUrl}/billing/balance`).then(r => r.json());
            expect(finalBalance.credits).toBeLessThan(initialBalance.credits);
            
            // Verify transaction recorded
            const transactions = await authenticatedFetch(`${config.apiUrl}/billing/transactions?runId=${runId}`).then(r => r.json());
            expect(transactions.length).toBeGreaterThan(0);
            expect(transactions[0].type).toBe('debit');
          }
        }
      ],
      assertions: [
        { type: 'credits_deducted' },
        { type: 'transaction_recorded' }
      ]
    },
    
    // ========================================
    // Collaboration
    // ========================================
    {
      id: 'COLLAB-001',
      name: 'Real-time collaboration sync',
      description: 'Verify changes sync between collaborators',
      priority: 'critical',
      tags: ['collaboration', 'realtime'],
      steps: [
        {
          name: 'Create workspace',
          action: async () => {
            const response = await authenticatedFetch(`${config.apiUrl}/workspaces`, {
              method: 'POST',
              body: JSON.stringify({ name: 'Test Workspace' })
            });
            return response.json();
          }
        },
        {
          name: 'Connect two clients',
          action: async (workspace: any) => {
            const client1 = await connectWebSocket(workspace.id, 'user1');
            const client2 = await connectWebSocket(workspace.id, 'user2');
            return { workspace, client1, client2 };
          }
        },
        {
          name: 'Make change from client 1',
          action: async ({ workspace, client1, client2 }: any) => {
            const change = { type: 'insert', position: 0, text: 'Hello' };
            client1.send(JSON.stringify({ type: 'change', data: change }));
            
            // Wait for sync
            const receivedChange = await waitForMessage(client2, 'change', 5000);
            expect(receivedChange.data.text).toBe('Hello');
            
            return { workspace, client1, client2 };
          }
        },
        {
          name: 'Verify state consistency',
          action: async ({ workspace, client1, client2 }: any) => {
            const state1 = await getClientState(client1);
            const state2 = await getClientState(client2);
            expect(state1).toEqual(state2);
            
            // Cleanup
            client1.close();
            client2.close();
          }
        }
      ],
      assertions: [
        { type: 'sync_latency', maxMs: 500 },
        { type: 'state_consistent' }
      ]
    }
  ]
};
```

#### 3.3 Security Test Cases

```typescript
// packages/testing/src/e2e/suites/security.ts

export const securityTestSuite: TestSuite = {
  name: 'Security Tests',
  description: 'Tests for security controls and isolation',
  tags: ['security', 'isolation'],
  
  tests: [
    {
      id: 'SEC-001',
      name: 'Tenant isolation - data access',
      description: 'Verify tenants cannot access other tenant data',
      priority: 'critical',
      tags: ['isolation', 'data'],
      steps: [
        {
          name: 'Create data as tenant A',
          action: async () => {
            const response = await authenticatedFetch(`${config.apiUrl}/runs`, {
              method: 'POST',
              headers: { 'X-Tenant-ID': 'tenant-a' },
              body: JSON.stringify({ prompt: 'Test' })
            });
            return response.json();
          }
        },
        {
          name: 'Attempt access as tenant B',
          action: async (run: any) => {
            const response = await authenticatedFetch(`${config.apiUrl}/runs/${run.id}`, {
              headers: { 'X-Tenant-ID': 'tenant-b' }
            });
            expect(response.status).toBe(404);
          }
        }
      ],
      assertions: [
        { type: 'access_denied' }
      ]
    },
    
    {
      id: 'SEC-002',
      name: 'Sandbox network isolation',
      description: 'Verify sandbox cannot access internal services',
      priority: 'critical',
      tags: ['sandbox', 'network'],
      steps: [
        {
          name: 'Execute code attempting internal access',
          action: async () => {
            const response = await authenticatedFetch(`${config.apiUrl}/runs`, {
              method: 'POST',
              body: JSON.stringify({
                prompt: 'Execute: curl http://internal-api.default.svc.cluster.local',
                config: { allowCodeExecution: true }
              })
            });
            const run = await response.json();
            await waitForRunCompletion(run.id, 30000);
            return run;
          }
        },
        {
          name: 'Verify access blocked',
          action: async (run: any) => {
            const steps = await getRunSteps(run.id);
            const codeStep = steps.find(s => s.type === 'code_execution');
            expect(codeStep.result.error).toMatch(/network.*blocked|connection.*refused/i);
          }
        }
      ],
      assertions: [
        { type: 'network_blocked' }
      ]
    },
    
    {
      id: 'SEC-003',
      name: 'Rate limiting enforcement',
      description: 'Verify rate limits are enforced',
      priority: 'high',
      tags: ['rate-limit'],
      steps: [
        {
          name: 'Send requests up to limit',
          action: async () => {
            const requests = [];
            for (let i = 0; i < 100; i++) {
              requests.push(authenticatedFetch(`${config.apiUrl}/runs`));
            }
            const responses = await Promise.all(requests);
            return responses;
          }
        },
        {
          name: 'Verify rate limit triggered',
          action: async (responses: Response[]) => {
            const rateLimited = responses.filter(r => r.status === 429);
            expect(rateLimited.length).toBeGreaterThan(0);
            
            // Verify retry-after header
            const limitedResponse = rateLimited[0];
            expect(limitedResponse.headers.get('retry-after')).toBeDefined();
          }
        }
      ],
      assertions: [
        { type: 'rate_limit_enforced' }
      ]
    },
    
    {
      id: 'SEC-004',
      name: 'Credential encryption verification',
      description: 'Verify credentials are encrypted at rest',
      priority: 'critical',
      tags: ['encryption', 'credentials'],
      steps: [
        {
          name: 'Store credential',
          action: async () => {
            const response = await authenticatedFetch(`${config.apiUrl}/connectors/install`, {
              method: 'POST',
              body: JSON.stringify({
                connectorId: 'test-connector',
                credentials: { apiKey: 'super-secret-key-12345' }
              })
            });
            return response.json();
          }
        },
        {
          name: 'Verify encryption in database',
          action: async (instance: any) => {
            // Direct database query (admin only)
            const credential = await adminQuery(`
              SELECT encrypted_data, encrypted_dek 
              FROM connector_credentials 
              WHERE id = $1
            `, [instance.credentialId]);
            
            // Verify data is encrypted (not plaintext)
            const encryptedData = credential.encrypted_data.toString();
            expect(encryptedData).not.toContain('super-secret-key-12345');
            
            // Verify DEK is encrypted
            expect(credential.encrypted_dek).toBeDefined();
          }
        }
      ],
      assertions: [
        { type: 'data_encrypted' }
      ]
    },
    
    {
      id: 'SEC-005',
      name: 'Audit log immutability',
      description: 'Verify audit logs cannot be modified',
      priority: 'critical',
      tags: ['audit', 'immutability'],
      steps: [
        {
          name: 'Create audit event',
          action: async () => {
            // Trigger an auditable action
            const response = await authenticatedFetch(`${config.apiUrl}/runs`, {
              method: 'POST',
              body: JSON.stringify({ prompt: 'Test' })
            });
            const run = await response.json();
            
            // Get audit log entry
            const auditLogs = await adminQuery(`
              SELECT * FROM immutable_audit_log 
              WHERE resource_id = $1 
              ORDER BY timestamp DESC LIMIT 1
            `, [run.id]);
            
            return auditLogs[0];
          }
        },
        {
          name: 'Attempt to modify audit log',
          action: async (auditEntry: any) => {
            try {
              await adminQuery(`
                UPDATE immutable_audit_log 
                SET action = 'modified' 
                WHERE id = $1
              `, [auditEntry.id]);
              fail('Should have thrown error');
            } catch (error) {
              expect(error.message).toContain('cannot be modified');
            }
          }
        },
        {
          name: 'Attempt to delete audit log',
          action: async (auditEntry: any) => {
            try {
              await adminQuery(`
                DELETE FROM immutable_audit_log 
                WHERE id = $1
              `, [auditEntry.id]);
              fail('Should have thrown error');
            } catch (error) {
              expect(error.message).toContain('cannot be deleted');
            }
          }
        }
      ],
      assertions: [
        { type: 'modification_blocked' },
        { type: 'deletion_blocked' }
      ]
    }
  ]
};
```

#### 3.4 Load Test Configuration

```typescript
// packages/testing/src/load/config.ts

export interface LoadTestConfig {
  // Target system
  target: {
    baseUrl: string;
    apiUrl: string;
    wsUrl: string;
  };
  
  // Load profile
  profile: LoadProfile;
  
  // Duration
  duration: {
    rampUp: number;      // seconds
    steadyState: number; // seconds
    rampDown: number;    // seconds
  };
  
  // Thresholds
  thresholds: LoadThresholds;
}

export interface LoadProfile {
  name: string;
  
  // Virtual users
  vus: {
    min: number;
    max: number;
    target: number;
  };
  
  // Request rate
  rps: {
    min: number;
    max: number;
    target: number;
  };
  
  // Scenario weights
  scenarios: ScenarioWeight[];
}

export interface ScenarioWeight {
  name: string;
  weight: number;  // Percentage of traffic
  config: ScenarioConfig;
}

export interface LoadThresholds {
  // Response time
  p50ResponseTime: number;  // ms
  p95ResponseTime: number;  // ms
  p99ResponseTime: number;  // ms
  
  // Error rate
  maxErrorRate: number;     // percentage
  
  // Throughput
  minRps: number;
  
  // Availability
  minAvailability: number;  // percentage
}

// Standard load profiles
export const LOAD_PROFILES: Record<string, LoadProfile> = {
  // Smoke test - verify system works under minimal load
  smoke: {
    name: 'Smoke Test',
    vus: { min: 1, max: 5, target: 3 },
    rps: { min: 1, max: 10, target: 5 },
    scenarios: [
      { name: 'simple_query', weight: 50, config: { maxSteps: 3 } },
      { name: 'document_generation', weight: 30, config: { type: 'pdf' } },
      { name: 'connector_action', weight: 20, config: { connector: 'test' } }
    ]
  },
  
  // Load test - verify system handles expected load
  load: {
    name: 'Load Test',
    vus: { min: 10, max: 100, target: 50 },
    rps: { min: 10, max: 100, target: 50 },
    scenarios: [
      { name: 'simple_query', weight: 40, config: { maxSteps: 5 } },
      { name: 'complex_query', weight: 20, config: { maxSteps: 20 } },
      { name: 'document_generation', weight: 20, config: { type: 'pptx' } },
      { name: 'connector_action', weight: 15, config: { connector: 'google' } },
      { name: 'collaboration', weight: 5, config: { users: 3 } }
    ]
  },
  
  // Stress test - find system breaking point
  stress: {
    name: 'Stress Test',
    vus: { min: 50, max: 500, target: 300 },
    rps: { min: 50, max: 500, target: 300 },
    scenarios: [
      { name: 'simple_query', weight: 50, config: { maxSteps: 5 } },
      { name: 'complex_query', weight: 30, config: { maxSteps: 50 } },
      { name: 'document_generation', weight: 15, config: { type: 'pptx', slides: 20 } },
      { name: 'connector_action', weight: 5, config: { connector: 'salesforce' } }
    ]
  },
  
  // Spike test - verify system handles sudden traffic spikes
  spike: {
    name: 'Spike Test',
    vus: { min: 10, max: 1000, target: 500 },
    rps: { min: 10, max: 1000, target: 500 },
    scenarios: [
      { name: 'simple_query', weight: 70, config: { maxSteps: 3 } },
      { name: 'document_generation', weight: 30, config: { type: 'pdf' } }
    ]
  },
  
  // Soak test - verify system stability over extended period
  soak: {
    name: 'Soak Test',
    vus: { min: 20, max: 50, target: 30 },
    rps: { min: 20, max: 50, target: 30 },
    scenarios: [
      { name: 'simple_query', weight: 40, config: { maxSteps: 5 } },
      { name: 'complex_query', weight: 20, config: { maxSteps: 15 } },
      { name: 'document_generation', weight: 20, config: { type: 'pdf' } },
      { name: 'connector_action', weight: 15, config: { connector: 'test' } },
      { name: 'collaboration', weight: 5, config: { users: 2 } }
    ]
  }
};

// Default thresholds
export const DEFAULT_THRESHOLDS: LoadThresholds = {
  p50ResponseTime: 500,    // 500ms
  p95ResponseTime: 2000,   // 2s
  p99ResponseTime: 5000,   // 5s
  maxErrorRate: 1,         // 1%
  minRps: 10,
  minAvailability: 99.9    // 99.9%
};

// Tier-specific thresholds
export const TIER_THRESHOLDS: Record<string, LoadThresholds> = {
  free: {
    p50ResponseTime: 1000,
    p95ResponseTime: 5000,
    p99ResponseTime: 10000,
    maxErrorRate: 5,
    minRps: 5,
    minAvailability: 99
  },
  pro: {
    p50ResponseTime: 500,
    p95ResponseTime: 2000,
    p99ResponseTime: 5000,
    maxErrorRate: 1,
    minRps: 20,
    minAvailability: 99.9
  },
  enterprise: {
    p50ResponseTime: 200,
    p95ResponseTime: 1000,
    p99ResponseTime: 2000,
    maxErrorRate: 0.1,
    minRps: 100,
    minAvailability: 99.99
  }
};
```

#### 3.5 k6 Load Test Script

```javascript
// packages/testing/src/load/k6/main.js

import http from 'k6/http';
import ws from 'k6/ws';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const runCompletionTime = new Trend('run_completion_time');
const documentGenerationTime = new Trend('document_generation_time');
const connectorExecutionTime = new Trend('connector_execution_time');
const errorRate = new Rate('errors');
const runsCreated = new Counter('runs_created');
const documentsGenerated = new Counter('documents_generated');

// Configuration
const BASE_URL = __ENV.BASE_URL || 'https://api.manus.example.com';
const API_KEY = __ENV.API_KEY;

export const options = {
  scenarios: {
    // Ramp up to target load
    load_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 50 },   // Ramp up
        { duration: '10m', target: 50 },  // Steady state
        { duration: '2m', target: 100 },  // Spike
        { duration: '5m', target: 100 },  // Hold spike
        { duration: '2m', target: 50 },   // Return to normal
        { duration: '5m', target: 50 },   // Steady state
        { duration: '2m', target: 0 },    // Ramp down
      ],
    },
  },
  
  thresholds: {
    http_req_duration: ['p(95)<2000', 'p(99)<5000'],
    http_req_failed: ['rate<0.01'],
    errors: ['rate<0.01'],
    run_completion_time: ['p(95)<30000'],
    document_generation_time: ['p(95)<60000'],
  },
};

const headers = {
  'Authorization': `Bearer ${API_KEY}`,
  'Content-Type': 'application/json',
};

// Scenario: Simple Query
function simpleQuery() {
  group('Simple Query', function() {
    // Create run
    const createRes = http.post(
      `${BASE_URL}/runs`,
      JSON.stringify({
        prompt: 'What is the capital of Switzerland?',
        config: { maxSteps: 5 }
      }),
      { headers }
    );
    
    check(createRes, {
      'run created': (r) => r.status === 201,
    });
    
    if (createRes.status !== 201) {
      errorRate.add(1);
      return;
    }
    
    runsCreated.add(1);
    const run = JSON.parse(createRes.body);
    
    // Poll for completion
    const startTime = Date.now();
    let completed = false;
    let attempts = 0;
    const maxAttempts = 60;
    
    while (!completed && attempts < maxAttempts) {
      sleep(1);
      attempts++;
      
      const statusRes = http.get(`${BASE_URL}/runs/${run.id}`, { headers });
      
      if (statusRes.status === 200) {
        const runStatus = JSON.parse(statusRes.body);
        if (runStatus.status === 'completed' || runStatus.status === 'failed') {
          completed = true;
          runCompletionTime.add(Date.now() - startTime);
          
          check(runStatus, {
            'run completed successfully': (r) => r.status === 'completed',
          });
          
          if (runStatus.status === 'failed') {
            errorRate.add(1);
          }
        }
      }
    }
    
    if (!completed) {
      errorRate.add(1);
    }
  });
}

// Scenario: Document Generation
function documentGeneration() {
  group('Document Generation', function() {
    const docType = randomItem(['pdf', 'pptx', 'xlsx']);
    
    const createRes = http.post(
      `${BASE_URL}/documents/generate`,
      JSON.stringify({
        type: docType,
        prompt: 'Create a simple test document',
        config: { 
          slideCount: docType === 'pptx' ? 5 : undefined 
        }
      }),
      { headers }
    );
    
    check(createRes, {
      'document job created': (r) => r.status === 201,
    });
    
    if (createRes.status !== 201) {
      errorRate.add(1);
      return;
    }
    
    const job = JSON.parse(createRes.body);
    
    // Poll for completion
    const startTime = Date.now();
    let completed = false;
    let attempts = 0;
    const maxAttempts = 120;
    
    while (!completed && attempts < maxAttempts) {
      sleep(1);
      attempts++;
      
      const statusRes = http.get(`${BASE_URL}/documents/jobs/${job.id}`, { headers });
      
      if (statusRes.status === 200) {
        const jobStatus = JSON.parse(statusRes.body);
        if (jobStatus.status === 'completed' || jobStatus.status === 'failed') {
          completed = true;
          documentGenerationTime.add(Date.now() - startTime);
          documentsGenerated.add(1);
          
          check(jobStatus, {
            'document generated successfully': (r) => r.status === 'completed',
          });
          
          if (jobStatus.status === 'failed') {
            errorRate.add(1);
          }
        }
      }
    }
    
    if (!completed) {
      errorRate.add(1);
    }
  });
}

// Scenario: Connector Action
function connectorAction() {
  group('Connector Action', function() {
    const startTime = Date.now();
    
    const res = http.post(
      `${BASE_URL}/connectors/test-connector/execute`,
      JSON.stringify({
        action: 'test_action',
        input: { message: 'Hello from load test' }
      }),
      { headers }
    );
    
    connectorExecutionTime.add(Date.now() - startTime);
    
    check(res, {
      'connector action successful': (r) => r.status === 200,
    });
    
    if (res.status !== 200) {
      errorRate.add(1);
    }
  });
}

// Scenario: Collaboration WebSocket
function collaboration() {
  group('Collaboration', function() {
    const wsUrl = BASE_URL.replace('http', 'ws') + '/ws/workspaces/test-workspace';
    
    const res = ws.connect(wsUrl, { headers }, function(socket) {
      socket.on('open', function() {
        socket.send(JSON.stringify({
          type: 'join',
          workspaceId: 'test-workspace'
        }));
      });
      
      socket.on('message', function(msg) {
        const data = JSON.parse(msg);
        check(data, {
          'received message': (d) => d.type !== undefined,
        });
      });
      
      socket.on('error', function(e) {
        errorRate.add(1);
      });
      
      // Simulate editing
      for (let i = 0; i < 10; i++) {
        socket.send(JSON.stringify({
          type: 'change',
          data: { position: i, text: 'x' }
        }));
        sleep(0.5);
      }
      
      socket.close();
    });
    
    check(res, {
      'websocket connected': (r) => r && r.status === 101,
    });
  });
}

// Main execution
export default function() {
  // Weighted scenario selection
  const rand = Math.random() * 100;
  
  if (rand < 40) {
    simpleQuery();
  } else if (rand < 60) {
    documentGeneration();
  } else if (rand < 80) {
    connectorAction();
  } else {
    collaboration();
  }
  
  // Think time between iterations
  sleep(randomIntBetween(1, 3));
}

// Lifecycle hooks
export function setup() {
  console.log('Starting load test...');
  
  // Verify API is accessible
  const healthRes = http.get(`${BASE_URL}/health`);
  check(healthRes, {
    'API is healthy': (r) => r.status === 200,
  });
  
  return { startTime: Date.now() };
}

export function teardown(data) {
  const duration = (Date.now() - data.startTime) / 1000;
  console.log(`Load test completed in ${duration}s`);
}
```

#### 3.6 Test Execution Pipeline

```yaml
# .github/workflows/e2e-tests.yml

name: E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

env:
  TEST_ENVIRONMENT: staging

jobs:
  critical-path:
    name: Critical Path Tests
    runs-on: ubuntu-latest
    timeout-minutes: 30
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run critical path tests
        run: pnpm test:e2e --suite=critical-path
        env:
          API_URL: ${{ secrets.STAGING_API_URL }}
          API_KEY: ${{ secrets.STAGING_API_KEY }}
      
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: critical-path-results
          path: test-results/
      
      - name: Notify on failure
        if: failure()
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "Critical path tests failed!",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Critical Path Tests Failed*\n<${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}|View Results>"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK }}

  security-tests:
    name: Security Tests
    runs-on: ubuntu-latest
    timeout-minutes: 45
    needs: critical-path
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run security tests
        run: pnpm test:e2e --suite=security
        env:
          API_URL: ${{ secrets.STAGING_API_URL }}
          API_KEY: ${{ secrets.STAGING_API_KEY }}
          ADMIN_API_KEY: ${{ secrets.STAGING_ADMIN_API_KEY }}

  load-test:
    name: Load Test
    runs-on: ubuntu-latest
    timeout-minutes: 60
    needs: [critical-path, security-tests]
    if: github.event_name == 'schedule' || github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup k6
        uses: grafana/setup-k6-action@v1
      
      - name: Run load test
        run: |
          k6 run packages/testing/src/load/k6/main.js \
            --out json=load-test-results.json \
            --out influxdb=${{ secrets.INFLUXDB_URL }}
        env:
          BASE_URL: ${{ secrets.STAGING_API_URL }}
          API_KEY: ${{ secrets.STAGING_API_KEY }}
      
      - name: Upload load test results
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: load-test-results.json
      
      - name: Check thresholds
        run: |
          # Parse results and check thresholds
          node scripts/check-load-test-thresholds.js load-test-results.json

  chaos-test:
    name: Chaos Engineering
    runs-on: ubuntu-latest
    timeout-minutes: 90
    needs: load-test
    if: github.event_name == 'schedule'
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup kubectl
        uses: azure/setup-kubectl@v3
      
      - name: Configure kubeconfig
        run: |
          echo "${{ secrets.KUBE_CONFIG }}" | base64 -d > kubeconfig
          export KUBECONFIG=kubeconfig
      
      - name: Run chaos experiments
        run: |
          kubectl apply -f chaos/experiments/
          sleep 300  # Wait for experiments
          kubectl get chaosresults -o json > chaos-results.json
      
      - name: Verify system recovery
        run: |
          # Run health checks after chaos
          pnpm test:e2e --suite=smoke
        env:
          API_URL: ${{ secrets.STAGING_API_URL }}
          API_KEY: ${{ secrets.STAGING_API_KEY }}
```

---

## 4. Implementation Order

The recommended implementation order for Part 3 as a series of PRs:

| PR | Title | Dependencies | Estimated Effort |
|----|-------|--------------|------------------|
| PR-022 | Connector SDK Core | None | 2 weeks |
| PR-022a | Credential Storage | PR-022 | 1 week |
| PR-022b | OAuth Scope Management | PR-022 | 1 week |
| PR-022c | Rate Limiting | PR-022 | 3 days |
| PR-022d | Connector Auditing | PR-022 | 3 days |
| PR-022e | Webhook Handling | PR-022 | 1 week |
| PR-023 | Tenant Isolation | None | 2 weeks |
| PR-023a | Encryption Strategy | PR-023 | 1 week |
| PR-023b | Secret Management | PR-023a | 1 week |
| PR-023c | Audit Immutability | PR-023 | 1 week |
| PR-024 | E2E Test Framework | None | 1 week |
| PR-024a | Critical Path Tests | PR-024 | 1 week |
| PR-024b | Security Tests | PR-024 | 1 week |
| PR-024c | Load Test Suite | PR-024 | 1 week |
| PR-024d | CI/CD Pipeline | PR-024a-c | 3 days |

**Total Estimated Effort:** 12-14 weeks

---

## 5. References

1. OWASP Multi-Tenant Security Guidelines
2. AWS KMS Best Practices for Envelope Encryption
3. PostgreSQL Row-Level Security Documentation
4. k6 Load Testing Documentation
5. NIST Cryptographic Standards (SP 800-57)
6. SOC 2 Compliance Requirements
7. GDPR Data Protection Requirements
8. OAuth 2.0 Security Best Current Practice (RFC 6819)
