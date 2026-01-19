# Manus Implementation Playbook Part 2: Enterprise Gaps

> **Document Version:** 2.0.0  
> **Last Updated:** January 2025  
> **Author:** Manus Technical Lead  
> **Scope:** Enterprise-grade specifications for Security, Sandboxing, Queues, Multimodal, Collaboration, and Incident Ops

This document fills all identified gaps in the original implementation playbook with production-ready, enterprise-grade specifications. Every section includes exact schemas, pseudocode, and interface contracts.

---

## Table of Contents

1. [Security, Compliance and Authentication](#1-security-compliance-and-authentication)
2. [Sandbox Architecture and Tool Execution](#2-sandbox-architecture-and-tool-execution)
3. [Queue Semantics and Worker Topology](#3-queue-semantics-and-worker-topology)
4. [Multimodal Pipeline Details](#4-multimodal-pipeline-details)
5. [Collaboration Correctness and Permissions](#5-collaboration-correctness-and-permissions)
6. [SLOs, Observability and Incident Ops](#6-slos-observability-and-incident-ops)
7. [Implementation Order](#7-implementation-order)

---

## 1. Security, Compliance and Authentication

### PR-014: Enterprise Authentication

#### 1.1 Authentication Model Decision Matrix

| Method | Use Case | Session Duration | MFA Required | Enterprise Tier |
|--------|----------|------------------|--------------|-----------------|
| **OIDC** | Primary SSO | 24h | Optional | All |
| **SAML 2.0** | Enterprise IdP | 8h | Required | Enterprise |
| **API Key** | Programmatic | N/A (stateless) | N/A | All |
| **Service Account** | M2M | 1h (JWT) | N/A | Enterprise |

**Manus Internal Choice:** OIDC as primary, SAML for enterprise customers, API keys for automation.

#### 1.2 OIDC Implementation

```typescript
// packages/auth/src/oidc/provider.ts

export interface OIDCConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string[];
  responseType: 'code';
  codeChallengeMethod: 'S256';  // PKCE required
}

export interface OIDCTokenSet {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresAt: number;
  tokenType: 'Bearer';
}

export interface OIDCClaims {
  sub: string;           // Unique user identifier
  email: string;
  email_verified: boolean;
  name?: string;
  picture?: string;
  groups?: string[];     // For RBAC mapping
  tenant_id?: string;    // Custom claim for multi-tenancy
}

export class OIDCProvider {
  private config: OIDCConfig;
  private discoveryDocument: OIDCDiscovery | null = null;
  
  constructor(config: OIDCConfig) {
    this.config = config;
  }
  
  async initialize(): Promise<void> {
    // Fetch OIDC discovery document
    const response = await fetch(
      `${this.config.issuer}/.well-known/openid-configuration`
    );
    this.discoveryDocument = await response.json();
  }
  
  generateAuthorizationUrl(state: string, nonce: string): AuthorizationRequest {
    // Generate PKCE challenge
    const codeVerifier = generateCodeVerifier();
    const codeChallenge = generateCodeChallenge(codeVerifier);
    
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      response_type: this.config.responseType,
      scope: this.config.scopes.join(' '),
      state,
      nonce,
      code_challenge: codeChallenge,
      code_challenge_method: this.config.codeChallengeMethod
    });
    
    return {
      url: `${this.discoveryDocument!.authorization_endpoint}?${params}`,
      codeVerifier,
      state,
      nonce
    };
  }
  
  async exchangeCode(
    code: string,
    codeVerifier: string
  ): Promise<OIDCTokenSet> {
    const response = await fetch(this.discoveryDocument!.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
        redirect_uri: this.config.redirectUri,
        code_verifier: codeVerifier
      })
    });
    
    if (!response.ok) {
      throw new AuthenticationError('Token exchange failed');
    }
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      idToken: data.id_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      tokenType: 'Bearer'
    };
  }
  
  async validateIdToken(idToken: string, nonce: string): Promise<OIDCClaims> {
    // Fetch JWKS
    const jwksResponse = await fetch(this.discoveryDocument!.jwks_uri);
    const jwks = await jwksResponse.json();
    
    // Verify JWT signature
    const decoded = await verifyJWT(idToken, jwks);
    
    // Validate claims
    if (decoded.iss !== this.config.issuer) {
      throw new AuthenticationError('Invalid issuer');
    }
    if (decoded.aud !== this.config.clientId) {
      throw new AuthenticationError('Invalid audience');
    }
    if (decoded.nonce !== nonce) {
      throw new AuthenticationError('Invalid nonce');
    }
    if (decoded.exp * 1000 < Date.now()) {
      throw new AuthenticationError('Token expired');
    }
    
    return decoded as OIDCClaims;
  }
  
  async refreshTokens(refreshToken: string): Promise<OIDCTokenSet> {
    const response = await fetch(this.discoveryDocument!.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret
      })
    });
    
    if (!response.ok) {
      throw new AuthenticationError('Token refresh failed');
    }
    
    const data = await response.json();
    
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || refreshToken,
      idToken: data.id_token,
      expiresAt: Date.now() + (data.expires_in * 1000),
      tokenType: 'Bearer'
    };
  }
}

// PKCE helpers
function generateCodeVerifier(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

function generateCodeChallenge(verifier: string): string {
  const hash = crypto.createHash('sha256').update(verifier).digest();
  return base64UrlEncode(hash);
}
```

#### 1.3 SAML 2.0 Implementation

```typescript
// packages/auth/src/saml/provider.ts

export interface SAMLConfig {
  entityId: string;
  assertionConsumerServiceUrl: string;
  singleLogoutServiceUrl: string;
  idpMetadataUrl: string;
  signatureAlgorithm: 'sha256' | 'sha512';
  wantAssertionsSigned: true;
  wantResponseSigned: true;
  privateKey: string;
  certificate: string;
}

export interface SAMLAssertion {
  nameId: string;
  nameIdFormat: string;
  sessionIndex: string;
  attributes: Record<string, string | string[]>;
  conditions: {
    notBefore: Date;
    notOnOrAfter: Date;
    audienceRestriction: string[];
  };
}

export class SAMLProvider {
  private config: SAMLConfig;
  private idpMetadata: IDPMetadata | null = null;
  
  async initialize(): Promise<void> {
    // Fetch and parse IdP metadata
    const response = await fetch(this.config.idpMetadataUrl);
    const xml = await response.text();
    this.idpMetadata = parseSAMLMetadata(xml);
  }
  
  generateAuthnRequest(relayState: string): SAMLAuthnRequest {
    const id = `_${generateId()}`;
    const issueInstant = new Date().toISOString();
    
    const request = `
      <samlp:AuthnRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}"
        Version="2.0"
        IssueInstant="${issueInstant}"
        Destination="${this.idpMetadata!.ssoUrl}"
        AssertionConsumerServiceURL="${this.config.assertionConsumerServiceUrl}"
        ProtocolBinding="urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST">
        <saml:Issuer>${this.config.entityId}</saml:Issuer>
        <samlp:NameIDPolicy
          Format="urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress"
          AllowCreate="true"/>
      </samlp:AuthnRequest>
    `;
    
    // Sign request
    const signedRequest = signXML(request, this.config.privateKey, {
      algorithm: this.config.signatureAlgorithm
    });
    
    // Encode for redirect
    const encoded = deflateAndEncode(signedRequest);
    
    return {
      id,
      url: `${this.idpMetadata!.ssoUrl}?SAMLRequest=${encoded}&RelayState=${relayState}`,
      relayState
    };
  }
  
  async validateResponse(samlResponse: string): Promise<SAMLAssertion> {
    // Decode response
    const xml = Buffer.from(samlResponse, 'base64').toString('utf-8');
    
    // Verify signature
    const signatureValid = verifyXMLSignature(
      xml,
      this.idpMetadata!.certificate
    );
    
    if (!signatureValid) {
      throw new AuthenticationError('Invalid SAML signature');
    }
    
    // Parse assertion
    const assertion = parseSAMLAssertion(xml);
    
    // Validate conditions
    const now = new Date();
    if (now < assertion.conditions.notBefore) {
      throw new AuthenticationError('Assertion not yet valid');
    }
    if (now > assertion.conditions.notOnOrAfter) {
      throw new AuthenticationError('Assertion expired');
    }
    if (!assertion.conditions.audienceRestriction.includes(this.config.entityId)) {
      throw new AuthenticationError('Invalid audience');
    }
    
    return assertion;
  }
  
  generateLogoutRequest(nameId: string, sessionIndex: string): SAMLLogoutRequest {
    const id = `_${generateId()}`;
    const issueInstant = new Date().toISOString();
    
    const request = `
      <samlp:LogoutRequest
        xmlns:samlp="urn:oasis:names:tc:SAML:2.0:protocol"
        xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"
        ID="${id}"
        Version="2.0"
        IssueInstant="${issueInstant}"
        Destination="${this.idpMetadata!.sloUrl}">
        <saml:Issuer>${this.config.entityId}</saml:Issuer>
        <saml:NameID>${nameId}</saml:NameID>
        <samlp:SessionIndex>${sessionIndex}</samlp:SessionIndex>
      </samlp:LogoutRequest>
    `;
    
    const signedRequest = signXML(request, this.config.privateKey);
    const encoded = deflateAndEncode(signedRequest);
    
    return {
      id,
      url: `${this.idpMetadata!.sloUrl}?SAMLRequest=${encoded}`
    };
  }
}
```

#### 1.4 SCIM 2.0 Provisioning

```typescript
// packages/auth/src/scim/server.ts

// SCIM 2.0 User Schema
export interface SCIMUser {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'];
  id: string;
  externalId?: string;
  userName: string;
  name?: {
    formatted?: string;
    familyName?: string;
    givenName?: string;
  };
  emails: Array<{
    value: string;
    type: 'work' | 'home' | 'other';
    primary: boolean;
  }>;
  active: boolean;
  groups?: Array<{
    value: string;
    display: string;
  }>;
  meta: {
    resourceType: 'User';
    created: string;
    lastModified: string;
    location: string;
    version: string;
  };
}

// SCIM 2.0 Group Schema
export interface SCIMGroup {
  schemas: ['urn:ietf:params:scim:schemas:core:2.0:Group'];
  id: string;
  externalId?: string;
  displayName: string;
  members?: Array<{
    value: string;
    display: string;
    type: 'User' | 'Group';
  }>;
  meta: {
    resourceType: 'Group';
    created: string;
    lastModified: string;
    location: string;
    version: string;
  };
}

export class SCIMServer {
  constructor(
    private userService: UserService,
    private groupService: GroupService,
    private tenantId: string
  ) {}
  
  // POST /scim/v2/Users
  async createUser(request: SCIMUserRequest): Promise<SCIMUser> {
    // Validate required fields
    if (!request.userName) {
      throw new SCIMError('userName is required', 400, 'invalidValue');
    }
    
    // Check for existing user
    const existing = await this.userService.findByEmail(
      request.emails?.[0]?.value,
      this.tenantId
    );
    
    if (existing) {
      throw new SCIMError('User already exists', 409, 'uniqueness');
    }
    
    // Create user
    const user = await this.userService.create({
      tenantId: this.tenantId,
      email: request.emails?.[0]?.value || request.userName,
      name: request.name?.formatted || 
            `${request.name?.givenName || ''} ${request.name?.familyName || ''}`.trim(),
      externalId: request.externalId,
      active: request.active ?? true,
      source: 'scim'
    });
    
    // Assign to groups
    if (request.groups) {
      for (const group of request.groups) {
        await this.groupService.addMember(group.value, user.id);
      }
    }
    
    // Audit log
    await auditLog({
      action: 'scim.user.created',
      actor: 'scim_provider',
      resource: user.id,
      tenantId: this.tenantId,
      details: { externalId: request.externalId }
    });
    
    return this.toSCIMUser(user);
  }
  
  // GET /scim/v2/Users/:id
  async getUser(id: string): Promise<SCIMUser> {
    const user = await this.userService.findById(id, this.tenantId);
    
    if (!user) {
      throw new SCIMError('User not found', 404, 'noTarget');
    }
    
    return this.toSCIMUser(user);
  }
  
  // GET /scim/v2/Users?filter=...
  async listUsers(filter?: string, startIndex = 1, count = 100): Promise<SCIMListResponse<SCIMUser>> {
    // Parse SCIM filter
    const parsedFilter = filter ? parseSCIMFilter(filter) : null;
    
    const { users, total } = await this.userService.list({
      tenantId: this.tenantId,
      filter: parsedFilter,
      offset: startIndex - 1,
      limit: count
    });
    
    return {
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: total,
      startIndex,
      itemsPerPage: users.length,
      Resources: users.map(u => this.toSCIMUser(u))
    };
  }
  
  // PATCH /scim/v2/Users/:id
  async patchUser(id: string, operations: SCIMPatchOperation[]): Promise<SCIMUser> {
    const user = await this.userService.findById(id, this.tenantId);
    
    if (!user) {
      throw new SCIMError('User not found', 404, 'noTarget');
    }
    
    const updates: Partial<User> = {};
    
    for (const op of operations) {
      switch (op.op) {
        case 'replace':
          if (op.path === 'active') {
            updates.active = op.value as boolean;
          } else if (op.path === 'name.givenName') {
            updates.firstName = op.value as string;
          } else if (op.path === 'name.familyName') {
            updates.lastName = op.value as string;
          }
          break;
          
        case 'add':
          if (op.path === 'emails') {
            // Handle email addition
          }
          break;
          
        case 'remove':
          if (op.path === 'emails') {
            // Handle email removal
          }
          break;
      }
    }
    
    const updated = await this.userService.update(id, updates);
    
    // Audit log
    await auditLog({
      action: 'scim.user.updated',
      actor: 'scim_provider',
      resource: id,
      tenantId: this.tenantId,
      details: { operations }
    });
    
    return this.toSCIMUser(updated);
  }
  
  // DELETE /scim/v2/Users/:id
  async deleteUser(id: string): Promise<void> {
    const user = await this.userService.findById(id, this.tenantId);
    
    if (!user) {
      throw new SCIMError('User not found', 404, 'noTarget');
    }
    
    // Soft delete - deactivate user
    await this.userService.update(id, { active: false, deletedAt: new Date() });
    
    // Remove from all groups
    await this.groupService.removeUserFromAllGroups(id);
    
    // Revoke all sessions
    await this.sessionService.revokeAllForUser(id);
    
    // Audit log
    await auditLog({
      action: 'scim.user.deleted',
      actor: 'scim_provider',
      resource: id,
      tenantId: this.tenantId
    });
  }
  
  private toSCIMUser(user: User): SCIMUser {
    return {
      schemas: ['urn:ietf:params:scim:schemas:core:2.0:User'],
      id: user.id,
      externalId: user.externalId,
      userName: user.email,
      name: {
        formatted: user.name,
        givenName: user.firstName,
        familyName: user.lastName
      },
      emails: [{
        value: user.email,
        type: 'work',
        primary: true
      }],
      active: user.active,
      groups: user.groups?.map(g => ({
        value: g.id,
        display: g.name
      })),
      meta: {
        resourceType: 'User',
        created: user.createdAt.toISOString(),
        lastModified: user.updatedAt.toISOString(),
        location: `/scim/v2/Users/${user.id}`,
        version: `W/"${user.version}"`
      }
    };
  }
}
```

#### 1.5 Session Management

```typescript
// packages/auth/src/session/manager.ts

export interface Session {
  id: string;
  userId: string;
  tenantId: string;
  
  // Token data
  accessToken: string;
  refreshToken: string;
  idToken?: string;
  
  // Session metadata
  createdAt: number;
  expiresAt: number;
  lastActivityAt: number;
  
  // Security context
  ipAddress: string;
  userAgent: string;
  deviceFingerprint?: string;
  
  // MFA status
  mfaVerified: boolean;
  mfaMethod?: 'totp' | 'webauthn' | 'sms';
  
  // Session flags
  isImpersonation: boolean;
  impersonatorId?: string;
}

export interface SessionConfig {
  accessTokenTTL: number;      // 15 minutes
  refreshTokenTTL: number;     // 7 days
  absoluteTimeout: number;     // 24 hours
  idleTimeout: number;         // 30 minutes
  maxConcurrentSessions: number;
  requireMFA: boolean;
  bindToIP: boolean;
  bindToDevice: boolean;
}

export const DEFAULT_SESSION_CONFIG: SessionConfig = {
  accessTokenTTL: 15 * 60 * 1000,
  refreshTokenTTL: 7 * 24 * 60 * 60 * 1000,
  absoluteTimeout: 24 * 60 * 60 * 1000,
  idleTimeout: 30 * 60 * 1000,
  maxConcurrentSessions: 5,
  requireMFA: false,
  bindToIP: false,
  bindToDevice: false
};

export class SessionManager {
  constructor(
    private store: SessionStore,
    private config: SessionConfig = DEFAULT_SESSION_CONFIG
  ) {}
  
  async create(params: CreateSessionParams): Promise<Session> {
    // Check concurrent session limit
    const existingSessions = await this.store.listByUser(params.userId);
    
    if (existingSessions.length >= this.config.maxConcurrentSessions) {
      // Revoke oldest session
      const oldest = existingSessions.sort((a, b) => a.createdAt - b.createdAt)[0];
      await this.revoke(oldest.id, 'concurrent_limit');
    }
    
    // Generate tokens
    const accessToken = await this.generateAccessToken(params);
    const refreshToken = await this.generateRefreshToken(params);
    
    const session: Session = {
      id: generateId('sess'),
      userId: params.userId,
      tenantId: params.tenantId,
      accessToken,
      refreshToken,
      idToken: params.idToken,
      createdAt: Date.now(),
      expiresAt: Date.now() + this.config.absoluteTimeout,
      lastActivityAt: Date.now(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      deviceFingerprint: params.deviceFingerprint,
      mfaVerified: params.mfaVerified || false,
      mfaMethod: params.mfaMethod,
      isImpersonation: params.isImpersonation || false,
      impersonatorId: params.impersonatorId
    };
    
    await this.store.save(session);
    
    // Audit log
    await auditLog({
      action: 'session.created',
      actor: params.userId,
      resource: session.id,
      tenantId: params.tenantId,
      details: {
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        mfaVerified: session.mfaVerified
      }
    });
    
    return session;
  }
  
  async validate(accessToken: string, context: RequestContext): Promise<Session> {
    // Verify JWT
    const payload = await verifyJWT(accessToken, process.env.JWT_SECRET!);
    
    // Get session
    const session = await this.store.get(payload.sessionId);
    
    if (!session) {
      throw new AuthenticationError('Session not found');
    }
    
    // Check expiration
    if (Date.now() > session.expiresAt) {
      await this.revoke(session.id, 'expired');
      throw new AuthenticationError('Session expired');
    }
    
    // Check idle timeout
    if (Date.now() - session.lastActivityAt > this.config.idleTimeout) {
      await this.revoke(session.id, 'idle_timeout');
      throw new AuthenticationError('Session idle timeout');
    }
    
    // Check IP binding
    if (this.config.bindToIP && session.ipAddress !== context.ipAddress) {
      await this.revoke(session.id, 'ip_mismatch');
      throw new AuthenticationError('IP address mismatch');
    }
    
    // Check device binding
    if (this.config.bindToDevice && 
        session.deviceFingerprint !== context.deviceFingerprint) {
      await this.revoke(session.id, 'device_mismatch');
      throw new AuthenticationError('Device mismatch');
    }
    
    // Check MFA requirement
    if (this.config.requireMFA && !session.mfaVerified) {
      throw new MFARequiredError('MFA verification required');
    }
    
    // Update last activity
    await this.store.updateActivity(session.id, Date.now());
    
    return session;
  }
  
  async refresh(refreshToken: string): Promise<Session> {
    // Verify refresh token
    const payload = await verifyJWT(refreshToken, process.env.REFRESH_SECRET!);
    
    // Get session
    const session = await this.store.get(payload.sessionId);
    
    if (!session) {
      throw new AuthenticationError('Session not found');
    }
    
    // Check if refresh token matches
    if (session.refreshToken !== refreshToken) {
      // Possible token reuse attack - revoke all sessions
      await this.revokeAllForUser(session.userId, 'token_reuse');
      throw new AuthenticationError('Invalid refresh token');
    }
    
    // Generate new tokens
    const newAccessToken = await this.generateAccessToken({
      userId: session.userId,
      tenantId: session.tenantId,
      sessionId: session.id
    });
    
    const newRefreshToken = await this.generateRefreshToken({
      userId: session.userId,
      tenantId: session.tenantId,
      sessionId: session.id
    });
    
    // Update session
    const updated = await this.store.update(session.id, {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      lastActivityAt: Date.now()
    });
    
    return updated;
  }
  
  async revoke(sessionId: string, reason: string): Promise<void> {
    const session = await this.store.get(sessionId);
    
    if (!session) return;
    
    await this.store.delete(sessionId);
    
    // Audit log
    await auditLog({
      action: 'session.revoked',
      actor: 'system',
      resource: sessionId,
      tenantId: session.tenantId,
      details: { reason, userId: session.userId }
    });
  }
  
  async revokeAllForUser(userId: string, reason: string): Promise<void> {
    const sessions = await this.store.listByUser(userId);
    
    for (const session of sessions) {
      await this.revoke(session.id, reason);
    }
  }
  
  private async generateAccessToken(params: TokenParams): Promise<string> {
    return signJWT({
      sub: params.userId,
      tid: params.tenantId,
      sid: params.sessionId,
      type: 'access'
    }, process.env.JWT_SECRET!, {
      expiresIn: this.config.accessTokenTTL / 1000
    });
  }
  
  private async generateRefreshToken(params: TokenParams): Promise<string> {
    return signJWT({
      sub: params.userId,
      tid: params.tenantId,
      sid: params.sessionId,
      type: 'refresh'
    }, process.env.REFRESH_SECRET!, {
      expiresIn: this.config.refreshTokenTTL / 1000
    });
  }
}
```


### PR-015: Secrets and Key Management

#### 1.6 KMS Integration and Key Hierarchy

```typescript
// packages/security/src/kms/hierarchy.ts

/**
 * Key Hierarchy (3-tier):
 * 
 * Level 1: Master Key (HSM-backed, never leaves KMS)
 *   └── Level 2: Tenant Key (encrypted by Master Key)
 *         └── Level 3: Data Encryption Key (DEK, encrypted by Tenant Key)
 * 
 * This allows:
 * - Per-tenant key rotation without re-encrypting all data
 * - Crypto-shredding by deleting tenant key
 * - Compliance with key separation requirements
 */

export interface KeyHierarchy {
  masterKeyId: string;           // KMS key ARN
  tenantKeys: Map<string, TenantKey>;
  dekCache: LRUCache<string, DEK>;
}

export interface TenantKey {
  id: string;
  tenantId: string;
  encryptedKey: string;          // Encrypted by master key
  algorithm: 'AES-256-GCM';
  createdAt: number;
  rotatedAt: number;
  status: 'active' | 'rotating' | 'disabled';
}

export interface DEK {
  id: string;
  tenantId: string;
  encryptedKey: string;          // Encrypted by tenant key
  plaintext?: Buffer;            // Cached decrypted key (memory only)
  purpose: 'data' | 'artifact' | 'credential';
  createdAt: number;
  expiresAt: number;
}

export class KeyManagementService {
  private kmsClient: KMSClient;
  private hierarchy: KeyHierarchy;
  
  constructor(masterKeyId: string) {
    this.kmsClient = new KMSClient({});
    this.hierarchy = {
      masterKeyId,
      tenantKeys: new Map(),
      dekCache: new LRUCache({ max: 1000, ttl: 300000 })  // 5 min cache
    };
  }
  
  async createTenantKey(tenantId: string): Promise<TenantKey> {
    // Generate random key material
    const keyMaterial = crypto.randomBytes(32);
    
    // Encrypt with master key
    const encryptResponse = await this.kmsClient.send(new EncryptCommand({
      KeyId: this.hierarchy.masterKeyId,
      Plaintext: keyMaterial,
      EncryptionContext: {
        tenant_id: tenantId,
        key_type: 'tenant_key'
      }
    }));
    
    const tenantKey: TenantKey = {
      id: generateId('tk'),
      tenantId,
      encryptedKey: Buffer.from(encryptResponse.CiphertextBlob!).toString('base64'),
      algorithm: 'AES-256-GCM',
      createdAt: Date.now(),
      rotatedAt: Date.now(),
      status: 'active'
    };
    
    // Store in database
    await db.insert(tenantKeys).values(tenantKey);
    
    // Cache
    this.hierarchy.tenantKeys.set(tenantId, tenantKey);
    
    // Audit
    await auditLog({
      action: 'kms.tenant_key.created',
      actor: 'system',
      resource: tenantKey.id,
      tenantId,
      details: { algorithm: tenantKey.algorithm }
    });
    
    // Clear plaintext from memory
    keyMaterial.fill(0);
    
    return tenantKey;
  }
  
  async rotateTenantKey(tenantId: string): Promise<TenantKey> {
    const oldKey = await this.getTenantKey(tenantId);
    
    // Mark old key as rotating
    await db.update(tenantKeys)
      .set({ status: 'rotating' })
      .where(eq(tenantKeys.id, oldKey.id));
    
    // Create new key
    const newKey = await this.createTenantKey(tenantId);
    
    // Re-encrypt all DEKs with new key
    await this.reEncryptDEKs(tenantId, oldKey, newKey);
    
    // Disable old key
    await db.update(tenantKeys)
      .set({ status: 'disabled' })
      .where(eq(tenantKeys.id, oldKey.id));
    
    // Audit
    await auditLog({
      action: 'kms.tenant_key.rotated',
      actor: 'system',
      resource: newKey.id,
      tenantId,
      details: { oldKeyId: oldKey.id }
    });
    
    return newKey;
  }
  
  async generateDEK(tenantId: string, purpose: DEK['purpose']): Promise<DEK> {
    const tenantKey = await this.getTenantKey(tenantId);
    const decryptedTenantKey = await this.decryptTenantKey(tenantKey);
    
    // Generate DEK
    const dekMaterial = crypto.randomBytes(32);
    
    // Encrypt DEK with tenant key
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', decryptedTenantKey, iv);
    let encrypted = cipher.update(dekMaterial);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    const dek: DEK = {
      id: generateId('dek'),
      tenantId,
      encryptedKey: Buffer.concat([iv, authTag, encrypted]).toString('base64'),
      purpose,
      createdAt: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000)  // 24 hours
    };
    
    // Store in database
    await db.insert(dataEncryptionKeys).values(dek);
    
    // Cache with plaintext
    dek.plaintext = dekMaterial;
    this.hierarchy.dekCache.set(dek.id, dek);
    
    // Clear tenant key from memory
    decryptedTenantKey.fill(0);
    
    return dek;
  }
  
  async getDEK(dekId: string): Promise<DEK> {
    // Check cache
    const cached = this.hierarchy.dekCache.get(dekId);
    if (cached?.plaintext) {
      return cached;
    }
    
    // Fetch from database
    const dek = await db.query.dataEncryptionKeys.findFirst({
      where: eq(dataEncryptionKeys.id, dekId)
    });
    
    if (!dek) {
      throw new Error('DEK not found');
    }
    
    // Decrypt
    const tenantKey = await this.getTenantKey(dek.tenantId);
    const decryptedTenantKey = await this.decryptTenantKey(tenantKey);
    
    const encryptedBuffer = Buffer.from(dek.encryptedKey, 'base64');
    const iv = encryptedBuffer.subarray(0, 12);
    const authTag = encryptedBuffer.subarray(12, 28);
    const ciphertext = encryptedBuffer.subarray(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', decryptedTenantKey, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    dek.plaintext = decrypted;
    this.hierarchy.dekCache.set(dekId, dek);
    
    // Clear tenant key from memory
    decryptedTenantKey.fill(0);
    
    return dek;
  }
  
  async cryptoShred(tenantId: string): Promise<void> {
    // Delete tenant key - all data becomes unrecoverable
    const tenantKey = await this.getTenantKey(tenantId);
    
    // Schedule KMS key deletion (7-day waiting period)
    await this.kmsClient.send(new ScheduleKeyDeletionCommand({
      KeyId: tenantKey.id,
      PendingWindowInDays: 7
    }));
    
    // Mark as disabled immediately
    await db.update(tenantKeys)
      .set({ status: 'disabled' })
      .where(eq(tenantKeys.tenantId, tenantId));
    
    // Clear from cache
    this.hierarchy.tenantKeys.delete(tenantId);
    
    // Audit
    await auditLog({
      action: 'kms.crypto_shred.initiated',
      actor: 'system',
      resource: tenantId,
      tenantId,
      details: { keyId: tenantKey.id, pendingDays: 7 }
    });
  }
  
  private async getTenantKey(tenantId: string): Promise<TenantKey> {
    // Check cache
    const cached = this.hierarchy.tenantKeys.get(tenantId);
    if (cached && cached.status === 'active') {
      return cached;
    }
    
    // Fetch from database
    const tenantKey = await db.query.tenantKeys.findFirst({
      where: and(
        eq(tenantKeys.tenantId, tenantId),
        eq(tenantKeys.status, 'active')
      )
    });
    
    if (!tenantKey) {
      throw new Error('Tenant key not found');
    }
    
    this.hierarchy.tenantKeys.set(tenantId, tenantKey);
    return tenantKey;
  }
  
  private async decryptTenantKey(tenantKey: TenantKey): Promise<Buffer> {
    const decryptResponse = await this.kmsClient.send(new DecryptCommand({
      KeyId: this.hierarchy.masterKeyId,
      CiphertextBlob: Buffer.from(tenantKey.encryptedKey, 'base64'),
      EncryptionContext: {
        tenant_id: tenantKey.tenantId,
        key_type: 'tenant_key'
      }
    }));
    
    return Buffer.from(decryptResponse.Plaintext!);
  }
}
```

#### 1.7 Secrets Vault Integration

```typescript
// packages/security/src/vault/client.ts

export interface VaultConfig {
  address: string;
  authMethod: 'kubernetes' | 'approle' | 'token';
  namespace?: string;
  mountPath: string;
}

export interface Secret {
  key: string;
  value: string;
  version: number;
  metadata: {
    createdAt: string;
    updatedAt: string;
    deletedAt?: string;
    customMetadata?: Record<string, string>;
  };
}

export class VaultClient {
  private client: any;  // node-vault client
  private config: VaultConfig;
  private token: string | null = null;
  
  constructor(config: VaultConfig) {
    this.config = config;
  }
  
  async initialize(): Promise<void> {
    const vault = require('node-vault')({
      apiVersion: 'v1',
      endpoint: this.config.address,
      namespace: this.config.namespace
    });
    
    // Authenticate based on method
    switch (this.config.authMethod) {
      case 'kubernetes':
        await this.authenticateKubernetes(vault);
        break;
      case 'approle':
        await this.authenticateAppRole(vault);
        break;
      case 'token':
        this.token = process.env.VAULT_TOKEN!;
        break;
    }
    
    vault.token = this.token;
    this.client = vault;
  }
  
  async getSecret(path: string): Promise<Secret> {
    const fullPath = `${this.config.mountPath}/data/${path}`;
    
    try {
      const response = await this.client.read(fullPath);
      
      return {
        key: path,
        value: response.data.data.value,
        version: response.data.metadata.version,
        metadata: {
          createdAt: response.data.metadata.created_time,
          updatedAt: response.data.metadata.created_time,
          customMetadata: response.data.metadata.custom_metadata
        }
      };
    } catch (error: any) {
      if (error.response?.statusCode === 404) {
        throw new SecretNotFoundError(`Secret not found: ${path}`);
      }
      throw error;
    }
  }
  
  async setSecret(
    path: string,
    value: string,
    metadata?: Record<string, string>
  ): Promise<Secret> {
    const fullPath = `${this.config.mountPath}/data/${path}`;
    
    const response = await this.client.write(fullPath, {
      data: { value },
      options: {
        cas: 0  // Check-and-set for optimistic locking
      }
    });
    
    // Set custom metadata if provided
    if (metadata) {
      await this.client.write(
        `${this.config.mountPath}/metadata/${path}`,
        { custom_metadata: metadata }
      );
    }
    
    return {
      key: path,
      value,
      version: response.data.version,
      metadata: {
        createdAt: response.data.created_time,
        updatedAt: response.data.created_time,
        customMetadata: metadata
      }
    };
  }
  
  async rotateSecret(path: string, newValue: string): Promise<Secret> {
    // Get current version for CAS
    const current = await this.getSecret(path);
    
    const fullPath = `${this.config.mountPath}/data/${path}`;
    
    const response = await this.client.write(fullPath, {
      data: { value: newValue },
      options: {
        cas: current.version  // Only succeed if version matches
      }
    });
    
    // Audit
    await auditLog({
      action: 'vault.secret.rotated',
      actor: 'system',
      resource: path,
      details: {
        oldVersion: current.version,
        newVersion: response.data.version
      }
    });
    
    return {
      key: path,
      value: newValue,
      version: response.data.version,
      metadata: {
        createdAt: current.metadata.createdAt,
        updatedAt: response.data.created_time
      }
    };
  }
  
  async deleteSecret(path: string): Promise<void> {
    const fullPath = `${this.config.mountPath}/data/${path}`;
    
    // Soft delete (can be recovered)
    await this.client.delete(fullPath);
    
    // Audit
    await auditLog({
      action: 'vault.secret.deleted',
      actor: 'system',
      resource: path
    });
  }
  
  async destroySecret(path: string, versions?: number[]): Promise<void> {
    const fullPath = `${this.config.mountPath}/destroy/${path}`;
    
    // Hard delete (permanent)
    await this.client.write(fullPath, {
      versions: versions || [1, 2, 3, 4, 5]  // Destroy all versions
    });
    
    // Audit
    await auditLog({
      action: 'vault.secret.destroyed',
      actor: 'system',
      resource: path,
      details: { versions }
    });
  }
  
  private async authenticateKubernetes(vault: any): Promise<void> {
    const jwt = await fs.readFile(
      '/var/run/secrets/kubernetes.io/serviceaccount/token',
      'utf-8'
    );
    
    const response = await vault.kubernetesLogin({
      role: process.env.VAULT_ROLE!,
      jwt
    });
    
    this.token = response.auth.client_token;
  }
  
  private async authenticateAppRole(vault: any): Promise<void> {
    const response = await vault.approleLogin({
      role_id: process.env.VAULT_ROLE_ID!,
      secret_id: process.env.VAULT_SECRET_ID!
    });
    
    this.token = response.auth.client_token;
  }
}

// Automatic secret rotation
export class SecretRotationScheduler {
  private vault: VaultClient;
  private rotationPolicies: Map<string, RotationPolicy> = new Map();
  
  async scheduleRotation(
    secretPath: string,
    policy: RotationPolicy
  ): Promise<void> {
    this.rotationPolicies.set(secretPath, policy);
    
    // Schedule cron job
    cron.schedule(policy.cronExpression, async () => {
      await this.rotateSecret(secretPath, policy);
    });
  }
  
  private async rotateSecret(
    path: string,
    policy: RotationPolicy
  ): Promise<void> {
    try {
      // Generate new secret value
      const newValue = await policy.generator();
      
      // Rotate in vault
      await this.vault.rotateSecret(path, newValue);
      
      // Notify dependent services
      for (const callback of policy.onRotate) {
        await callback(path, newValue);
      }
      
      // Update metrics
      secretRotationCounter.inc({ path, status: 'success' });
      
    } catch (error) {
      secretRotationCounter.inc({ path, status: 'failure' });
      
      // Alert on failure
      await alertManager.send({
        severity: 'critical',
        summary: `Secret rotation failed: ${path}`,
        description: (error as Error).message
      });
    }
  }
}
```

#### 1.8 Encryption Boundaries

```typescript
// packages/security/src/encryption/boundaries.ts

/**
 * Encryption Boundaries:
 * 
 * 1. At-Rest: All data encrypted in storage
 *    - Database: TDE (Transparent Data Encryption)
 *    - S3: SSE-KMS with customer-managed keys
 *    - Redis: Encrypted at rest
 * 
 * 2. In-Transit: All network traffic encrypted
 *    - External: TLS 1.3 required
 *    - Internal: mTLS between services
 * 
 * 3. In-Use: Sensitive data encrypted in memory
 *    - Secrets: Encrypted until needed
 *    - PII: Field-level encryption
 *    - Credentials: Never logged, masked in UI
 */

export interface EncryptionPolicy {
  atRest: AtRestPolicy;
  inTransit: InTransitPolicy;
  inUse: InUsePolicy;
}

export interface AtRestPolicy {
  database: {
    enabled: true;
    algorithm: 'AES-256';
    keyManagement: 'kms';
  };
  objectStorage: {
    enabled: true;
    algorithm: 'AES-256-GCM';
    keyManagement: 'sse-kms';
    customerManagedKey: true;
  };
  cache: {
    enabled: true;
    algorithm: 'AES-256';
  };
}

export interface InTransitPolicy {
  external: {
    minTlsVersion: '1.3';
    cipherSuites: string[];
    hsts: {
      enabled: true;
      maxAge: 31536000;
      includeSubDomains: true;
      preload: true;
    };
  };
  internal: {
    mtls: true;
    certificateRotation: '24h';
  };
}

export interface InUsePolicy {
  piiFields: string[];
  credentialFields: string[];
  maskingRules: MaskingRule[];
}

export const DEFAULT_ENCRYPTION_POLICY: EncryptionPolicy = {
  atRest: {
    database: {
      enabled: true,
      algorithm: 'AES-256',
      keyManagement: 'kms'
    },
    objectStorage: {
      enabled: true,
      algorithm: 'AES-256-GCM',
      keyManagement: 'sse-kms',
      customerManagedKey: true
    },
    cache: {
      enabled: true,
      algorithm: 'AES-256'
    }
  },
  inTransit: {
    external: {
      minTlsVersion: '1.3',
      cipherSuites: [
        'TLS_AES_256_GCM_SHA384',
        'TLS_CHACHA20_POLY1305_SHA256',
        'TLS_AES_128_GCM_SHA256'
      ],
      hsts: {
        enabled: true,
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true
      }
    },
    internal: {
      mtls: true,
      certificateRotation: '24h'
    }
  },
  inUse: {
    piiFields: [
      'email',
      'phone',
      'address',
      'ssn',
      'date_of_birth',
      'ip_address'
    ],
    credentialFields: [
      'password',
      'api_key',
      'access_token',
      'refresh_token',
      'secret'
    ],
    maskingRules: [
      { field: 'email', pattern: /^(.{2}).*(@.*)$/, replacement: '$1***$2' },
      { field: 'phone', pattern: /^(.{3}).*(.{4})$/, replacement: '$1***$2' },
      { field: 'ssn', pattern: /.*/, replacement: '***-**-****' }
    ]
  }
};

// Field-level encryption for PII
export class FieldEncryption {
  private kms: KeyManagementService;
  
  async encryptField(
    tenantId: string,
    fieldName: string,
    value: string
  ): Promise<EncryptedField> {
    // Get or create DEK for this field type
    const dek = await this.kms.generateDEK(tenantId, 'data');
    
    // Encrypt value
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', dek.plaintext!, iv);
    
    let encrypted = cipher.update(value, 'utf8');
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    const authTag = cipher.getAuthTag();
    
    return {
      ciphertext: Buffer.concat([iv, authTag, encrypted]).toString('base64'),
      dekId: dek.id,
      algorithm: 'AES-256-GCM',
      fieldName
    };
  }
  
  async decryptField(encrypted: EncryptedField): Promise<string> {
    const dek = await this.kms.getDEK(encrypted.dekId);
    
    const buffer = Buffer.from(encrypted.ciphertext, 'base64');
    const iv = buffer.subarray(0, 12);
    const authTag = buffer.subarray(12, 28);
    const ciphertext = buffer.subarray(28);
    
    const decipher = crypto.createDecipheriv('aes-256-gcm', dek.plaintext!, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(ciphertext);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted.toString('utf8');
  }
}

// Data masking for logs and UI
export class DataMasker {
  private policy: InUsePolicy;
  
  constructor(policy: InUsePolicy = DEFAULT_ENCRYPTION_POLICY.inUse) {
    this.policy = policy;
  }
  
  mask(data: any, context: 'log' | 'ui' | 'export'): any {
    if (typeof data !== 'object' || data === null) {
      return data;
    }
    
    const masked = Array.isArray(data) ? [...data] : { ...data };
    
    for (const key of Object.keys(masked)) {
      const lowerKey = key.toLowerCase();
      
      // Check credential fields - always fully mask
      if (this.policy.credentialFields.some(f => lowerKey.includes(f))) {
        masked[key] = '[REDACTED]';
        continue;
      }
      
      // Check PII fields - apply masking rules
      if (this.policy.piiFields.some(f => lowerKey.includes(f))) {
        const rule = this.policy.maskingRules.find(r => 
          lowerKey.includes(r.field)
        );
        
        if (rule && typeof masked[key] === 'string') {
          masked[key] = masked[key].replace(rule.pattern, rule.replacement);
        } else {
          masked[key] = '[PII]';
        }
        continue;
      }
      
      // Recursively mask nested objects
      if (typeof masked[key] === 'object') {
        masked[key] = this.mask(masked[key], context);
      }
    }
    
    return masked;
  }
}
```


### PR-016: Data Isolation and Compliance

#### 1.9 Tenant Isolation Strategy Decision Matrix

| Strategy | Isolation Level | Cost | Complexity | Use Case |
|----------|-----------------|------|------------|----------|
| **Row-Level Security** | Logical | Low | Medium | Default for most tenants |
| **Schema-per-Tenant** | Logical+ | Medium | High | Regulated industries |
| **Database-per-Tenant** | Physical | High | High | Enterprise with compliance |
| **Cluster-per-Tenant** | Full | Very High | Very High | Government/Healthcare |

**Manus Internal Choice:** Row-Level Security as default, Schema-per-Tenant for Enterprise tier, Database-per-Tenant for compliance-heavy customers.

```typescript
// packages/security/src/isolation/strategy.ts

export type IsolationStrategy = 
  | 'row_level_security'
  | 'schema_per_tenant'
  | 'database_per_tenant'
  | 'cluster_per_tenant';

export interface TenantIsolationConfig {
  strategy: IsolationStrategy;
  tenantId: string;
  
  // For schema/database strategies
  schemaName?: string;
  databaseUrl?: string;
  
  // Connection pooling
  maxConnections: number;
  connectionTimeout: number;
}

export class TenantIsolationManager {
  private strategies: Map<string, IsolationStrategy> = new Map();
  private connections: Map<string, DatabaseConnection> = new Map();
  
  async getConnection(tenantId: string): Promise<DatabaseConnection> {
    const strategy = await this.getStrategy(tenantId);
    
    switch (strategy) {
      case 'row_level_security':
        return this.getRLSConnection(tenantId);
      case 'schema_per_tenant':
        return this.getSchemaConnection(tenantId);
      case 'database_per_tenant':
        return this.getDatabaseConnection(tenantId);
      case 'cluster_per_tenant':
        return this.getClusterConnection(tenantId);
    }
  }
  
  private async getRLSConnection(tenantId: string): Promise<DatabaseConnection> {
    // Use shared connection pool with RLS
    const connection = await sharedPool.getConnection();
    
    // Set tenant context for RLS policies
    await connection.query(
      `SET app.current_tenant_id = $1`,
      [tenantId]
    );
    
    return connection;
  }
  
  private async getSchemaConnection(tenantId: string): Promise<DatabaseConnection> {
    const schemaName = `tenant_${tenantId}`;
    const connection = await sharedPool.getConnection();
    
    // Set search path to tenant schema
    await connection.query(
      `SET search_path TO ${schemaName}, public`
    );
    
    return connection;
  }
  
  private async getDatabaseConnection(tenantId: string): Promise<DatabaseConnection> {
    // Check cache
    if (this.connections.has(tenantId)) {
      return this.connections.get(tenantId)!;
    }
    
    // Get tenant-specific database URL
    const config = await this.getTenantConfig(tenantId);
    
    // Create dedicated connection pool
    const pool = new Pool({
      connectionString: config.databaseUrl,
      max: config.maxConnections,
      connectionTimeoutMillis: config.connectionTimeout
    });
    
    this.connections.set(tenantId, pool);
    return pool;
  }
}

// Row-Level Security Policies
export const RLS_POLICIES = `
-- Enable RLS on all tenant tables
ALTER TABLE runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE artifacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;

-- Create tenant isolation policies
CREATE POLICY tenant_isolation_runs ON runs
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_steps ON steps
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM runs 
      WHERE runs.id = steps.run_id 
      AND runs.tenant_id = current_setting('app.current_tenant_id')::uuid
    )
  );

CREATE POLICY tenant_isolation_artifacts ON artifacts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM runs 
      WHERE runs.id = artifacts.run_id 
      AND runs.tenant_id = current_setting('app.current_tenant_id')::uuid
    )
  );

-- Bypass policy for service accounts (with audit)
CREATE POLICY service_account_bypass ON runs
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Create audit trigger for service account access
CREATE OR REPLACE FUNCTION audit_service_access()
RETURNS TRIGGER AS $$
BEGIN
  IF current_user = 'service_role' THEN
    INSERT INTO audit_log (
      action, table_name, record_id, actor, tenant_id, timestamp
    ) VALUES (
      TG_OP, TG_TABLE_NAME, NEW.id, current_user, NEW.tenant_id, NOW()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
`;
```

#### 1.10 Compliance Controls

```typescript
// packages/compliance/src/controls.ts

export interface ComplianceConfig {
  retention: RetentionPolicy;
  deletion: DeletionPolicy;
  legalHold: LegalHoldPolicy;
  dlp: DLPPolicy;
}

export interface RetentionPolicy {
  defaultRetentionDays: number;
  dataClassRetention: Record<DataClass, number>;
  auditLogRetention: number;  // Usually longer
}

export interface DeletionPolicy {
  softDeleteEnabled: boolean;
  hardDeleteDelayDays: number;
  cryptoShredOnDelete: boolean;
  deletionVerification: boolean;
}

export interface LegalHoldPolicy {
  enabled: boolean;
  holdTypes: ('litigation' | 'regulatory' | 'investigation')[];
  notificationRequired: boolean;
}

export interface DLPPolicy {
  enabled: boolean;
  scanInbound: boolean;
  scanOutbound: boolean;
  sensitivePatterns: SensitivePattern[];
  actions: DLPAction[];
}

export type DataClass = 
  | 'public'
  | 'internal'
  | 'confidential'
  | 'restricted'
  | 'pii'
  | 'phi'
  | 'pci';

export const DEFAULT_COMPLIANCE_CONFIG: ComplianceConfig = {
  retention: {
    defaultRetentionDays: 365,
    dataClassRetention: {
      public: 90,
      internal: 365,
      confidential: 730,
      restricted: 2555,  // 7 years
      pii: 365,
      phi: 2555,  // HIPAA requirement
      pci: 365
    },
    auditLogRetention: 2555  // 7 years
  },
  deletion: {
    softDeleteEnabled: true,
    hardDeleteDelayDays: 30,
    cryptoShredOnDelete: true,
    deletionVerification: true
  },
  legalHold: {
    enabled: true,
    holdTypes: ['litigation', 'regulatory', 'investigation'],
    notificationRequired: true
  },
  dlp: {
    enabled: true,
    scanInbound: true,
    scanOutbound: true,
    sensitivePatterns: [],
    actions: ['log', 'alert', 'block']
  }
};

// Retention Manager
export class RetentionManager {
  constructor(private config: RetentionPolicy) {}
  
  async applyRetention(tenantId: string): Promise<RetentionResult> {
    const results: RetentionResult = {
      scanned: 0,
      expired: 0,
      deleted: 0,
      errors: []
    };
    
    // Get all data classes
    for (const [dataClass, retentionDays] of Object.entries(this.config.dataClassRetention)) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
      
      // Find expired records
      const expired = await db.query.dataRecords.findMany({
        where: and(
          eq(dataRecords.tenantId, tenantId),
          eq(dataRecords.dataClass, dataClass),
          lt(dataRecords.createdAt, cutoffDate),
          isNull(dataRecords.legalHoldId)  // Skip records under legal hold
        )
      });
      
      results.scanned += expired.length;
      results.expired += expired.length;
      
      // Mark for deletion
      for (const record of expired) {
        try {
          await this.markForDeletion(record.id);
          results.deleted++;
        } catch (error) {
          results.errors.push({
            recordId: record.id,
            error: (error as Error).message
          });
        }
      }
    }
    
    // Audit
    await auditLog({
      action: 'compliance.retention.applied',
      actor: 'system',
      tenantId,
      details: results
    });
    
    return results;
  }
  
  private async markForDeletion(recordId: string): Promise<void> {
    await db.update(dataRecords)
      .set({
        deletionScheduledAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        status: 'pending_deletion'
      })
      .where(eq(dataRecords.id, recordId));
  }
}

// Legal Hold Manager
export class LegalHoldManager {
  async createHold(params: CreateHoldParams): Promise<LegalHold> {
    const hold: LegalHold = {
      id: generateId('hold'),
      tenantId: params.tenantId,
      type: params.type,
      name: params.name,
      description: params.description,
      custodians: params.custodians,
      scope: params.scope,
      createdBy: params.createdBy,
      createdAt: new Date(),
      status: 'active'
    };
    
    await db.insert(legalHolds).values(hold);
    
    // Apply hold to matching records
    await this.applyHold(hold);
    
    // Notify custodians
    if (params.notifyCustodians) {
      await this.notifyCustodians(hold);
    }
    
    // Audit
    await auditLog({
      action: 'compliance.legal_hold.created',
      actor: params.createdBy,
      resource: hold.id,
      tenantId: params.tenantId,
      details: { type: hold.type, scope: hold.scope }
    });
    
    return hold;
  }
  
  async releaseHold(holdId: string, releasedBy: string): Promise<void> {
    const hold = await db.query.legalHolds.findFirst({
      where: eq(legalHolds.id, holdId)
    });
    
    if (!hold) {
      throw new Error('Legal hold not found');
    }
    
    // Update hold status
    await db.update(legalHolds)
      .set({
        status: 'released',
        releasedBy,
        releasedAt: new Date()
      })
      .where(eq(legalHolds.id, holdId));
    
    // Remove hold from records
    await db.update(dataRecords)
      .set({ legalHoldId: null })
      .where(eq(dataRecords.legalHoldId, holdId));
    
    // Audit
    await auditLog({
      action: 'compliance.legal_hold.released',
      actor: releasedBy,
      resource: holdId,
      tenantId: hold.tenantId
    });
  }
  
  private async applyHold(hold: LegalHold): Promise<void> {
    // Build query based on scope
    const conditions = [eq(dataRecords.tenantId, hold.tenantId)];
    
    if (hold.scope.dateRange) {
      conditions.push(
        gte(dataRecords.createdAt, hold.scope.dateRange.start),
        lte(dataRecords.createdAt, hold.scope.dateRange.end)
      );
    }
    
    if (hold.scope.userIds) {
      conditions.push(inArray(dataRecords.userId, hold.scope.userIds));
    }
    
    if (hold.scope.dataClasses) {
      conditions.push(inArray(dataRecords.dataClass, hold.scope.dataClasses));
    }
    
    // Apply hold
    await db.update(dataRecords)
      .set({ legalHoldId: hold.id })
      .where(and(...conditions));
  }
}

// DLP Scanner
export class DLPScanner {
  private patterns: SensitivePattern[];
  
  constructor(config: DLPPolicy) {
    this.patterns = [
      // Credit card numbers
      {
        name: 'credit_card',
        regex: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
        dataClass: 'pci',
        severity: 'high'
      },
      // SSN
      {
        name: 'ssn',
        regex: /\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g,
        dataClass: 'pii',
        severity: 'high'
      },
      // Email addresses
      {
        name: 'email',
        regex: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
        dataClass: 'pii',
        severity: 'medium'
      },
      // API keys (generic pattern)
      {
        name: 'api_key',
        regex: /\b(sk|pk|api|key|token|secret)[-_]?[a-zA-Z0-9]{20,}\b/gi,
        dataClass: 'restricted',
        severity: 'critical'
      },
      // AWS credentials
      {
        name: 'aws_key',
        regex: /\bAKIA[0-9A-Z]{16}\b/g,
        dataClass: 'restricted',
        severity: 'critical'
      },
      ...config.sensitivePatterns
    ];
  }
  
  async scan(content: string, context: ScanContext): Promise<DLPScanResult> {
    const findings: DLPFinding[] = [];
    
    for (const pattern of this.patterns) {
      const matches = content.matchAll(pattern.regex);
      
      for (const match of matches) {
        findings.push({
          pattern: pattern.name,
          dataClass: pattern.dataClass,
          severity: pattern.severity,
          location: {
            start: match.index!,
            end: match.index! + match[0].length
          },
          snippet: this.maskSnippet(content, match.index!, match[0].length)
        });
      }
    }
    
    const result: DLPScanResult = {
      scanned: true,
      findingsCount: findings.length,
      findings,
      blocked: findings.some(f => f.severity === 'critical'),
      timestamp: Date.now()
    };
    
    // Log findings
    if (findings.length > 0) {
      await auditLog({
        action: 'dlp.scan.findings',
        actor: context.userId,
        tenantId: context.tenantId,
        details: {
          direction: context.direction,
          findingsCount: findings.length,
          severities: findings.map(f => f.severity)
        }
      });
    }
    
    return result;
  }
  
  private maskSnippet(content: string, start: number, length: number): string {
    const contextSize = 20;
    const snippetStart = Math.max(0, start - contextSize);
    const snippetEnd = Math.min(content.length, start + length + contextSize);
    
    let snippet = content.slice(snippetStart, snippetEnd);
    
    // Mask the sensitive part
    const sensitiveStart = start - snippetStart;
    const masked = snippet.slice(0, sensitiveStart) + 
                   '*'.repeat(length) + 
                   snippet.slice(sensitiveStart + length);
    
    return (snippetStart > 0 ? '...' : '') + 
           masked + 
           (snippetEnd < content.length ? '...' : '');
  }
}
```


---

## 2. Sandbox Architecture and Tool Execution

### PR-017: Sandbox Runtime Selection

#### 2.1 Runtime Decision Matrix

| Runtime | Isolation Level | Startup Time | Memory Overhead | Use Case |
|---------|-----------------|--------------|-----------------|----------|
| **gVisor** | Kernel | 100-500ms | 50-100MB | Default for code execution |
| **Firecracker** | Hardware | 125ms | 5MB | High-security workloads |
| **Kata Containers** | Hardware | 1-2s | 100-200MB | Legacy compatibility |
| **WASM (WasmEdge)** | Language | 1-10ms | 1-5MB | Lightweight functions |
| **Docker (runc)** | Namespace | 50-100ms | 10-20MB | Development only |

**Manus Internal Choice:** gVisor (runsc) as default, Firecracker for enterprise tier, WASM for lightweight tool execution.

```typescript
// packages/sandbox/src/runtime/selector.ts

export type SandboxRuntime = 'gvisor' | 'firecracker' | 'kata' | 'wasm' | 'docker';

export interface RuntimeCapabilities {
  networkAccess: boolean;
  filesystemAccess: boolean;
  gpuAccess: boolean;
  maxMemoryMB: number;
  maxCPUCores: number;
  maxDiskGB: number;
  maxDurationSeconds: number;
}

export interface RuntimeSelection {
  runtime: SandboxRuntime;
  reason: string;
  capabilities: RuntimeCapabilities;
}

export class RuntimeSelector {
  private rules: RuntimeSelectionRule[] = [
    // GPU workloads require Firecracker with GPU passthrough
    {
      condition: (req) => req.requiresGPU,
      runtime: 'firecracker',
      reason: 'GPU passthrough required'
    },
    // Enterprise tier gets Firecracker by default
    {
      condition: (req) => req.tier === 'enterprise',
      runtime: 'firecracker',
      reason: 'Enterprise tier hardware isolation'
    },
    // Lightweight functions use WASM
    {
      condition: (req) => req.toolType === 'function' && req.estimatedDuration < 5000,
      runtime: 'wasm',
      reason: 'Lightweight function execution'
    },
    // Code execution uses gVisor
    {
      condition: (req) => req.toolType === 'code_execution',
      runtime: 'gvisor',
      reason: 'Secure code execution'
    },
    // Default to gVisor
    {
      condition: () => true,
      runtime: 'gvisor',
      reason: 'Default runtime'
    }
  ];
  
  select(request: SandboxRequest): RuntimeSelection {
    for (const rule of this.rules) {
      if (rule.condition(request)) {
        return {
          runtime: rule.runtime,
          reason: rule.reason,
          capabilities: this.getCapabilities(rule.runtime, request)
        };
      }
    }
    
    // Should never reach here due to default rule
    throw new Error('No runtime selected');
  }
  
  private getCapabilities(
    runtime: SandboxRuntime,
    request: SandboxRequest
  ): RuntimeCapabilities {
    const baseCapabilities: Record<SandboxRuntime, RuntimeCapabilities> = {
      gvisor: {
        networkAccess: true,
        filesystemAccess: true,
        gpuAccess: false,
        maxMemoryMB: 4096,
        maxCPUCores: 2,
        maxDiskGB: 10,
        maxDurationSeconds: 3600
      },
      firecracker: {
        networkAccess: true,
        filesystemAccess: true,
        gpuAccess: true,
        maxMemoryMB: 16384,
        maxCPUCores: 8,
        maxDiskGB: 100,
        maxDurationSeconds: 7200
      },
      kata: {
        networkAccess: true,
        filesystemAccess: true,
        gpuAccess: true,
        maxMemoryMB: 8192,
        maxCPUCores: 4,
        maxDiskGB: 50,
        maxDurationSeconds: 3600
      },
      wasm: {
        networkAccess: false,
        filesystemAccess: false,
        gpuAccess: false,
        maxMemoryMB: 256,
        maxCPUCores: 1,
        maxDiskGB: 0,
        maxDurationSeconds: 30
      },
      docker: {
        networkAccess: true,
        filesystemAccess: true,
        gpuAccess: false,
        maxMemoryMB: 2048,
        maxCPUCores: 2,
        maxDiskGB: 5,
        maxDurationSeconds: 1800
      }
    };
    
    // Apply tier-based adjustments
    const capabilities = { ...baseCapabilities[runtime] };
    
    if (request.tier === 'enterprise') {
      capabilities.maxMemoryMB *= 2;
      capabilities.maxCPUCores *= 2;
      capabilities.maxDiskGB *= 2;
      capabilities.maxDurationSeconds *= 2;
    }
    
    return capabilities;
  }
}
```

#### 2.2 gVisor Configuration

```typescript
// packages/sandbox/src/runtime/gvisor.ts

export interface GVisorConfig {
  platform: 'ptrace' | 'kvm';
  network: 'sandbox' | 'host' | 'none';
  fileAccess: 'exclusive' | 'shared';
  overlay: boolean;
  debug: boolean;
  strace: boolean;
}

export const GVISOR_CONFIG: GVisorConfig = {
  platform: 'ptrace',  // Use KVM in production for better performance
  network: 'sandbox',
  fileAccess: 'exclusive',
  overlay: true,
  debug: false,
  strace: false
};

// Kubernetes RuntimeClass for gVisor
export const GVISOR_RUNTIME_CLASS = `
apiVersion: node.k8s.io/v1
kind: RuntimeClass
metadata:
  name: gvisor
handler: runsc
scheduling:
  nodeSelector:
    sandbox.manus.im/gvisor: "true"
overhead:
  podFixed:
    memory: "100Mi"
    cpu: "100m"
`;

// Pod spec for gVisor sandbox
export function createGVisorPodSpec(request: SandboxRequest): V1PodSpec {
  return {
    runtimeClassName: 'gvisor',
    automountServiceAccountToken: false,
    enableServiceLinks: false,
    hostNetwork: false,
    hostPID: false,
    hostIPC: false,
    securityContext: {
      runAsNonRoot: true,
      runAsUser: 65534,  // nobody
      runAsGroup: 65534,
      fsGroup: 65534,
      seccompProfile: {
        type: 'RuntimeDefault'
      }
    },
    containers: [{
      name: 'sandbox',
      image: request.image || 'manus/sandbox-base:latest',
      resources: {
        requests: {
          memory: `${request.memoryMB || 512}Mi`,
          cpu: `${(request.cpuCores || 1) * 500}m`
        },
        limits: {
          memory: `${request.memoryMB || 512}Mi`,
          cpu: `${request.cpuCores || 1}`
        }
      },
      securityContext: {
        allowPrivilegeEscalation: false,
        readOnlyRootFilesystem: true,
        capabilities: {
          drop: ['ALL']
        }
      },
      volumeMounts: [
        {
          name: 'workspace',
          mountPath: '/workspace',
          readOnly: false
        },
        {
          name: 'tmp',
          mountPath: '/tmp',
          readOnly: false
        }
      ]
    }],
    volumes: [
      {
        name: 'workspace',
        emptyDir: {
          sizeLimit: `${request.diskGB || 1}Gi`
        }
      },
      {
        name: 'tmp',
        emptyDir: {
          sizeLimit: '100Mi'
        }
      }
    ],
    terminationGracePeriodSeconds: 30,
    activeDeadlineSeconds: request.maxDurationSeconds || 3600
  };
}
```

#### 2.3 Firecracker Configuration

```typescript
// packages/sandbox/src/runtime/firecracker.ts

export interface FirecrackerConfig {
  kernelImagePath: string;
  rootfsPath: string;
  vcpuCount: number;
  memSizeMib: number;
  networkInterfaces: NetworkInterface[];
  drives: Drive[];
  machineConfig: MachineConfig;
}

export interface NetworkInterface {
  ifaceId: string;
  guestMac: string;
  hostDevName: string;
}

export interface Drive {
  driveId: string;
  pathOnHost: string;
  isRootDevice: boolean;
  isReadOnly: boolean;
}

export interface MachineConfig {
  vcpuCount: number;
  memSizeMib: number;
  smt: boolean;  // Simultaneous Multi-Threading
  trackDirtyPages: boolean;
}

export class FirecrackerManager {
  private socketPath: string;
  private process: ChildProcess | null = null;
  
  async createMicroVM(config: FirecrackerConfig): Promise<MicroVM> {
    const vmId = generateId('vm');
    this.socketPath = `/tmp/firecracker-${vmId}.sock`;
    
    // Start Firecracker process
    this.process = spawn('firecracker', [
      '--api-sock', this.socketPath,
      '--config-file', '/dev/null'
    ], {
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Wait for socket to be ready
    await this.waitForSocket();
    
    // Configure boot source
    await this.configureBootSource(config);
    
    // Configure drives
    for (const drive of config.drives) {
      await this.configureDrive(drive);
    }
    
    // Configure network
    for (const iface of config.networkInterfaces) {
      await this.configureNetwork(iface);
    }
    
    // Configure machine
    await this.configureMachine(config.machineConfig);
    
    // Start the VM
    await this.startVM();
    
    return {
      id: vmId,
      socketPath: this.socketPath,
      status: 'running',
      config
    };
  }
  
  private async configureBootSource(config: FirecrackerConfig): Promise<void> {
    await this.apiCall('PUT', '/boot-source', {
      kernel_image_path: config.kernelImagePath,
      boot_args: 'console=ttyS0 reboot=k panic=1 pci=off'
    });
  }
  
  private async configureDrive(drive: Drive): Promise<void> {
    await this.apiCall('PUT', `/drives/${drive.driveId}`, {
      drive_id: drive.driveId,
      path_on_host: drive.pathOnHost,
      is_root_device: drive.isRootDevice,
      is_read_only: drive.isReadOnly
    });
  }
  
  private async configureNetwork(iface: NetworkInterface): Promise<void> {
    await this.apiCall('PUT', `/network-interfaces/${iface.ifaceId}`, {
      iface_id: iface.ifaceId,
      guest_mac: iface.guestMac,
      host_dev_name: iface.hostDevName
    });
  }
  
  private async configureMachine(config: MachineConfig): Promise<void> {
    await this.apiCall('PUT', '/machine-config', {
      vcpu_count: config.vcpuCount,
      mem_size_mib: config.memSizeMib,
      smt: config.smt,
      track_dirty_pages: config.trackDirtyPages
    });
  }
  
  private async startVM(): Promise<void> {
    await this.apiCall('PUT', '/actions', {
      action_type: 'InstanceStart'
    });
  }
  
  async stopVM(): Promise<void> {
    await this.apiCall('PUT', '/actions', {
      action_type: 'SendCtrlAltDel'
    });
    
    // Wait for graceful shutdown
    await sleep(5000);
    
    // Force kill if still running
    if (this.process && !this.process.killed) {
      this.process.kill('SIGKILL');
    }
  }
  
  private async apiCall(method: string, path: string, body?: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const options = {
        socketPath: this.socketPath,
        path,
        method,
        headers: {
          'Content-Type': 'application/json'
        }
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          if (res.statusCode! >= 400) {
            reject(new Error(`Firecracker API error: ${data}`));
          } else {
            resolve(data ? JSON.parse(data) : null);
          }
        });
      });
      
      req.on('error', reject);
      
      if (body) {
        req.write(JSON.stringify(body));
      }
      
      req.end();
    });
  }
}
```

#### 2.4 Network Egress Policy

```typescript
// packages/sandbox/src/network/egress.ts

export interface EgressPolicy {
  defaultAction: 'allow' | 'deny';
  rules: EgressRule[];
}

export interface EgressRule {
  name: string;
  toolTypes: string[];
  action: 'allow' | 'deny';
  destinations: EgressDestination[];
}

export interface EgressDestination {
  type: 'cidr' | 'domain' | 'domain_suffix';
  value: string;
  ports?: number[];
  protocols?: ('tcp' | 'udp')[];
}

// Default egress policies per tool type
export const EGRESS_POLICIES: Record<string, EgressPolicy> = {
  // Wide research - allow HTTP/HTTPS to public internet
  wide_research: {
    defaultAction: 'deny',
    rules: [
      {
        name: 'allow_public_web',
        toolTypes: ['wide_research', 'browser'],
        action: 'allow',
        destinations: [
          { type: 'cidr', value: '0.0.0.0/0', ports: [80, 443], protocols: ['tcp'] }
        ]
      },
      {
        name: 'deny_private_networks',
        toolTypes: ['wide_research', 'browser'],
        action: 'deny',
        destinations: [
          { type: 'cidr', value: '10.0.0.0/8' },
          { type: 'cidr', value: '172.16.0.0/12' },
          { type: 'cidr', value: '192.168.0.0/16' },
          { type: 'cidr', value: '169.254.0.0/16' }
        ]
      }
    ]
  },
  
  // Code execution - restricted network access
  code_execution: {
    defaultAction: 'deny',
    rules: [
      {
        name: 'allow_package_registries',
        toolTypes: ['code_execution'],
        action: 'allow',
        destinations: [
          { type: 'domain', value: 'registry.npmjs.org', ports: [443] },
          { type: 'domain', value: 'pypi.org', ports: [443] },
          { type: 'domain', value: 'files.pythonhosted.org', ports: [443] },
          { type: 'domain_suffix', value: '.githubusercontent.com', ports: [443] }
        ]
      },
      {
        name: 'allow_api_endpoints',
        toolTypes: ['code_execution'],
        action: 'allow',
        destinations: [
          { type: 'domain', value: 'api.openai.com', ports: [443] },
          { type: 'domain', value: 'api.anthropic.com', ports: [443] }
        ]
      }
    ]
  },
  
  // File transforms - no network access
  file_transform: {
    defaultAction: 'deny',
    rules: []
  },
  
  // Connectors - specific API endpoints only
  connector: {
    defaultAction: 'deny',
    rules: [
      {
        name: 'allow_connector_apis',
        toolTypes: ['connector'],
        action: 'allow',
        destinations: [
          // Google
          { type: 'domain_suffix', value: '.googleapis.com', ports: [443] },
          { type: 'domain_suffix', value: '.google.com', ports: [443] },
          // Microsoft
          { type: 'domain_suffix', value: '.microsoft.com', ports: [443] },
          { type: 'domain_suffix', value: '.office.com', ports: [443] },
          // Slack
          { type: 'domain', value: 'slack.com', ports: [443] },
          { type: 'domain_suffix', value: '.slack.com', ports: [443] }
        ]
      }
    ]
  }
};

// Envoy proxy configuration for egress control
export class EgressProxyManager {
  generateEnvoyConfig(policy: EgressPolicy): EnvoyConfig {
    const clusters: EnvoyCluster[] = [];
    const routes: EnvoyRoute[] = [];
    
    for (const rule of policy.rules) {
      if (rule.action === 'allow') {
        for (const dest of rule.destinations) {
          const clusterName = `${rule.name}_${dest.value.replace(/[^a-z0-9]/gi, '_')}`;
          
          clusters.push({
            name: clusterName,
            type: dest.type === 'cidr' ? 'ORIGINAL_DST' : 'STRICT_DNS',
            connectTimeout: '5s',
            lbPolicy: 'ROUND_ROBIN',
            loadAssignment: dest.type !== 'cidr' ? {
              clusterName,
              endpoints: [{
                lbEndpoints: [{
                  endpoint: {
                    address: {
                      socketAddress: {
                        address: dest.value,
                        portValue: dest.ports?.[0] || 443
                      }
                    }
                  }
                }]
              }]
            } : undefined
          });
          
          routes.push({
            match: this.buildMatch(dest),
            route: { cluster: clusterName }
          });
        }
      }
    }
    
    // Add default deny route
    if (policy.defaultAction === 'deny') {
      routes.push({
        match: { prefix: '/' },
        directResponse: {
          status: 403,
          body: { inlineString: 'Egress denied by policy' }
        }
      });
    }
    
    return {
      staticResources: {
        listeners: [{
          name: 'egress_listener',
          address: {
            socketAddress: { address: '0.0.0.0', portValue: 15001 }
          },
          filterChains: [{
            filters: [{
              name: 'envoy.filters.network.http_connection_manager',
              typedConfig: {
                '@type': 'type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager',
                statPrefix: 'egress',
                routeConfig: {
                  name: 'egress_routes',
                  virtualHosts: [{
                    name: 'egress',
                    domains: ['*'],
                    routes
                  }]
                }
              }
            }]
          }]
        }],
        clusters
      }
    };
  }
  
  private buildMatch(dest: EgressDestination): EnvoyRouteMatch {
    switch (dest.type) {
      case 'domain':
        return { headers: [{ name: ':authority', exactMatch: dest.value }] };
      case 'domain_suffix':
        return { headers: [{ name: ':authority', suffixMatch: dest.value }] };
      case 'cidr':
        return { prefix: '/' };  // CIDR matching done at cluster level
    }
  }
}
```

#### 2.5 Filesystem Isolation and Artifact Scanning

```typescript
// packages/sandbox/src/filesystem/isolation.ts

export interface FilesystemPolicy {
  readOnlyPaths: string[];
  writablePaths: string[];
  hiddenPaths: string[];
  maxFileSize: number;
  maxTotalSize: number;
  allowedExtensions?: string[];
  blockedExtensions: string[];
}

export const DEFAULT_FILESYSTEM_POLICY: FilesystemPolicy = {
  readOnlyPaths: [
    '/usr',
    '/lib',
    '/lib64',
    '/bin',
    '/sbin',
    '/etc'
  ],
  writablePaths: [
    '/workspace',
    '/tmp',
    '/home/sandbox'
  ],
  hiddenPaths: [
    '/proc/sys',
    '/sys',
    '/dev',
    '/root',
    '/etc/passwd',
    '/etc/shadow'
  ],
  maxFileSize: 100 * 1024 * 1024,  // 100MB per file
  maxTotalSize: 1024 * 1024 * 1024,  // 1GB total
  blockedExtensions: [
    '.exe', '.dll', '.so', '.dylib',
    '.sh', '.bash', '.zsh',
    '.py', '.rb', '.pl'  // Block in certain contexts
  ]
};

// Artifact scanner for malware and sensitive data
export class ArtifactScanner {
  private clamav: ClamAVClient;
  private dlpScanner: DLPScanner;
  
  async scanArtifact(artifact: Artifact): Promise<ScanResult> {
    const results: ScanResult = {
      artifactId: artifact.id,
      scannedAt: Date.now(),
      malwareDetected: false,
      sensitiveDataDetected: false,
      findings: []
    };
    
    // Malware scan with ClamAV
    const malwareResult = await this.scanForMalware(artifact);
    if (malwareResult.infected) {
      results.malwareDetected = true;
      results.findings.push({
        type: 'malware',
        severity: 'critical',
        details: malwareResult.viruses
      });
    }
    
    // DLP scan for sensitive data
    if (this.isTextFile(artifact.mimeType)) {
      const content = await this.readArtifactContent(artifact);
      const dlpResult = await this.dlpScanner.scan(content, {
        tenantId: artifact.tenantId,
        userId: artifact.userId,
        direction: 'outbound'
      });
      
      if (dlpResult.findingsCount > 0) {
        results.sensitiveDataDetected = true;
        results.findings.push({
          type: 'sensitive_data',
          severity: dlpResult.blocked ? 'critical' : 'warning',
          details: dlpResult.findings
        });
      }
    }
    
    // File type validation
    const typeResult = await this.validateFileType(artifact);
    if (!typeResult.valid) {
      results.findings.push({
        type: 'invalid_file_type',
        severity: 'warning',
        details: typeResult.reason
      });
    }
    
    // Update artifact status
    await this.updateArtifactStatus(artifact.id, results);
    
    return results;
  }
  
  private async scanForMalware(artifact: Artifact): Promise<MalwareScanResult> {
    const stream = await this.getArtifactStream(artifact);
    
    return new Promise((resolve, reject) => {
      this.clamav.scanStream(stream, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            infected: result.isInfected,
            viruses: result.viruses || []
          });
        }
      });
    });
  }
  
  private async validateFileType(artifact: Artifact): Promise<FileTypeValidation> {
    // Read magic bytes
    const buffer = await this.readArtifactHead(artifact, 8192);
    const detected = await fileType.fromBuffer(buffer);
    
    // Check if detected type matches claimed type
    if (detected && detected.mime !== artifact.mimeType) {
      return {
        valid: false,
        reason: `MIME type mismatch: claimed ${artifact.mimeType}, detected ${detected.mime}`
      };
    }
    
    // Check for blocked extensions
    const ext = path.extname(artifact.filename).toLowerCase();
    if (DEFAULT_FILESYSTEM_POLICY.blockedExtensions.includes(ext)) {
      return {
        valid: false,
        reason: `Blocked file extension: ${ext}`
      };
    }
    
    return { valid: true };
  }
}
```

#### 2.6 Resource Quotas and Timeouts

```typescript
// packages/sandbox/src/resources/quotas.ts

export interface ResourceQuota {
  cpu: CPUQuota;
  memory: MemoryQuota;
  disk: DiskQuota;
  network: NetworkQuota;
  time: TimeQuota;
}

export interface CPUQuota {
  cores: number;
  shares: number;  // Relative weight
  periodUs: number;
  quotaUs: number;
}

export interface MemoryQuota {
  limitMB: number;
  swapLimitMB: number;
  oomKillDisable: boolean;
}

export interface DiskQuota {
  limitGB: number;
  iopsRead: number;
  iopsWrite: number;
  bpsRead: number;
  bpsWrite: number;
}

export interface NetworkQuota {
  bandwidthMbps: number;
  connectionsLimit: number;
  packetsPerSecond: number;
}

export interface TimeQuota {
  maxDurationSeconds: number;
  gracePeriodSeconds: number;
  checkpointIntervalSeconds: number;
}

// Quota presets by tier
export const QUOTA_PRESETS: Record<string, ResourceQuota> = {
  free: {
    cpu: { cores: 1, shares: 512, periodUs: 100000, quotaUs: 50000 },
    memory: { limitMB: 512, swapLimitMB: 0, oomKillDisable: false },
    disk: { limitGB: 1, iopsRead: 100, iopsWrite: 50, bpsRead: 10485760, bpsWrite: 5242880 },
    network: { bandwidthMbps: 10, connectionsLimit: 100, packetsPerSecond: 1000 },
    time: { maxDurationSeconds: 300, gracePeriodSeconds: 30, checkpointIntervalSeconds: 60 }
  },
  pro: {
    cpu: { cores: 2, shares: 1024, periodUs: 100000, quotaUs: 100000 },
    memory: { limitMB: 2048, swapLimitMB: 0, oomKillDisable: false },
    disk: { limitGB: 5, iopsRead: 500, iopsWrite: 250, bpsRead: 52428800, bpsWrite: 26214400 },
    network: { bandwidthMbps: 50, connectionsLimit: 500, packetsPerSecond: 5000 },
    time: { maxDurationSeconds: 1800, gracePeriodSeconds: 60, checkpointIntervalSeconds: 120 }
  },
  enterprise: {
    cpu: { cores: 4, shares: 2048, periodUs: 100000, quotaUs: 200000 },
    memory: { limitMB: 8192, swapLimitMB: 0, oomKillDisable: false },
    disk: { limitGB: 20, iopsRead: 2000, iopsWrite: 1000, bpsRead: 104857600, bpsWrite: 52428800 },
    network: { bandwidthMbps: 100, connectionsLimit: 2000, packetsPerSecond: 20000 },
    time: { maxDurationSeconds: 7200, gracePeriodSeconds: 120, checkpointIntervalSeconds: 300 }
  }
};

// Timeout enforcement
export class TimeoutEnforcer {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private checkpoints: Map<string, number> = new Map();
  
  async startEnforcement(
    sandboxId: string,
    quota: TimeQuota,
    callbacks: TimeoutCallbacks
  ): Promise<void> {
    // Set hard timeout
    const hardTimer = setTimeout(async () => {
      await callbacks.onHardTimeout(sandboxId);
    }, (quota.maxDurationSeconds + quota.gracePeriodSeconds) * 1000);
    
    // Set soft timeout (warning)
    const softTimer = setTimeout(async () => {
      await callbacks.onSoftTimeout(sandboxId);
    }, quota.maxDurationSeconds * 1000);
    
    // Set checkpoint timer
    const checkpointTimer = setInterval(async () => {
      await callbacks.onCheckpoint(sandboxId);
      this.checkpoints.set(sandboxId, Date.now());
    }, quota.checkpointIntervalSeconds * 1000);
    
    this.timers.set(`${sandboxId}:hard`, hardTimer);
    this.timers.set(`${sandboxId}:soft`, softTimer);
    this.timers.set(`${sandboxId}:checkpoint`, checkpointTimer);
  }
  
  async stopEnforcement(sandboxId: string): Promise<void> {
    for (const suffix of ['hard', 'soft', 'checkpoint']) {
      const timer = this.timers.get(`${sandboxId}:${suffix}`);
      if (timer) {
        clearTimeout(timer);
        clearInterval(timer);
        this.timers.delete(`${sandboxId}:${suffix}`);
      }
    }
    this.checkpoints.delete(sandboxId);
  }
  
  getLastCheckpoint(sandboxId: string): number | undefined {
    return this.checkpoints.get(sandboxId);
  }
}

export interface TimeoutCallbacks {
  onSoftTimeout: (sandboxId: string) => Promise<void>;
  onHardTimeout: (sandboxId: string) => Promise<void>;
  onCheckpoint: (sandboxId: string) => Promise<void>;
}
```


---

## 3. Queue Semantics and Worker Topology

### PR-018: Job Processing Guarantees

#### 3.1 Exactly-Once vs At-Least-Once by Job Type

| Job Type | Guarantee | Reason | Dedup Strategy |
|----------|-----------|--------|----------------|
| **run.execute** | Exactly-once | Billing, side effects | Idempotency key + result cache |
| **step.execute** | At-least-once | Retryable, idempotent | Step ID dedup |
| **artifact.process** | At-least-once | Idempotent transforms | Content hash |
| **notification.send** | At-most-once | User preference | Message ID dedup |
| **billing.charge** | Exactly-once | Financial | Transaction ID |
| **audit.log** | At-least-once | Compliance | Event ID dedup |

```typescript
// packages/queue/src/semantics/guarantees.ts

export type DeliveryGuarantee = 'exactly_once' | 'at_least_once' | 'at_most_once';

export interface JobTypeConfig {
  type: string;
  guarantee: DeliveryGuarantee;
  dedupStrategy: DedupStrategy;
  maxRetries: number;
  retryBackoff: BackoffConfig;
  timeout: number;
  priority: number;
}

export const JOB_TYPE_CONFIGS: Record<string, JobTypeConfig> = {
  'run.execute': {
    type: 'run.execute',
    guarantee: 'exactly_once',
    dedupStrategy: {
      type: 'idempotency_key',
      keyField: 'idempotencyKey',
      ttlSeconds: 86400 * 7  // 7 days
    },
    maxRetries: 3,
    retryBackoff: { type: 'exponential', initialMs: 1000, maxMs: 60000, factor: 2 },
    timeout: 3600000,  // 1 hour
    priority: 100
  },
  'step.execute': {
    type: 'step.execute',
    guarantee: 'at_least_once',
    dedupStrategy: {
      type: 'composite_key',
      keyFields: ['runId', 'stepId', 'attempt'],
      ttlSeconds: 3600
    },
    maxRetries: 5,
    retryBackoff: { type: 'exponential', initialMs: 500, maxMs: 30000, factor: 2 },
    timeout: 300000,  // 5 minutes
    priority: 80
  },
  'artifact.process': {
    type: 'artifact.process',
    guarantee: 'at_least_once',
    dedupStrategy: {
      type: 'content_hash',
      hashField: 'contentHash',
      ttlSeconds: 3600
    },
    maxRetries: 3,
    retryBackoff: { type: 'linear', initialMs: 1000, incrementMs: 1000 },
    timeout: 60000,  // 1 minute
    priority: 60
  },
  'notification.send': {
    type: 'notification.send',
    guarantee: 'at_most_once',
    dedupStrategy: {
      type: 'message_id',
      keyField: 'messageId',
      ttlSeconds: 300
    },
    maxRetries: 0,  // No retries for at-most-once
    retryBackoff: { type: 'none' },
    timeout: 10000,
    priority: 40
  },
  'billing.charge': {
    type: 'billing.charge',
    guarantee: 'exactly_once',
    dedupStrategy: {
      type: 'transaction_id',
      keyField: 'transactionId',
      ttlSeconds: 86400 * 30  // 30 days
    },
    maxRetries: 10,
    retryBackoff: { type: 'exponential', initialMs: 5000, maxMs: 300000, factor: 2 },
    timeout: 30000,
    priority: 120  // Highest priority
  }
};

// Exactly-once executor with result caching
export class ExactlyOnceExecutor {
  constructor(
    private dedupStore: DedupStore,
    private resultCache: ResultCache
  ) {}
  
  async execute<T>(
    job: Job,
    handler: () => Promise<T>
  ): Promise<ExecutionResult<T>> {
    const config = JOB_TYPE_CONFIGS[job.type];
    const dedupKey = this.buildDedupKey(job, config.dedupStrategy);
    
    // Check for existing result (idempotency)
    const existingResult = await this.resultCache.get(dedupKey);
    if (existingResult) {
      return {
        status: 'deduplicated',
        result: existingResult.value as T,
        originalExecutionId: existingResult.executionId
      };
    }
    
    // Try to acquire execution lock
    const lockAcquired = await this.dedupStore.acquireLock(dedupKey, {
      ttlMs: config.timeout,
      executionId: job.id
    });
    
    if (!lockAcquired) {
      // Another execution in progress - wait for result
      const result = await this.waitForResult(dedupKey, config.timeout);
      return {
        status: 'waited',
        result: result as T
      };
    }
    
    try {
      // Execute handler
      const result = await handler();
      
      // Cache result
      await this.resultCache.set(dedupKey, {
        value: result,
        executionId: job.id,
        timestamp: Date.now()
      }, config.dedupStrategy.ttlSeconds);
      
      // Release lock
      await this.dedupStore.releaseLock(dedupKey, job.id);
      
      return {
        status: 'executed',
        result
      };
      
    } catch (error) {
      // Release lock on failure (allow retry)
      await this.dedupStore.releaseLock(dedupKey, job.id);
      throw error;
    }
  }
  
  private buildDedupKey(job: Job, strategy: DedupStrategy): string {
    switch (strategy.type) {
      case 'idempotency_key':
        return `dedup:${job.type}:${job.data[strategy.keyField]}`;
        
      case 'composite_key':
        const parts = strategy.keyFields.map(f => job.data[f]);
        return `dedup:${job.type}:${parts.join(':')}`;
        
      case 'content_hash':
        return `dedup:${job.type}:${job.data[strategy.hashField]}`;
        
      case 'transaction_id':
      case 'message_id':
        return `dedup:${job.type}:${job.data[strategy.keyField]}`;
        
      default:
        return `dedup:${job.type}:${job.id}`;
    }
  }
  
  private async waitForResult(dedupKey: string, timeoutMs: number): Promise<any> {
    const startTime = Date.now();
    const pollInterval = 100;
    
    while (Date.now() - startTime < timeoutMs) {
      const result = await this.resultCache.get(dedupKey);
      if (result) {
        return result.value;
      }
      await sleep(pollInterval);
    }
    
    throw new Error('Timeout waiting for deduplicated result');
  }
}
```

#### 3.2 Replay Strategy

```typescript
// packages/queue/src/replay/strategy.ts

export interface ReplayConfig {
  enabled: boolean;
  maxReplayAge: number;  // Max age of jobs to replay
  replayBatchSize: number;
  replayInterval: number;
  excludeJobTypes: string[];
}

export interface ReplayRequest {
  jobId?: string;
  jobType?: string;
  timeRange?: { start: Date; end: Date };
  filter?: Record<string, any>;
  dryRun: boolean;
}

export class ReplayManager {
  constructor(
    private jobStore: JobStore,
    private queue: Queue,
    private config: ReplayConfig
  ) {}
  
  async replay(request: ReplayRequest): Promise<ReplayResult> {
    // Validate replay request
    this.validateRequest(request);
    
    // Find jobs to replay
    const jobs = await this.findJobsToReplay(request);
    
    if (request.dryRun) {
      return {
        dryRun: true,
        jobCount: jobs.length,
        jobs: jobs.map(j => ({ id: j.id, type: j.type, createdAt: j.createdAt }))
      };
    }
    
    const results: ReplayJobResult[] = [];
    
    for (const job of jobs) {
      try {
        // Check if job type allows replay
        if (this.config.excludeJobTypes.includes(job.type)) {
          results.push({
            jobId: job.id,
            status: 'skipped',
            reason: 'Job type excluded from replay'
          });
          continue;
        }
        
        // Check job age
        const jobAge = Date.now() - job.createdAt.getTime();
        if (jobAge > this.config.maxReplayAge) {
          results.push({
            jobId: job.id,
            status: 'skipped',
            reason: 'Job too old for replay'
          });
          continue;
        }
        
        // Create replay job with new idempotency key
        const replayJob = {
          ...job,
          id: generateId('job'),
          data: {
            ...job.data,
            _replay: {
              originalJobId: job.id,
              replayedAt: Date.now(),
              replayReason: request.reason
            }
          },
          // Force new idempotency key to allow re-execution
          idempotencyKey: `replay:${job.id}:${Date.now()}`
        };
        
        await this.queue.add(replayJob);
        
        results.push({
          jobId: job.id,
          status: 'replayed',
          newJobId: replayJob.id
        });
        
      } catch (error) {
        results.push({
          jobId: job.id,
          status: 'failed',
          error: (error as Error).message
        });
      }
    }
    
    // Audit log
    await auditLog({
      action: 'queue.replay.executed',
      actor: request.requestedBy,
      details: {
        request,
        results: {
          total: jobs.length,
          replayed: results.filter(r => r.status === 'replayed').length,
          skipped: results.filter(r => r.status === 'skipped').length,
          failed: results.filter(r => r.status === 'failed').length
        }
      }
    });
    
    return {
      dryRun: false,
      jobCount: jobs.length,
      results
    };
  }
  
  private async findJobsToReplay(request: ReplayRequest): Promise<Job[]> {
    const conditions: any[] = [];
    
    if (request.jobId) {
      conditions.push(eq(jobs.id, request.jobId));
    }
    
    if (request.jobType) {
      conditions.push(eq(jobs.type, request.jobType));
    }
    
    if (request.timeRange) {
      conditions.push(
        gte(jobs.createdAt, request.timeRange.start),
        lte(jobs.createdAt, request.timeRange.end)
      );
    }
    
    // Only replay failed or stuck jobs by default
    conditions.push(
      inArray(jobs.status, ['failed', 'stuck', 'timeout'])
    );
    
    return db.query.jobs.findMany({
      where: and(...conditions),
      limit: this.config.replayBatchSize,
      orderBy: [asc(jobs.createdAt)]
    });
  }
}
```

#### 3.3 Backpressure and Fairness Scheduling

```typescript
// packages/queue/src/scheduling/fairness.ts

export interface FairnessConfig {
  globalConcurrency: number;
  perTenantConcurrency: number;
  perRunConcurrency: number;
  priorityLevels: PriorityLevel[];
  starvationThreshold: number;  // Max wait time before priority boost
}

export interface PriorityLevel {
  name: string;
  weight: number;
  maxConcurrency: number;
  tiers: string[];  // Which subscription tiers get this priority
}

export const DEFAULT_FAIRNESS_CONFIG: FairnessConfig = {
  globalConcurrency: 1000,
  perTenantConcurrency: 50,
  perRunConcurrency: 10,
  priorityLevels: [
    { name: 'critical', weight: 100, maxConcurrency: 100, tiers: ['enterprise'] },
    { name: 'high', weight: 50, maxConcurrency: 300, tiers: ['enterprise', 'pro'] },
    { name: 'normal', weight: 20, maxConcurrency: 400, tiers: ['enterprise', 'pro', 'free'] },
    { name: 'low', weight: 5, maxConcurrency: 200, tiers: ['free'] }
  ],
  starvationThreshold: 60000  // 1 minute
};

// Weighted Fair Queuing implementation
export class WeightedFairScheduler {
  private config: FairnessConfig;
  private tenantCounters: Map<string, TenantCounter> = new Map();
  private priorityQueues: Map<string, PriorityQueue<Job>> = new Map();
  
  constructor(config: FairnessConfig = DEFAULT_FAIRNESS_CONFIG) {
    this.config = config;
    
    // Initialize priority queues
    for (const level of config.priorityLevels) {
      this.priorityQueues.set(level.name, new PriorityQueue());
    }
  }
  
  async enqueue(job: Job): Promise<void> {
    const priority = this.determinePriority(job);
    const queue = this.priorityQueues.get(priority.name)!;
    
    queue.push(job, {
      priority: priority.weight,
      enqueuedAt: Date.now()
    });
    
    // Update metrics
    queueSizeGauge.set({ priority: priority.name }, queue.size());
  }
  
  async dequeue(): Promise<Job | null> {
    // Check global concurrency
    const globalActive = await this.getGlobalActiveCount();
    if (globalActive >= this.config.globalConcurrency) {
      return null;  // Backpressure
    }
    
    // Weighted selection across priority levels
    const selectedQueue = this.selectQueueByWeight();
    if (!selectedQueue) {
      return null;  // All queues empty
    }
    
    // Find eligible job (respects tenant and run limits)
    const job = await this.findEligibleJob(selectedQueue);
    if (!job) {
      return null;
    }
    
    // Check for starvation and boost if needed
    await this.checkAndBoostStarvedJobs();
    
    return job;
  }
  
  private determinePriority(job: Job): PriorityLevel {
    const tier = job.data.tier || 'free';
    
    // Find highest priority level available for this tier
    for (const level of this.config.priorityLevels) {
      if (level.tiers.includes(tier)) {
        return level;
      }
    }
    
    // Default to lowest priority
    return this.config.priorityLevels[this.config.priorityLevels.length - 1];
  }
  
  private selectQueueByWeight(): PriorityQueue<Job> | null {
    // Calculate total weight of non-empty queues
    let totalWeight = 0;
    const nonEmptyQueues: Array<{ queue: PriorityQueue<Job>; level: PriorityLevel }> = [];
    
    for (const level of this.config.priorityLevels) {
      const queue = this.priorityQueues.get(level.name)!;
      if (queue.size() > 0) {
        totalWeight += level.weight;
        nonEmptyQueues.push({ queue, level });
      }
    }
    
    if (totalWeight === 0) {
      return null;
    }
    
    // Weighted random selection
    let random = Math.random() * totalWeight;
    for (const { queue, level } of nonEmptyQueues) {
      random -= level.weight;
      if (random <= 0) {
        return queue;
      }
    }
    
    return nonEmptyQueues[0]?.queue || null;
  }
  
  private async findEligibleJob(queue: PriorityQueue<Job>): Promise<Job | null> {
    const candidates = queue.peekMany(100);  // Check top 100 jobs
    
    for (const job of candidates) {
      // Check tenant concurrency
      const tenantActive = await this.getTenantActiveCount(job.tenantId);
      if (tenantActive >= this.config.perTenantConcurrency) {
        continue;  // Skip, tenant at limit
      }
      
      // Check run concurrency
      const runActive = await this.getRunActiveCount(job.data.runId);
      if (runActive >= this.config.perRunConcurrency) {
        continue;  // Skip, run at limit
      }
      
      // Job is eligible
      queue.remove(job.id);
      await this.incrementCounters(job);
      return job;
    }
    
    return null;  // No eligible jobs
  }
  
  private async checkAndBoostStarvedJobs(): Promise<void> {
    const now = Date.now();
    
    // Check lower priority queues for starved jobs
    for (let i = this.config.priorityLevels.length - 1; i > 0; i--) {
      const level = this.config.priorityLevels[i];
      const queue = this.priorityQueues.get(level.name)!;
      
      const starvedJobs = queue.filter(job => 
        now - job.enqueuedAt > this.config.starvationThreshold
      );
      
      for (const job of starvedJobs) {
        // Boost to next higher priority
        const higherLevel = this.config.priorityLevels[i - 1];
        queue.remove(job.id);
        
        const higherQueue = this.priorityQueues.get(higherLevel.name)!;
        higherQueue.push(job, {
          priority: higherLevel.weight,
          enqueuedAt: job.enqueuedAt,  // Keep original enqueue time
          boosted: true
        });
        
        // Metrics
        starvationBoostCounter.inc({ from: level.name, to: higherLevel.name });
      }
    }
  }
  
  // Backpressure signal
  async getBackpressureStatus(): Promise<BackpressureStatus> {
    const globalActive = await this.getGlobalActiveCount();
    const globalUtilization = globalActive / this.config.globalConcurrency;
    
    return {
      shouldBackoff: globalUtilization > 0.9,
      utilization: globalUtilization,
      queueDepths: Object.fromEntries(
        Array.from(this.priorityQueues.entries()).map(([name, queue]) => [name, queue.size()])
      ),
      recommendation: globalUtilization > 0.95 
        ? 'reject_new_jobs'
        : globalUtilization > 0.8
        ? 'delay_low_priority'
        : 'accept_all'
    };
  }
}
```

#### 3.4 Multi-Region Job Routing

```typescript
// packages/queue/src/routing/multiregion.ts

export interface RegionConfig {
  id: string;
  name: string;
  endpoint: string;
  weight: number;
  capabilities: string[];
  dataResidency: string[];  // Countries/regions for data residency
}

export const REGIONS: RegionConfig[] = [
  {
    id: 'eu-west-1',
    name: 'Europe (Ireland)',
    endpoint: 'https://eu-west-1.queue.manus.im',
    weight: 100,
    capabilities: ['gpu', 'high_memory'],
    dataResidency: ['EU', 'CH', 'UK']
  },
  {
    id: 'us-east-1',
    name: 'US East (Virginia)',
    endpoint: 'https://us-east-1.queue.manus.im',
    weight: 100,
    capabilities: ['gpu', 'high_memory', 'ml_inference'],
    dataResidency: ['US', 'CA']
  },
  {
    id: 'ap-southeast-1',
    name: 'Asia Pacific (Singapore)',
    endpoint: 'https://ap-southeast-1.queue.manus.im',
    weight: 80,
    capabilities: ['gpu'],
    dataResidency: ['SG', 'AU', 'JP']
  }
];

export class MultiRegionRouter {
  private regions: RegionConfig[];
  private healthChecker: RegionHealthChecker;
  
  constructor(regions: RegionConfig[] = REGIONS) {
    this.regions = regions;
    this.healthChecker = new RegionHealthChecker(regions);
  }
  
  async route(job: Job): Promise<RoutingDecision> {
    // 1. Filter by data residency requirements
    let candidates = this.filterByDataResidency(job);
    
    // 2. Filter by capability requirements
    candidates = this.filterByCapabilities(job, candidates);
    
    // 3. Filter by health status
    candidates = await this.filterByHealth(candidates);
    
    if (candidates.length === 0) {
      throw new NoAvailableRegionError('No healthy region available for job');
    }
    
    // 4. Select by latency (prefer closest to user)
    const userRegion = job.data.userRegion;
    if (userRegion) {
      const closest = this.findClosestRegion(userRegion, candidates);
      if (closest) {
        return {
          region: closest,
          reason: 'closest_to_user',
          alternatives: candidates.filter(r => r.id !== closest.id)
        };
      }
    }
    
    // 5. Weighted random selection
    const selected = this.weightedSelect(candidates);
    
    return {
      region: selected,
      reason: 'weighted_selection',
      alternatives: candidates.filter(r => r.id !== selected.id)
    };
  }
  
  private filterByDataResidency(job: Job): RegionConfig[] {
    const requiredResidency = job.data.dataResidency;
    
    if (!requiredResidency) {
      return this.regions;  // No restriction
    }
    
    return this.regions.filter(region =>
      region.dataResidency.includes(requiredResidency)
    );
  }
  
  private filterByCapabilities(job: Job, candidates: RegionConfig[]): RegionConfig[] {
    const requiredCapabilities = job.data.requiredCapabilities || [];
    
    if (requiredCapabilities.length === 0) {
      return candidates;
    }
    
    return candidates.filter(region =>
      requiredCapabilities.every(cap => region.capabilities.includes(cap))
    );
  }
  
  private async filterByHealth(candidates: RegionConfig[]): Promise<RegionConfig[]> {
    const healthyRegions: RegionConfig[] = [];
    
    for (const region of candidates) {
      const health = await this.healthChecker.check(region.id);
      if (health.status === 'healthy' || health.status === 'degraded') {
        healthyRegions.push(region);
      }
    }
    
    return healthyRegions;
  }
  
  private findClosestRegion(
    userRegion: string,
    candidates: RegionConfig[]
  ): RegionConfig | null {
    // Simple mapping of user regions to closest data centers
    const regionMapping: Record<string, string[]> = {
      'EU': ['eu-west-1', 'us-east-1', 'ap-southeast-1'],
      'US': ['us-east-1', 'eu-west-1', 'ap-southeast-1'],
      'APAC': ['ap-southeast-1', 'us-east-1', 'eu-west-1']
    };
    
    const preferredOrder = regionMapping[userRegion] || [];
    
    for (const regionId of preferredOrder) {
      const region = candidates.find(r => r.id === regionId);
      if (region) {
        return region;
      }
    }
    
    return null;
  }
  
  private weightedSelect(candidates: RegionConfig[]): RegionConfig {
    const totalWeight = candidates.reduce((sum, r) => sum + r.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const region of candidates) {
      random -= region.weight;
      if (random <= 0) {
        return region;
      }
    }
    
    return candidates[0];
  }
}

// Cross-region job migration
export class JobMigrator {
  async migrate(jobId: string, fromRegion: string, toRegion: string): Promise<void> {
    // 1. Pause job in source region
    const sourceClient = this.getRegionClient(fromRegion);
    await sourceClient.pauseJob(jobId);
    
    // 2. Export job state
    const jobState = await sourceClient.exportJobState(jobId);
    
    // 3. Import to destination region
    const destClient = this.getRegionClient(toRegion);
    await destClient.importJobState(jobState);
    
    // 4. Resume in destination
    await destClient.resumeJob(jobId);
    
    // 5. Clean up source
    await sourceClient.deleteJob(jobId);
    
    // Audit
    await auditLog({
      action: 'queue.job.migrated',
      resource: jobId,
      details: { fromRegion, toRegion }
    });
  }
}
```


---

## 4. Multimodal Pipeline Details

### PR-019: Video Processing Pipeline

#### 4.1 Video Ingestion and Transcoding

```typescript
// packages/media/src/video/pipeline.ts

export interface VideoIngestionConfig {
  maxFileSizeMB: number;
  maxDurationSeconds: number;
  supportedFormats: string[];
  transcodingPresets: TranscodingPreset[];
  thumbnailConfig: ThumbnailConfig;
}

export interface TranscodingPreset {
  name: string;
  resolution: { width: number; height: number };
  bitrate: number;
  codec: 'h264' | 'h265' | 'vp9' | 'av1';
  container: 'mp4' | 'webm' | 'hls';
  audioCodec: 'aac' | 'opus';
  audioBitrate: number;
}

export const DEFAULT_VIDEO_CONFIG: VideoIngestionConfig = {
  maxFileSizeMB: 500,
  maxDurationSeconds: 3600,  // 1 hour
  supportedFormats: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv'],
  transcodingPresets: [
    {
      name: '1080p',
      resolution: { width: 1920, height: 1080 },
      bitrate: 5000000,
      codec: 'h264',
      container: 'mp4',
      audioCodec: 'aac',
      audioBitrate: 128000
    },
    {
      name: '720p',
      resolution: { width: 1280, height: 720 },
      bitrate: 2500000,
      codec: 'h264',
      container: 'mp4',
      audioCodec: 'aac',
      audioBitrate: 128000
    },
    {
      name: '480p',
      resolution: { width: 854, height: 480 },
      bitrate: 1000000,
      codec: 'h264',
      container: 'mp4',
      audioCodec: 'aac',
      audioBitrate: 96000
    },
    {
      name: 'hls_adaptive',
      resolution: { width: 0, height: 0 },  // Multiple resolutions
      bitrate: 0,
      codec: 'h264',
      container: 'hls',
      audioCodec: 'aac',
      audioBitrate: 128000
    }
  ],
  thumbnailConfig: {
    count: 10,
    width: 320,
    height: 180,
    format: 'jpg'
  }
};

export class VideoIngestionPipeline {
  private ffmpeg: FFmpegWrapper;
  private storage: StorageClient;
  private config: VideoIngestionConfig;
  
  async ingest(input: VideoIngestionInput): Promise<VideoIngestionResult> {
    const jobId = generateId('video');
    
    // 1. Validate input
    await this.validateInput(input);
    
    // 2. Download to temp storage
    const tempPath = await this.downloadToTemp(input.sourceUrl, jobId);
    
    // 3. Probe video metadata
    const metadata = await this.probeMetadata(tempPath);
    
    // 4. Check duration and size limits
    this.validateMetadata(metadata);
    
    // 5. Extract audio for transcription
    const audioPath = await this.extractAudio(tempPath, jobId);
    
    // 6. Transcode to all presets (parallel)
    const transcodedVersions = await Promise.all(
      this.config.transcodingPresets.map(preset =>
        this.transcode(tempPath, preset, jobId)
      )
    );
    
    // 7. Generate thumbnails
    const thumbnails = await this.generateThumbnails(tempPath, jobId);
    
    // 8. Upload all outputs to storage
    const outputs = await this.uploadOutputs(jobId, {
      versions: transcodedVersions,
      thumbnails,
      audioPath
    });
    
    // 9. Clean up temp files
    await this.cleanup(jobId);
    
    return {
      jobId,
      status: 'completed',
      metadata,
      outputs
    };
  }
  
  private async probeMetadata(path: string): Promise<VideoMetadata> {
    const probe = await this.ffmpeg.probe(path);
    
    const videoStream = probe.streams.find(s => s.codec_type === 'video');
    const audioStream = probe.streams.find(s => s.codec_type === 'audio');
    
    return {
      duration: parseFloat(probe.format.duration),
      width: videoStream?.width || 0,
      height: videoStream?.height || 0,
      frameRate: eval(videoStream?.r_frame_rate || '0'),
      bitrate: parseInt(probe.format.bit_rate) || 0,
      codec: videoStream?.codec_name || 'unknown',
      hasAudio: !!audioStream,
      audioCodec: audioStream?.codec_name,
      audioChannels: audioStream?.channels,
      audioSampleRate: audioStream?.sample_rate
    };
  }
  
  private async transcode(
    inputPath: string,
    preset: TranscodingPreset,
    jobId: string
  ): Promise<TranscodedVersion> {
    const outputPath = `/tmp/${jobId}/${preset.name}.${preset.container === 'hls' ? 'm3u8' : preset.container}`;
    
    const args = this.buildFFmpegArgs(inputPath, outputPath, preset);
    
    await this.ffmpeg.run(args, {
      onProgress: (progress) => {
        this.emitProgress(jobId, preset.name, progress);
      }
    });
    
    return {
      preset: preset.name,
      path: outputPath,
      resolution: preset.resolution,
      bitrate: preset.bitrate
    };
  }
  
  private buildFFmpegArgs(
    input: string,
    output: string,
    preset: TranscodingPreset
  ): string[] {
    const args = ['-i', input];
    
    // Video codec
    switch (preset.codec) {
      case 'h264':
        args.push('-c:v', 'libx264', '-preset', 'medium', '-crf', '23');
        break;
      case 'h265':
        args.push('-c:v', 'libx265', '-preset', 'medium', '-crf', '28');
        break;
      case 'vp9':
        args.push('-c:v', 'libvpx-vp9', '-crf', '30', '-b:v', '0');
        break;
      case 'av1':
        args.push('-c:v', 'libaom-av1', '-crf', '30', '-b:v', '0');
        break;
    }
    
    // Resolution
    if (preset.resolution.width > 0) {
      args.push('-vf', `scale=${preset.resolution.width}:${preset.resolution.height}`);
    }
    
    // Bitrate
    if (preset.bitrate > 0) {
      args.push('-b:v', `${preset.bitrate}`);
    }
    
    // Audio
    args.push('-c:a', preset.audioCodec === 'aac' ? 'aac' : 'libopus');
    args.push('-b:a', `${preset.audioBitrate}`);
    
    // HLS specific
    if (preset.container === 'hls') {
      args.push(
        '-hls_time', '10',
        '-hls_list_size', '0',
        '-hls_segment_filename', output.replace('.m3u8', '_%03d.ts')
      );
    }
    
    args.push('-y', output);
    
    return args;
  }
  
  private async generateThumbnails(
    inputPath: string,
    jobId: string
  ): Promise<string[]> {
    const { count, width, height, format } = this.config.thumbnailConfig;
    const thumbnails: string[] = [];
    
    // Get video duration
    const metadata = await this.probeMetadata(inputPath);
    const interval = metadata.duration / (count + 1);
    
    for (let i = 1; i <= count; i++) {
      const timestamp = interval * i;
      const outputPath = `/tmp/${jobId}/thumb_${i}.${format}`;
      
      await this.ffmpeg.run([
        '-i', inputPath,
        '-ss', `${timestamp}`,
        '-vframes', '1',
        '-vf', `scale=${width}:${height}`,
        '-y', outputPath
      ]);
      
      thumbnails.push(outputPath);
    }
    
    return thumbnails;
  }
}
```

#### 4.2 Speech-to-Text Pipeline

```typescript
// packages/media/src/audio/transcription.ts

export interface TranscriptionConfig {
  models: TranscriptionModel[];
  defaultModel: string;
  maxAudioDuration: number;
  supportedFormats: string[];
  piiHandling: PIIHandlingConfig;
}

export interface TranscriptionModel {
  id: string;
  name: string;
  provider: 'whisper' | 'deepgram' | 'assemblyai' | 'google';
  languages: string[];
  features: string[];
  costPerMinute: number;
}

export interface PIIHandlingConfig {
  enabled: boolean;
  detectTypes: PIIType[];
  action: 'redact' | 'mask' | 'tag' | 'none';
  redactionChar: string;
}

export type PIIType = 
  | 'person_name'
  | 'phone_number'
  | 'email'
  | 'address'
  | 'ssn'
  | 'credit_card'
  | 'date_of_birth'
  | 'medical_condition';

export const DEFAULT_TRANSCRIPTION_CONFIG: TranscriptionConfig = {
  models: [
    {
      id: 'whisper-large-v3',
      name: 'Whisper Large V3',
      provider: 'whisper',
      languages: ['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ja', 'zh', 'ko'],
      features: ['timestamps', 'speaker_diarization', 'word_level'],
      costPerMinute: 0.006
    },
    {
      id: 'deepgram-nova-2',
      name: 'Deepgram Nova 2',
      provider: 'deepgram',
      languages: ['en', 'es', 'fr', 'de'],
      features: ['timestamps', 'speaker_diarization', 'word_level', 'smart_format'],
      costPerMinute: 0.0043
    }
  ],
  defaultModel: 'whisper-large-v3',
  maxAudioDuration: 14400,  // 4 hours
  supportedFormats: ['mp3', 'wav', 'flac', 'm4a', 'ogg', 'webm'],
  piiHandling: {
    enabled: true,
    detectTypes: ['person_name', 'phone_number', 'email', 'ssn', 'credit_card'],
    action: 'redact',
    redactionChar: '*'
  }
};

export class TranscriptionPipeline {
  private config: TranscriptionConfig;
  private piiDetector: PIIDetector;
  
  async transcribe(input: TranscriptionInput): Promise<TranscriptionResult> {
    const jobId = generateId('transcribe');
    
    // 1. Select model based on requirements
    const model = this.selectModel(input);
    
    // 2. Prepare audio (convert if needed, split if too long)
    const audioChunks = await this.prepareAudio(input.audioUrl, jobId);
    
    // 3. Transcribe each chunk
    const chunkResults = await Promise.all(
      audioChunks.map((chunk, index) =>
        this.transcribeChunk(chunk, model, jobId, index)
      )
    );
    
    // 4. Merge results
    const mergedTranscript = this.mergeChunks(chunkResults);
    
    // 5. Handle PII
    const processedTranscript = await this.handlePII(mergedTranscript, input.piiConfig);
    
    // 6. Generate output formats
    const outputs = await this.generateOutputs(processedTranscript, input.outputFormats);
    
    return {
      jobId,
      status: 'completed',
      transcript: processedTranscript,
      outputs,
      metadata: {
        model: model.id,
        duration: audioChunks.reduce((sum, c) => sum + c.duration, 0),
        language: processedTranscript.detectedLanguage,
        confidence: processedTranscript.averageConfidence
      }
    };
  }
  
  private selectModel(input: TranscriptionInput): TranscriptionModel {
    const requirements = input.requirements || {};
    
    // Filter by language
    let candidates = this.config.models;
    if (requirements.language) {
      candidates = candidates.filter(m => m.languages.includes(requirements.language!));
    }
    
    // Filter by features
    if (requirements.features) {
      candidates = candidates.filter(m =>
        requirements.features!.every(f => m.features.includes(f))
      );
    }
    
    // Select by cost or quality preference
    if (requirements.preferCost) {
      candidates.sort((a, b) => a.costPerMinute - b.costPerMinute);
    }
    
    return candidates[0] || this.config.models.find(m => m.id === this.config.defaultModel)!;
  }
  
  private async transcribeChunk(
    chunk: AudioChunk,
    model: TranscriptionModel,
    jobId: string,
    index: number
  ): Promise<ChunkTranscript> {
    switch (model.provider) {
      case 'whisper':
        return this.transcribeWithWhisper(chunk, model);
      case 'deepgram':
        return this.transcribeWithDeepgram(chunk, model);
      case 'assemblyai':
        return this.transcribeWithAssemblyAI(chunk, model);
      case 'google':
        return this.transcribeWithGoogle(chunk, model);
      default:
        throw new Error(`Unknown provider: ${model.provider}`);
    }
  }
  
  private async transcribeWithWhisper(
    chunk: AudioChunk,
    model: TranscriptionModel
  ): Promise<ChunkTranscript> {
    const response = await fetch(`${process.env.WHISPER_API_URL}/transcribe`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.WHISPER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        audio_url: chunk.url,
        model: model.id,
        response_format: 'verbose_json',
        timestamp_granularities: ['word', 'segment']
      })
    });
    
    const data = await response.json();
    
    return {
      text: data.text,
      segments: data.segments.map((s: any) => ({
        start: s.start + chunk.startOffset,
        end: s.end + chunk.startOffset,
        text: s.text,
        confidence: s.confidence,
        words: s.words?.map((w: any) => ({
          word: w.word,
          start: w.start + chunk.startOffset,
          end: w.end + chunk.startOffset,
          confidence: w.probability
        }))
      })),
      language: data.language
    };
  }
  
  private async handlePII(
    transcript: MergedTranscript,
    config?: PIIHandlingConfig
  ): Promise<ProcessedTranscript> {
    const piiConfig = config || this.config.piiHandling;
    
    if (!piiConfig.enabled || piiConfig.action === 'none') {
      return transcript as ProcessedTranscript;
    }
    
    // Detect PII in transcript
    const piiFindings = await this.piiDetector.detect(transcript.text, piiConfig.detectTypes);
    
    let processedText = transcript.text;
    const redactions: PIIRedaction[] = [];
    
    // Sort findings by position (reverse order for replacement)
    piiFindings.sort((a, b) => b.start - a.start);
    
    for (const finding of piiFindings) {
      const original = processedText.slice(finding.start, finding.end);
      let replacement: string;
      
      switch (piiConfig.action) {
        case 'redact':
          replacement = piiConfig.redactionChar.repeat(original.length);
          break;
        case 'mask':
          replacement = `[${finding.type.toUpperCase()}]`;
          break;
        case 'tag':
          replacement = `<pii type="${finding.type}">${original}</pii>`;
          break;
        default:
          replacement = original;
      }
      
      processedText = 
        processedText.slice(0, finding.start) + 
        replacement + 
        processedText.slice(finding.end);
      
      redactions.push({
        type: finding.type,
        start: finding.start,
        end: finding.end,
        original: piiConfig.action === 'tag' ? original : undefined,
        replacement
      });
    }
    
    return {
      ...transcript,
      text: processedText,
      piiRedactions: redactions
    };
  }
}
```

#### 4.3 Voice Output Generation

```typescript
// packages/media/src/audio/synthesis.ts

export interface VoiceSynthesisConfig {
  providers: VoiceProvider[];
  defaultProvider: string;
  latencyTargets: LatencyTargets;
  caching: CachingConfig;
  consentRequired: boolean;
}

export interface VoiceProvider {
  id: string;
  name: string;
  voices: Voice[];
  features: string[];
  latencyMs: number;
  costPer1kChars: number;
}

export interface Voice {
  id: string;
  name: string;
  language: string;
  gender: 'male' | 'female' | 'neutral';
  style?: string;
  preview_url?: string;
}

export interface LatencyTargets {
  firstByte: number;    // Time to first audio byte
  streaming: number;    // Chunk interval for streaming
  complete: number;     // Total generation time
}

export const DEFAULT_VOICE_CONFIG: VoiceSynthesisConfig = {
  providers: [
    {
      id: 'elevenlabs',
      name: 'ElevenLabs',
      voices: [
        { id: 'rachel', name: 'Rachel', language: 'en', gender: 'female' },
        { id: 'adam', name: 'Adam', language: 'en', gender: 'male' }
      ],
      features: ['streaming', 'voice_cloning', 'emotion'],
      latencyMs: 200,
      costPer1kChars: 0.30
    },
    {
      id: 'openai',
      name: 'OpenAI TTS',
      voices: [
        { id: 'alloy', name: 'Alloy', language: 'en', gender: 'neutral' },
        { id: 'echo', name: 'Echo', language: 'en', gender: 'male' },
        { id: 'nova', name: 'Nova', language: 'en', gender: 'female' }
      ],
      features: ['streaming', 'hd_quality'],
      latencyMs: 150,
      costPer1kChars: 0.015
    }
  ],
  defaultProvider: 'openai',
  latencyTargets: {
    firstByte: 300,      // 300ms to first byte
    streaming: 100,      // 100ms chunk interval
    complete: 5000       // 5s for typical response
  },
  caching: {
    enabled: true,
    ttlSeconds: 86400,   // 24 hours
    maxSizeMB: 100
  },
  consentRequired: true
};

export class VoiceSynthesisPipeline {
  private config: VoiceSynthesisConfig;
  private cache: AudioCache;
  private consentStore: ConsentStore;
  
  async synthesize(input: SynthesisInput): Promise<SynthesisResult> {
    // 1. Check consent if required
    if (this.config.consentRequired) {
      await this.verifyConsent(input.userId, input.voiceId);
    }
    
    // 2. Check cache
    const cacheKey = this.buildCacheKey(input);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      return {
        status: 'cached',
        audioUrl: cached.url,
        duration: cached.duration,
        fromCache: true
      };
    }
    
    // 3. Select provider and voice
    const { provider, voice } = this.selectProviderAndVoice(input);
    
    // 4. Generate audio
    const startTime = Date.now();
    const audio = await this.generateAudio(input.text, provider, voice, input.options);
    const latency = Date.now() - startTime;
    
    // 5. Check latency targets
    if (latency > this.config.latencyTargets.complete) {
      voiceSynthesisLatencyHistogram.observe({ provider: provider.id }, latency);
      console.warn(`Voice synthesis exceeded latency target: ${latency}ms`);
    }
    
    // 6. Upload to storage
    const audioUrl = await this.uploadAudio(audio, input);
    
    // 7. Cache result
    if (this.config.caching.enabled) {
      await this.cache.set(cacheKey, {
        url: audioUrl,
        duration: audio.duration,
        generatedAt: Date.now()
      });
    }
    
    return {
      status: 'generated',
      audioUrl,
      duration: audio.duration,
      latencyMs: latency,
      provider: provider.id,
      voice: voice.id,
      fromCache: false
    };
  }
  
  async synthesizeStreaming(
    input: SynthesisInput,
    onChunk: (chunk: AudioChunk) => void
  ): Promise<void> {
    const { provider, voice } = this.selectProviderAndVoice(input);
    
    // Verify provider supports streaming
    if (!provider.features.includes('streaming')) {
      throw new Error(`Provider ${provider.id} does not support streaming`);
    }
    
    const startTime = Date.now();
    let firstByteTime: number | null = null;
    
    switch (provider.id) {
      case 'elevenlabs':
        await this.streamFromElevenLabs(input.text, voice, (chunk) => {
          if (!firstByteTime) {
            firstByteTime = Date.now() - startTime;
            voiceFirstByteLatency.observe({ provider: provider.id }, firstByteTime);
          }
          onChunk(chunk);
        });
        break;
        
      case 'openai':
        await this.streamFromOpenAI(input.text, voice, (chunk) => {
          if (!firstByteTime) {
            firstByteTime = Date.now() - startTime;
            voiceFirstByteLatency.observe({ provider: provider.id }, firstByteTime);
          }
          onChunk(chunk);
        });
        break;
    }
  }
  
  private async verifyConsent(userId: string, voiceId: string): Promise<void> {
    const consent = await this.consentStore.get(userId, 'voice_synthesis');
    
    if (!consent || !consent.granted) {
      throw new ConsentRequiredError(
        'User consent required for voice synthesis',
        { requiredConsent: 'voice_synthesis' }
      );
    }
    
    // Check if using cloned voice requires additional consent
    const voice = this.findVoice(voiceId);
    if (voice?.isCloned && !consent.clonedVoiceAllowed) {
      throw new ConsentRequiredError(
        'Additional consent required for cloned voice',
        { requiredConsent: 'cloned_voice' }
      );
    }
  }
  
  private async streamFromOpenAI(
    text: string,
    voice: Voice,
    onChunk: (chunk: AudioChunk) => void
  ): Promise<void> {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text,
        voice: voice.id,
        response_format: 'mp3',
        stream: true
      })
    });
    
    const reader = response.body!.getReader();
    let offset = 0;
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      onChunk({
        data: value,
        offset,
        format: 'mp3'
      });
      
      offset += value.length;
    }
  }
}
```

#### 4.4 Media Storage and Streaming

```typescript
// packages/media/src/storage/streaming.ts

export interface MediaStorageConfig {
  bucket: string;
  cdnDomain: string;
  maxFileSizeMB: number;
  allowedMimeTypes: string[];
  retentionDays: number;
  encryptionEnabled: boolean;
}

export class MediaStorageManager {
  private s3: S3Client;
  private config: MediaStorageConfig;
  
  async upload(input: MediaUploadInput): Promise<MediaUploadResult> {
    const key = this.generateKey(input);
    
    // Validate file
    this.validateFile(input);
    
    // Upload with multipart for large files
    if (input.size > 100 * 1024 * 1024) {  // 100MB
      return this.multipartUpload(input, key);
    }
    
    // Standard upload
    await this.s3.send(new PutObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Body: input.data,
      ContentType: input.mimeType,
      Metadata: {
        'tenant-id': input.tenantId,
        'user-id': input.userId,
        'original-name': input.filename
      },
      ServerSideEncryption: this.config.encryptionEnabled ? 'aws:kms' : undefined
    }));
    
    return {
      key,
      url: `https://${this.config.cdnDomain}/${key}`,
      size: input.size,
      mimeType: input.mimeType
    };
  }
  
  async getStreamingUrl(
    key: string,
    options: StreamingOptions = {}
  ): Promise<StreamingUrl> {
    // Generate signed URL for streaming
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ResponseContentType: options.contentType,
      Range: options.range
    });
    
    const signedUrl = await getSignedUrl(this.s3, command, {
      expiresIn: options.expiresIn || 3600
    });
    
    // For HLS/DASH, return manifest URL
    if (key.endsWith('.m3u8') || key.endsWith('.mpd')) {
      return {
        type: 'adaptive',
        manifestUrl: signedUrl,
        cdnUrl: `https://${this.config.cdnDomain}/${key}`
      };
    }
    
    // For direct streaming
    return {
      type: 'direct',
      url: signedUrl,
      cdnUrl: `https://${this.config.cdnDomain}/${key}`,
      supportsRange: true
    };
  }
  
  async handleRangeRequest(
    key: string,
    rangeHeader: string
  ): Promise<RangeResponse> {
    // Parse range header
    const match = rangeHeader.match(/bytes=(\d+)-(\d*)/);
    if (!match) {
      throw new Error('Invalid range header');
    }
    
    const start = parseInt(match[1]);
    const end = match[2] ? parseInt(match[2]) : undefined;
    
    // Get object with range
    const response = await this.s3.send(new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      Range: `bytes=${start}-${end || ''}`
    }));
    
    return {
      statusCode: 206,
      headers: {
        'Content-Range': response.ContentRange,
        'Content-Length': response.ContentLength?.toString(),
        'Content-Type': response.ContentType,
        'Accept-Ranges': 'bytes'
      },
      body: response.Body
    };
  }
  
  private async multipartUpload(
    input: MediaUploadInput,
    key: string
  ): Promise<MediaUploadResult> {
    const partSize = 10 * 1024 * 1024;  // 10MB parts
    const parts: CompletedPart[] = [];
    
    // Initiate multipart upload
    const createResponse = await this.s3.send(new CreateMultipartUploadCommand({
      Bucket: this.config.bucket,
      Key: key,
      ContentType: input.mimeType,
      ServerSideEncryption: this.config.encryptionEnabled ? 'aws:kms' : undefined
    }));
    
    const uploadId = createResponse.UploadId!;
    
    try {
      // Upload parts
      let partNumber = 1;
      let offset = 0;
      
      while (offset < input.size) {
        const end = Math.min(offset + partSize, input.size);
        const partData = input.data.slice(offset, end);
        
        const uploadResponse = await this.s3.send(new UploadPartCommand({
          Bucket: this.config.bucket,
          Key: key,
          UploadId: uploadId,
          PartNumber: partNumber,
          Body: partData
        }));
        
        parts.push({
          PartNumber: partNumber,
          ETag: uploadResponse.ETag
        });
        
        partNumber++;
        offset = end;
        
        // Emit progress
        this.emitProgress(input.jobId, offset / input.size);
      }
      
      // Complete multipart upload
      await this.s3.send(new CompleteMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: { Parts: parts }
      }));
      
      return {
        key,
        url: `https://${this.config.cdnDomain}/${key}`,
        size: input.size,
        mimeType: input.mimeType
      };
      
    } catch (error) {
      // Abort on failure
      await this.s3.send(new AbortMultipartUploadCommand({
        Bucket: this.config.bucket,
        Key: key,
        UploadId: uploadId
      }));
      
      throw error;
    }
  }
}
```


---

## 5. Collaboration Correctness and Permissions

### PR-020: Collaboration Access Control

#### 5.1 Session Access Control

```typescript
// packages/collab/src/access/control.ts

export interface CollabSessionAccess {
  sessionId: string;
  ownerId: string;
  tenantId: string;
  visibility: 'private' | 'team' | 'org' | 'public';
  permissions: CollabPermission[];
  invites: CollabInvite[];
  linkSharing: LinkSharingConfig;
}

export interface CollabPermission {
  userId: string;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
  grantedBy: string;
  grantedAt: Date;
  expiresAt?: Date;
}

export interface CollabInvite {
  id: string;
  email: string;
  role: CollabPermission['role'];
  invitedBy: string;
  invitedAt: Date;
  expiresAt: Date;
  status: 'pending' | 'accepted' | 'expired' | 'revoked';
}

export interface LinkSharingConfig {
  enabled: boolean;
  linkId?: string;
  role: 'viewer' | 'commenter' | 'editor';
  requireAuth: boolean;
  expiresAt?: Date;
  maxUses?: number;
  currentUses: number;
  allowedDomains?: string[];
}

export class CollabAccessController {
  async canJoin(
    sessionId: string,
    userId: string,
    context: JoinContext
  ): Promise<AccessDecision> {
    const session = await this.getSession(sessionId);
    
    // Owner always has access
    if (session.ownerId === userId) {
      return { allowed: true, role: 'owner' };
    }
    
    // Check direct permissions
    const directPermission = session.permissions.find(p => p.userId === userId);
    if (directPermission) {
      if (directPermission.expiresAt && directPermission.expiresAt < new Date()) {
        return { allowed: false, reason: 'Permission expired' };
      }
      return { allowed: true, role: directPermission.role };
    }
    
    // Check team/org visibility
    if (session.visibility === 'team' || session.visibility === 'org') {
      const isSameTenant = await this.checkTenantMembership(userId, session.tenantId);
      if (isSameTenant) {
        return { 
          allowed: true, 
          role: session.visibility === 'team' ? 'editor' : 'viewer' 
        };
      }
    }
    
    // Check link sharing
    if (context.shareLink && session.linkSharing.enabled) {
      return this.validateLinkAccess(session, context.shareLink, userId);
    }
    
    // Check pending invite
    const invite = session.invites.find(i => 
      i.email === context.userEmail && i.status === 'pending'
    );
    if (invite) {
      return { 
        allowed: true, 
        role: invite.role,
        requireAcceptInvite: true,
        inviteId: invite.id
      };
    }
    
    return { allowed: false, reason: 'No access to session' };
  }
  
  async grantAccess(
    sessionId: string,
    granterId: string,
    params: GrantAccessParams
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    
    // Verify granter has permission to grant
    const granterAccess = await this.canJoin(sessionId, granterId, {});
    if (!granterAccess.allowed || !this.canGrantRole(granterAccess.role, params.role)) {
      throw new ForbiddenError('Insufficient permissions to grant access');
    }
    
    // Create permission
    const permission: CollabPermission = {
      userId: params.userId,
      role: params.role,
      grantedBy: granterId,
      grantedAt: new Date(),
      expiresAt: params.expiresAt
    };
    
    await db.insert(collabPermissions).values({
      sessionId,
      ...permission
    });
    
    // Audit log
    await auditLog({
      action: 'collab.access.granted',
      actor: granterId,
      resource: sessionId,
      tenantId: session.tenantId,
      details: { userId: params.userId, role: params.role }
    });
  }
  
  async createShareLink(
    sessionId: string,
    creatorId: string,
    config: Partial<LinkSharingConfig>
  ): Promise<ShareLink> {
    const session = await this.getSession(sessionId);
    
    // Verify creator has permission
    const access = await this.canJoin(sessionId, creatorId, {});
    if (!access.allowed || !['owner', 'editor'].includes(access.role)) {
      throw new ForbiddenError('Only owners and editors can create share links');
    }
    
    const linkId = generateId('link');
    const linkConfig: LinkSharingConfig = {
      enabled: true,
      linkId,
      role: config.role || 'viewer',
      requireAuth: config.requireAuth ?? true,
      expiresAt: config.expiresAt,
      maxUses: config.maxUses,
      currentUses: 0,
      allowedDomains: config.allowedDomains
    };
    
    await db.update(collabSessions)
      .set({ linkSharing: linkConfig })
      .where(eq(collabSessions.id, sessionId));
    
    // Audit log
    await auditLog({
      action: 'collab.share_link.created',
      actor: creatorId,
      resource: sessionId,
      tenantId: session.tenantId,
      details: { linkId, role: linkConfig.role }
    });
    
    return {
      url: `${process.env.APP_URL}/collab/${sessionId}?link=${linkId}`,
      linkId,
      expiresAt: linkConfig.expiresAt
    };
  }
  
  private validateLinkAccess(
    session: CollabSessionAccess,
    linkId: string,
    userId?: string
  ): AccessDecision {
    const link = session.linkSharing;
    
    if (!link.enabled || link.linkId !== linkId) {
      return { allowed: false, reason: 'Invalid share link' };
    }
    
    if (link.expiresAt && link.expiresAt < new Date()) {
      return { allowed: false, reason: 'Share link expired' };
    }
    
    if (link.maxUses && link.currentUses >= link.maxUses) {
      return { allowed: false, reason: 'Share link usage limit reached' };
    }
    
    if (link.requireAuth && !userId) {
      return { allowed: false, reason: 'Authentication required', requireAuth: true };
    }
    
    return { allowed: true, role: link.role };
  }
  
  private canGrantRole(granterRole: string, targetRole: string): boolean {
    const roleHierarchy = ['viewer', 'commenter', 'editor', 'owner'];
    const granterLevel = roleHierarchy.indexOf(granterRole);
    const targetLevel = roleHierarchy.indexOf(targetRole);
    
    // Can only grant roles at or below your level (except owner)
    return granterLevel >= targetLevel && targetRole !== 'owner';
  }
}
```

#### 5.2 Presence and Cursor Model

```typescript
// packages/collab/src/presence/model.ts

export interface PresenceState {
  sessionId: string;
  participants: Participant[];
  cursors: Map<string, CursorPosition>;
  selections: Map<string, Selection>;
}

export interface Participant {
  id: string;
  userId: string;
  name: string;
  avatar?: string;
  color: string;
  status: 'active' | 'idle' | 'away';
  joinedAt: Date;
  lastActivityAt: Date;
  currentView?: string;  // Which part of document they're viewing
}

export interface CursorPosition {
  participantId: string;
  x: number;
  y: number;
  elementId?: string;
  timestamp: number;
}

export interface Selection {
  participantId: string;
  start: SelectionPoint;
  end: SelectionPoint;
  timestamp: number;
}

export interface SelectionPoint {
  path: (string | number)[];  // JSON path to element
  offset: number;
}

export class PresenceManager {
  private redis: Redis;
  private pubsub: PubSub;
  private idleTimeout = 60000;  // 1 minute
  private awayTimeout = 300000;  // 5 minutes
  
  async join(sessionId: string, user: User): Promise<Participant> {
    const participant: Participant = {
      id: generateId('part'),
      userId: user.id,
      name: user.name,
      avatar: user.avatar,
      color: this.assignColor(sessionId),
      status: 'active',
      joinedAt: new Date(),
      lastActivityAt: new Date()
    };
    
    // Add to presence set
    await this.redis.hset(
      `presence:${sessionId}`,
      participant.id,
      JSON.stringify(participant)
    );
    
    // Set expiry for automatic cleanup
    await this.redis.expire(`presence:${sessionId}`, 3600);
    
    // Broadcast join event
    await this.pubsub.publish(`collab:${sessionId}:presence`, {
      type: 'participant_joined',
      participant
    });
    
    return participant;
  }
  
  async leave(sessionId: string, participantId: string): Promise<void> {
    // Remove from presence
    await this.redis.hdel(`presence:${sessionId}`, participantId);
    
    // Remove cursor and selection
    await this.redis.hdel(`cursors:${sessionId}`, participantId);
    await this.redis.hdel(`selections:${sessionId}`, participantId);
    
    // Broadcast leave event
    await this.pubsub.publish(`collab:${sessionId}:presence`, {
      type: 'participant_left',
      participantId
    });
  }
  
  async updateCursor(
    sessionId: string,
    participantId: string,
    position: Omit<CursorPosition, 'participantId' | 'timestamp'>
  ): Promise<void> {
    const cursor: CursorPosition = {
      ...position,
      participantId,
      timestamp: Date.now()
    };
    
    // Update cursor position
    await this.redis.hset(
      `cursors:${sessionId}`,
      participantId,
      JSON.stringify(cursor)
    );
    
    // Update last activity
    await this.updateActivity(sessionId, participantId);
    
    // Broadcast cursor update (throttled on client side)
    await this.pubsub.publish(`collab:${sessionId}:cursors`, {
      type: 'cursor_moved',
      cursor
    });
  }
  
  async updateSelection(
    sessionId: string,
    participantId: string,
    selection: Omit<Selection, 'participantId' | 'timestamp'>
  ): Promise<void> {
    const sel: Selection = {
      ...selection,
      participantId,
      timestamp: Date.now()
    };
    
    await this.redis.hset(
      `selections:${sessionId}`,
      participantId,
      JSON.stringify(sel)
    );
    
    await this.pubsub.publish(`collab:${sessionId}:selections`, {
      type: 'selection_changed',
      selection: sel
    });
  }
  
  async getPresenceState(sessionId: string): Promise<PresenceState> {
    const [participantsData, cursorsData, selectionsData] = await Promise.all([
      this.redis.hgetall(`presence:${sessionId}`),
      this.redis.hgetall(`cursors:${sessionId}`),
      this.redis.hgetall(`selections:${sessionId}`)
    ]);
    
    const participants = Object.values(participantsData).map(p => JSON.parse(p));
    const cursors = new Map(
      Object.entries(cursorsData).map(([k, v]) => [k, JSON.parse(v)])
    );
    const selections = new Map(
      Object.entries(selectionsData).map(([k, v]) => [k, JSON.parse(v)])
    );
    
    return { sessionId, participants, cursors, selections };
  }
  
  private async updateActivity(sessionId: string, participantId: string): Promise<void> {
    const data = await this.redis.hget(`presence:${sessionId}`, participantId);
    if (!data) return;
    
    const participant = JSON.parse(data);
    participant.lastActivityAt = new Date();
    participant.status = 'active';
    
    await this.redis.hset(
      `presence:${sessionId}`,
      participantId,
      JSON.stringify(participant)
    );
  }
  
  // Background job to update idle/away status
  async checkIdleParticipants(): Promise<void> {
    const sessions = await this.redis.keys('presence:*');
    
    for (const key of sessions) {
      const sessionId = key.replace('presence:', '');
      const participants = await this.redis.hgetall(key);
      
      for (const [id, data] of Object.entries(participants)) {
        const participant = JSON.parse(data);
        const inactiveTime = Date.now() - new Date(participant.lastActivityAt).getTime();
        
        let newStatus = participant.status;
        if (inactiveTime > this.awayTimeout) {
          newStatus = 'away';
        } else if (inactiveTime > this.idleTimeout) {
          newStatus = 'idle';
        }
        
        if (newStatus !== participant.status) {
          participant.status = newStatus;
          await this.redis.hset(key, id, JSON.stringify(participant));
          
          await this.pubsub.publish(`collab:${sessionId}:presence`, {
            type: 'status_changed',
            participantId: id,
            status: newStatus
          });
        }
      }
    }
  }
  
  private assignColor(sessionId: string): string {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
      '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F',
      '#BB8FCE', '#85C1E9', '#F8B500', '#00CED1'
    ];
    
    // Get existing colors to avoid duplicates
    // Simple round-robin for now
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
```

#### 5.3 Owner Pays Credits Enforcement

```typescript
// packages/collab/src/billing/owner-pays.ts

export interface CollabBillingConfig {
  ownerPaysCredits: boolean;
  creditPooling: boolean;
  perParticipantLimit?: number;
  sessionBudget?: number;
}

export class CollabBillingEnforcer {
  async checkCredits(
    sessionId: string,
    operation: CollabOperation
  ): Promise<CreditCheckResult> {
    const session = await this.getSession(sessionId);
    const owner = await this.getOwner(session.ownerId);
    
    // Calculate credit cost
    const cost = this.calculateCost(operation);
    
    // Check owner's credit balance
    const ownerCredits = await this.getCredits(owner.id);
    
    if (ownerCredits.available < cost) {
      return {
        allowed: false,
        reason: 'Insufficient credits',
        ownerId: owner.id,
        required: cost,
        available: ownerCredits.available
      };
    }
    
    // Check session budget if set
    if (session.billingConfig.sessionBudget) {
      const sessionUsage = await this.getSessionUsage(sessionId);
      if (sessionUsage + cost > session.billingConfig.sessionBudget) {
        return {
          allowed: false,
          reason: 'Session budget exceeded',
          budget: session.billingConfig.sessionBudget,
          used: sessionUsage
        };
      }
    }
    
    // Check per-participant limit if set
    if (session.billingConfig.perParticipantLimit) {
      const participantUsage = await this.getParticipantUsage(
        sessionId,
        operation.participantId
      );
      if (participantUsage + cost > session.billingConfig.perParticipantLimit) {
        return {
          allowed: false,
          reason: 'Participant limit exceeded',
          limit: session.billingConfig.perParticipantLimit,
          used: participantUsage
        };
      }
    }
    
    return { allowed: true, cost };
  }
  
  async chargeCredits(
    sessionId: string,
    operation: CollabOperation,
    cost: number
  ): Promise<void> {
    const session = await this.getSession(sessionId);
    
    // Create billing event
    const event: BillingEvent = {
      id: generateId('bill'),
      type: 'collab_operation',
      tenantId: session.tenantId,
      userId: session.ownerId,  // Owner is charged
      amount: cost,
      metadata: {
        sessionId,
        operationType: operation.type,
        participantId: operation.participantId,
        participantUserId: operation.userId
      },
      createdAt: new Date()
    };
    
    // Deduct from owner's credits
    await this.deductCredits(session.ownerId, cost, event);
    
    // Update session usage tracking
    await this.updateSessionUsage(sessionId, cost);
    await this.updateParticipantUsage(sessionId, operation.participantId, cost);
    
    // Audit log
    await auditLog({
      action: 'collab.credits.charged',
      actor: operation.userId,
      resource: sessionId,
      tenantId: session.tenantId,
      details: {
        cost,
        chargedTo: session.ownerId,
        operation: operation.type
      }
    });
  }
  
  async notifyOwnerLowCredits(ownerId: string, remaining: number): Promise<void> {
    const thresholds = [100, 50, 20, 10, 5];
    
    for (const threshold of thresholds) {
      if (remaining <= threshold) {
        const notificationKey = `low_credits:${ownerId}:${threshold}`;
        const alreadyNotified = await this.redis.get(notificationKey);
        
        if (!alreadyNotified) {
          await this.sendNotification(ownerId, {
            type: 'low_credits',
            title: 'Low Credit Balance',
            message: `Your credit balance is low (${remaining} remaining). Collaboration sessions you own may be affected.`,
            severity: threshold <= 10 ? 'critical' : 'warning'
          });
          
          // Mark as notified (expires when credits replenished)
          await this.redis.set(notificationKey, '1', 'EX', 86400);
        }
        
        break;
      }
    }
  }
}
```

#### 5.4 Collaboration Audit Logging

```typescript
// packages/collab/src/audit/logger.ts

export interface CollabAuditEvent {
  id: string;
  sessionId: string;
  tenantId: string;
  timestamp: Date;
  
  // Actor information
  actorId: string;
  actorType: 'user' | 'ai' | 'system';
  actorName: string;
  
  // Event details
  eventType: CollabEventType;
  eventCategory: 'access' | 'content' | 'settings' | 'billing';
  
  // Change tracking
  before?: any;
  after?: any;
  diff?: any;
  
  // Context
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}

export type CollabEventType =
  // Access events
  | 'session.created'
  | 'session.joined'
  | 'session.left'
  | 'permission.granted'
  | 'permission.revoked'
  | 'invite.sent'
  | 'invite.accepted'
  | 'link.created'
  | 'link.accessed'
  | 'link.revoked'
  
  // Content events
  | 'content.created'
  | 'content.updated'
  | 'content.deleted'
  | 'content.restored'
  | 'version.created'
  | 'version.restored'
  | 'conflict.detected'
  | 'conflict.resolved'
  
  // Settings events
  | 'settings.updated'
  | 'visibility.changed'
  
  // Billing events
  | 'credits.charged'
  | 'budget.exceeded'
  | 'limit.reached';

export class CollabAuditLogger {
  private buffer: CollabAuditEvent[] = [];
  private flushInterval = 5000;  // 5 seconds
  private maxBufferSize = 100;
  
  constructor() {
    // Periodic flush
    setInterval(() => this.flush(), this.flushInterval);
  }
  
  async log(event: Omit<CollabAuditEvent, 'id' | 'timestamp'>): Promise<void> {
    const fullEvent: CollabAuditEvent = {
      ...event,
      id: generateId('audit'),
      timestamp: new Date()
    };
    
    this.buffer.push(fullEvent);
    
    // Flush if buffer is full
    if (this.buffer.length >= this.maxBufferSize) {
      await this.flush();
    }
    
    // Real-time streaming for critical events
    if (this.isCriticalEvent(event.eventType)) {
      await this.streamToSIEM(fullEvent);
    }
  }
  
  async logContentChange(
    sessionId: string,
    actor: Actor,
    change: ContentChange
  ): Promise<void> {
    // Generate diff
    const diff = this.generateDiff(change.before, change.after);
    
    await this.log({
      sessionId,
      tenantId: change.tenantId,
      actorId: actor.id,
      actorType: actor.type,
      actorName: actor.name,
      eventType: 'content.updated',
      eventCategory: 'content',
      before: change.before,
      after: change.after,
      diff,
      ipAddress: actor.ipAddress,
      userAgent: actor.userAgent,
      requestId: actor.requestId
    });
  }
  
  async logConflict(
    sessionId: string,
    conflict: ConflictEvent
  ): Promise<void> {
    await this.log({
      sessionId,
      tenantId: conflict.tenantId,
      actorId: 'system',
      actorType: 'system',
      actorName: 'Conflict Resolver',
      eventType: conflict.resolved ? 'conflict.resolved' : 'conflict.detected',
      eventCategory: 'content',
      before: {
        localVersion: conflict.localVersion,
        remoteVersion: conflict.remoteVersion
      },
      after: conflict.resolved ? {
        resolvedVersion: conflict.resolvedVersion,
        resolution: conflict.resolution
      } : undefined
    });
  }
  
  async query(params: AuditQueryParams): Promise<AuditQueryResult> {
    const conditions: any[] = [];
    
    if (params.sessionId) {
      conditions.push(eq(collabAuditEvents.sessionId, params.sessionId));
    }
    
    if (params.tenantId) {
      conditions.push(eq(collabAuditEvents.tenantId, params.tenantId));
    }
    
    if (params.actorId) {
      conditions.push(eq(collabAuditEvents.actorId, params.actorId));
    }
    
    if (params.eventTypes) {
      conditions.push(inArray(collabAuditEvents.eventType, params.eventTypes));
    }
    
    if (params.startDate) {
      conditions.push(gte(collabAuditEvents.timestamp, params.startDate));
    }
    
    if (params.endDate) {
      conditions.push(lte(collabAuditEvents.timestamp, params.endDate));
    }
    
    const events = await db.query.collabAuditEvents.findMany({
      where: and(...conditions),
      orderBy: [desc(collabAuditEvents.timestamp)],
      limit: params.limit || 100,
      offset: params.offset || 0
    });
    
    const total = await db.select({ count: sql`count(*)` })
      .from(collabAuditEvents)
      .where(and(...conditions));
    
    return {
      events,
      total: Number(total[0].count),
      hasMore: events.length === (params.limit || 100)
    };
  }
  
  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;
    
    const events = [...this.buffer];
    this.buffer = [];
    
    try {
      await db.insert(collabAuditEvents).values(events);
    } catch (error) {
      // Re-add to buffer on failure
      this.buffer.unshift(...events);
      console.error('Failed to flush audit events:', error);
    }
  }
  
  private isCriticalEvent(eventType: CollabEventType): boolean {
    const criticalEvents: CollabEventType[] = [
      'permission.granted',
      'permission.revoked',
      'link.created',
      'visibility.changed',
      'content.deleted'
    ];
    return criticalEvents.includes(eventType);
  }
  
  private async streamToSIEM(event: CollabAuditEvent): Promise<void> {
    // Send to SIEM (e.g., Splunk, Datadog)
    await fetch(process.env.SIEM_ENDPOINT!, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SIEM_TOKEN}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source: 'manus-collab',
        event
      })
    });
  }
  
  private generateDiff(before: any, after: any): any {
    // Use json-diff or similar library
    return jsonDiff.diff(before, after);
  }
}
```


---

## 6. SLOs, Observability and Incident Ops

### PR-021: Golden Signals and SLOs

#### 6.1 Golden Signals by Subsystem

```typescript
// packages/observability/src/slo/golden-signals.ts

export interface GoldenSignals {
  latency: LatencySignal;
  traffic: TrafficSignal;
  errors: ErrorSignal;
  saturation: SaturationSignal;
}

export interface SubsystemSLO {
  name: string;
  signals: GoldenSignals;
  slos: SLODefinition[];
  alertRules: AlertRule[];
}

export const SUBSYSTEM_SLOS: Record<string, SubsystemSLO> = {
  // API Gateway
  api_gateway: {
    name: 'API Gateway',
    signals: {
      latency: {
        metric: 'http_request_duration_seconds',
        labels: { service: 'api-gateway' },
        percentiles: [0.5, 0.9, 0.95, 0.99]
      },
      traffic: {
        metric: 'http_requests_total',
        labels: { service: 'api-gateway' }
      },
      errors: {
        metric: 'http_requests_total',
        labels: { service: 'api-gateway', status: '5xx' },
        errorRatio: 'http_requests_total{status=~"5.."} / http_requests_total'
      },
      saturation: {
        metric: 'process_open_fds',
        labels: { service: 'api-gateway' },
        threshold: 0.8
      }
    },
    slos: [
      {
        name: 'api_availability',
        target: 0.999,
        window: '30d',
        indicator: '1 - (sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])))'
      },
      {
        name: 'api_latency_p99',
        target: 0.99,
        window: '30d',
        indicator: 'histogram_quantile(0.99, rate(http_request_duration_seconds_bucket[5m])) < 0.5'
      }
    ],
    alertRules: [
      {
        name: 'APIHighErrorRate',
        expr: 'sum(rate(http_requests_total{status=~"5.."}[5m])) / sum(rate(http_requests_total[5m])) > 0.01',
        for: '5m',
        severity: 'critical',
        annotations: {
          summary: 'API error rate above 1%',
          runbook: 'https://runbooks.manus.im/api-high-error-rate'
        }
      }
    ]
  },
  
  // Agent Runtime
  agent_runtime: {
    name: 'Agent Runtime',
    signals: {
      latency: {
        metric: 'agent_step_duration_seconds',
        labels: { service: 'agent-runtime' },
        percentiles: [0.5, 0.9, 0.95, 0.99]
      },
      traffic: {
        metric: 'agent_runs_total',
        labels: { service: 'agent-runtime' }
      },
      errors: {
        metric: 'agent_runs_total',
        labels: { service: 'agent-runtime', status: 'failed' },
        errorRatio: 'agent_runs_total{status="failed"} / agent_runs_total'
      },
      saturation: {
        metric: 'agent_concurrent_runs',
        labels: { service: 'agent-runtime' },
        threshold: 0.9
      }
    },
    slos: [
      {
        name: 'agent_success_rate',
        target: 0.95,
        window: '7d',
        indicator: '1 - (sum(agent_runs_total{status="failed"}) / sum(agent_runs_total))'
      },
      {
        name: 'agent_completion_time',
        target: 0.9,
        window: '7d',
        indicator: 'histogram_quantile(0.9, rate(agent_run_duration_seconds_bucket[1h])) < 300'
      }
    ],
    alertRules: [
      {
        name: 'AgentHighFailureRate',
        expr: 'sum(rate(agent_runs_total{status="failed"}[15m])) / sum(rate(agent_runs_total[15m])) > 0.1',
        for: '10m',
        severity: 'critical'
      },
      {
        name: 'AgentStuckRuns',
        expr: 'sum(agent_runs_stuck_total) > 10',
        for: '5m',
        severity: 'warning'
      }
    ]
  },
  
  // Queue System
  queue_system: {
    name: 'Queue System',
    signals: {
      latency: {
        metric: 'job_processing_duration_seconds',
        labels: { service: 'queue' },
        percentiles: [0.5, 0.9, 0.95, 0.99]
      },
      traffic: {
        metric: 'jobs_processed_total',
        labels: { service: 'queue' }
      },
      errors: {
        metric: 'jobs_failed_total',
        labels: { service: 'queue' },
        errorRatio: 'jobs_failed_total / jobs_processed_total'
      },
      saturation: {
        metric: 'queue_depth',
        labels: { service: 'queue' },
        threshold: 10000
      }
    },
    slos: [
      {
        name: 'job_processing_success',
        target: 0.999,
        window: '7d',
        indicator: '1 - (sum(jobs_failed_total) / sum(jobs_processed_total))'
      },
      {
        name: 'job_wait_time',
        target: 0.95,
        window: '7d',
        indicator: 'histogram_quantile(0.95, rate(job_wait_duration_seconds_bucket[1h])) < 60'
      }
    ],
    alertRules: [
      {
        name: 'QueueBacklogHigh',
        expr: 'sum(queue_depth) > 50000',
        for: '10m',
        severity: 'warning'
      },
      {
        name: 'DLQGrowing',
        expr: 'rate(dlq_messages_total[5m]) > 1',
        for: '5m',
        severity: 'critical'
      }
    ]
  },
  
  // Sandbox System
  sandbox_system: {
    name: 'Sandbox System',
    signals: {
      latency: {
        metric: 'sandbox_startup_duration_seconds',
        labels: { service: 'sandbox' },
        percentiles: [0.5, 0.9, 0.95, 0.99]
      },
      traffic: {
        metric: 'sandbox_executions_total',
        labels: { service: 'sandbox' }
      },
      errors: {
        metric: 'sandbox_executions_total',
        labels: { service: 'sandbox', status: 'failed' },
        errorRatio: 'sandbox_executions_total{status="failed"} / sandbox_executions_total'
      },
      saturation: {
        metric: 'sandbox_pool_utilization',
        labels: { service: 'sandbox' },
        threshold: 0.85
      }
    },
    slos: [
      {
        name: 'sandbox_availability',
        target: 0.999,
        window: '30d',
        indicator: '1 - (sum(sandbox_executions_total{status="failed"}) / sum(sandbox_executions_total))'
      },
      {
        name: 'sandbox_startup_time',
        target: 0.99,
        window: '7d',
        indicator: 'histogram_quantile(0.99, rate(sandbox_startup_duration_seconds_bucket[1h])) < 5'
      }
    ],
    alertRules: [
      {
        name: 'SandboxPoolExhausted',
        expr: 'sandbox_pool_utilization > 0.95',
        for: '5m',
        severity: 'critical'
      },
      {
        name: 'SandboxStartupSlow',
        expr: 'histogram_quantile(0.95, rate(sandbox_startup_duration_seconds_bucket[5m])) > 10',
        for: '10m',
        severity: 'warning'
      }
    ]
  },
  
  // Collaboration System
  collab_system: {
    name: 'Collaboration System',
    signals: {
      latency: {
        metric: 'collab_sync_latency_seconds',
        labels: { service: 'collab' },
        percentiles: [0.5, 0.9, 0.95, 0.99]
      },
      traffic: {
        metric: 'collab_operations_total',
        labels: { service: 'collab' }
      },
      errors: {
        metric: 'collab_conflicts_total',
        labels: { service: 'collab' },
        errorRatio: 'collab_conflicts_total / collab_operations_total'
      },
      saturation: {
        metric: 'collab_concurrent_sessions',
        labels: { service: 'collab' },
        threshold: 10000
      }
    },
    slos: [
      {
        name: 'collab_sync_latency',
        target: 0.99,
        window: '7d',
        indicator: 'histogram_quantile(0.99, rate(collab_sync_latency_seconds_bucket[5m])) < 0.2'
      },
      {
        name: 'collab_conflict_rate',
        target: 0.999,
        window: '7d',
        indicator: '1 - (sum(collab_conflicts_unresolved_total) / sum(collab_operations_total))'
      }
    ],
    alertRules: [
      {
        name: 'CollabHighLatency',
        expr: 'histogram_quantile(0.95, rate(collab_sync_latency_seconds_bucket[5m])) > 0.5',
        for: '5m',
        severity: 'warning'
      },
      {
        name: 'CollabConflictsHigh',
        expr: 'rate(collab_conflicts_total[5m]) > 10',
        for: '5m',
        severity: 'warning'
      }
    ]
  }
};
```

#### 6.2 SLO Gates for Deployments

```typescript
// packages/observability/src/slo/gates.ts

export interface SLOGate {
  name: string;
  sloName: string;
  threshold: number;
  action: 'block' | 'warn' | 'notify';
  bypassRoles: string[];
}

export const DEPLOYMENT_SLO_GATES: SLOGate[] = [
  {
    name: 'api_availability_gate',
    sloName: 'api_availability',
    threshold: 0.995,  // Block if below 99.5%
    action: 'block',
    bypassRoles: ['sre', 'oncall']
  },
  {
    name: 'agent_success_gate',
    sloName: 'agent_success_rate',
    threshold: 0.90,
    action: 'block',
    bypassRoles: ['sre', 'oncall']
  },
  {
    name: 'error_budget_gate',
    sloName: 'error_budget_remaining',
    threshold: 0.10,  // Block if less than 10% error budget remaining
    action: 'block',
    bypassRoles: ['sre']
  },
  {
    name: 'burn_rate_gate',
    sloName: 'burn_rate_1h',
    threshold: 10,  // Block if burning 10x normal rate
    action: 'block',
    bypassRoles: ['sre']
  }
];

export class SLOGateChecker {
  async checkGates(deployment: Deployment): Promise<GateCheckResult> {
    const results: GateResult[] = [];
    let blocked = false;
    
    for (const gate of DEPLOYMENT_SLO_GATES) {
      const sloValue = await this.getSLOValue(gate.sloName);
      const passed = this.evaluateGate(gate, sloValue);
      
      results.push({
        gate: gate.name,
        sloValue,
        threshold: gate.threshold,
        passed,
        action: gate.action
      });
      
      if (!passed && gate.action === 'block') {
        // Check for bypass
        if (!this.canBypass(deployment.deployedBy, gate.bypassRoles)) {
          blocked = true;
        }
      }
    }
    
    return {
      deployment: deployment.id,
      blocked,
      results,
      timestamp: Date.now()
    };
  }
  
  private evaluateGate(gate: SLOGate, value: number): boolean {
    // For error budget and burn rate, lower is worse
    if (gate.sloName.includes('error_budget') || gate.sloName.includes('burn_rate')) {
      return value > gate.threshold;
    }
    // For availability/success metrics, higher is better
    return value >= gate.threshold;
  }
  
  private async getSLOValue(sloName: string): Promise<number> {
    const query = this.buildPromQLQuery(sloName);
    const result = await this.prometheus.query(query);
    return parseFloat(result.data.result[0]?.value[1] || '0');
  }
  
  private buildPromQLQuery(sloName: string): string {
    const queries: Record<string, string> = {
      'api_availability': '1 - (sum(rate(http_requests_total{status=~"5.."}[1h])) / sum(rate(http_requests_total[1h])))',
      'agent_success_rate': '1 - (sum(rate(agent_runs_total{status="failed"}[1h])) / sum(rate(agent_runs_total[1h])))',
      'error_budget_remaining': 'slo:error_budget_remaining:ratio',
      'burn_rate_1h': 'slo:burn_rate:1h'
    };
    return queries[sloName] || sloName;
  }
}
```

#### 6.3 Canary Deployment and Rollback

```typescript
// packages/deployment/src/canary/manager.ts

export interface CanaryConfig {
  initialWeight: number;      // Start at 1%
  maxWeight: number;          // Max 50% before full rollout
  incrementWeight: number;    // Increase by 5% each step
  stepDuration: number;       // 10 minutes per step
  analysisInterval: number;   // Check metrics every 1 minute
  rollbackThreshold: number;  // Rollback if error rate > 1%
  successThreshold: number;   // Promote if all metrics pass
}

export const DEFAULT_CANARY_CONFIG: CanaryConfig = {
  initialWeight: 1,
  maxWeight: 50,
  incrementWeight: 5,
  stepDuration: 600000,      // 10 minutes
  analysisInterval: 60000,   // 1 minute
  rollbackThreshold: 0.01,   // 1% error rate
  successThreshold: 0.999    // 99.9% success
};

export class CanaryDeploymentManager {
  private config: CanaryConfig;
  private analyzer: CanaryAnalyzer;
  
  async deploy(deployment: Deployment): Promise<CanaryResult> {
    const canaryId = generateId('canary');
    let currentWeight = this.config.initialWeight;
    
    // Start canary with initial weight
    await this.setTrafficWeight(deployment, currentWeight);
    
    while (currentWeight <= this.config.maxWeight) {
      // Wait for step duration
      const stepStart = Date.now();
      
      while (Date.now() - stepStart < this.config.stepDuration) {
        // Analyze metrics
        const analysis = await this.analyzer.analyze(deployment, canaryId);
        
        if (analysis.shouldRollback) {
          await this.rollback(deployment, canaryId, analysis.reason);
          return {
            status: 'rolled_back',
            reason: analysis.reason,
            finalWeight: currentWeight,
            metrics: analysis.metrics
          };
        }
        
        await sleep(this.config.analysisInterval);
      }
      
      // Increment weight
      currentWeight += this.config.incrementWeight;
      
      if (currentWeight <= this.config.maxWeight) {
        await this.setTrafficWeight(deployment, currentWeight);
        
        // Notify progress
        await this.notifyProgress(deployment, canaryId, currentWeight);
      }
    }
    
    // Canary successful - promote to full rollout
    await this.promote(deployment, canaryId);
    
    return {
      status: 'promoted',
      finalWeight: 100,
      duration: Date.now() - deployment.startedAt
    };
  }
  
  private async rollback(
    deployment: Deployment,
    canaryId: string,
    reason: string
  ): Promise<void> {
    // Set weight to 0
    await this.setTrafficWeight(deployment, 0);
    
    // Scale down canary pods
    await this.scaleDown(deployment.canaryDeployment);
    
    // Notify
    await this.notifyRollback(deployment, canaryId, reason);
    
    // Audit
    await auditLog({
      action: 'deployment.canary.rolled_back',
      actor: 'system',
      resource: deployment.id,
      details: { canaryId, reason }
    });
  }
  
  private async promote(deployment: Deployment, canaryId: string): Promise<void> {
    // Update stable deployment
    await this.updateStableDeployment(deployment);
    
    // Shift all traffic to new version
    await this.setTrafficWeight(deployment, 100);
    
    // Scale down old version
    await this.scaleDown(deployment.previousDeployment);
    
    // Notify
    await this.notifyPromotion(deployment, canaryId);
    
    // Audit
    await auditLog({
      action: 'deployment.canary.promoted',
      actor: 'system',
      resource: deployment.id,
      details: { canaryId }
    });
  }
}

export class CanaryAnalyzer {
  async analyze(deployment: Deployment, canaryId: string): Promise<CanaryAnalysis> {
    const metrics = await this.collectMetrics(deployment);
    
    // Compare canary vs stable
    const comparison = this.compareMetrics(metrics.canary, metrics.stable);
    
    // Check for degradation
    const degradations: string[] = [];
    
    if (comparison.errorRateDiff > 0.005) {  // 0.5% higher error rate
      degradations.push(`Error rate ${(comparison.errorRateDiff * 100).toFixed(2)}% higher than stable`);
    }
    
    if (comparison.latencyP99Diff > 0.2) {  // 200ms higher p99
      degradations.push(`P99 latency ${comparison.latencyP99Diff * 1000}ms higher than stable`);
    }
    
    if (comparison.successRateDiff < -0.01) {  // 1% lower success rate
      degradations.push(`Success rate ${Math.abs(comparison.successRateDiff * 100).toFixed(2)}% lower than stable`);
    }
    
    return {
      shouldRollback: degradations.length > 0,
      reason: degradations.join('; '),
      metrics,
      comparison
    };
  }
  
  private async collectMetrics(deployment: Deployment): Promise<CanaryMetrics> {
    const [canaryMetrics, stableMetrics] = await Promise.all([
      this.queryMetrics(deployment.canaryDeployment),
      this.queryMetrics(deployment.stableDeployment)
    ]);
    
    return {
      canary: canaryMetrics,
      stable: stableMetrics
    };
  }
}
```

#### 6.4 Feature Flags System

```typescript
// packages/deployment/src/flags/system.ts

export interface FeatureFlag {
  key: string;
  name: string;
  description: string;
  enabled: boolean;
  
  // Targeting rules
  targeting: TargetingRule[];
  
  // Rollout configuration
  rollout: RolloutConfig;
  
  // Metadata
  owner: string;
  createdAt: Date;
  updatedAt: Date;
  expiresAt?: Date;
}

export interface TargetingRule {
  id: string;
  priority: number;
  conditions: Condition[];
  variation: string;
}

export interface Condition {
  attribute: string;
  operator: 'eq' | 'neq' | 'in' | 'nin' | 'gt' | 'lt' | 'contains' | 'regex';
  value: any;
}

export interface RolloutConfig {
  type: 'percentage' | 'gradual' | 'scheduled';
  percentage?: number;
  schedule?: {
    startAt: Date;
    endAt: Date;
    startPercentage: number;
    endPercentage: number;
  };
}

export class FeatureFlagService {
  private cache: LRUCache<string, FeatureFlag>;
  private evaluationCache: LRUCache<string, boolean>;
  
  async evaluate(
    flagKey: string,
    context: EvaluationContext
  ): Promise<FlagEvaluation> {
    // Check evaluation cache
    const cacheKey = `${flagKey}:${this.hashContext(context)}`;
    const cached = this.evaluationCache.get(cacheKey);
    if (cached !== undefined) {
      return { value: cached, reason: 'cache' };
    }
    
    // Get flag definition
    const flag = await this.getFlag(flagKey);
    
    if (!flag) {
      return { value: false, reason: 'flag_not_found' };
    }
    
    if (!flag.enabled) {
      return { value: false, reason: 'flag_disabled' };
    }
    
    // Check targeting rules
    for (const rule of flag.targeting.sort((a, b) => a.priority - b.priority)) {
      if (this.evaluateRule(rule, context)) {
        const value = rule.variation === 'true';
        this.evaluationCache.set(cacheKey, value);
        return { value, reason: 'targeting_rule', ruleId: rule.id };
      }
    }
    
    // Apply rollout
    const rolloutValue = this.evaluateRollout(flag.rollout, context);
    this.evaluationCache.set(cacheKey, rolloutValue);
    
    return { value: rolloutValue, reason: 'rollout' };
  }
  
  private evaluateRule(rule: TargetingRule, context: EvaluationContext): boolean {
    return rule.conditions.every(condition => {
      const value = this.getAttributeValue(context, condition.attribute);
      return this.evaluateCondition(condition, value);
    });
  }
  
  private evaluateCondition(condition: Condition, value: any): boolean {
    switch (condition.operator) {
      case 'eq':
        return value === condition.value;
      case 'neq':
        return value !== condition.value;
      case 'in':
        return Array.isArray(condition.value) && condition.value.includes(value);
      case 'nin':
        return Array.isArray(condition.value) && !condition.value.includes(value);
      case 'gt':
        return value > condition.value;
      case 'lt':
        return value < condition.value;
      case 'contains':
        return String(value).includes(condition.value);
      case 'regex':
        return new RegExp(condition.value).test(String(value));
      default:
        return false;
    }
  }
  
  private evaluateRollout(rollout: RolloutConfig, context: EvaluationContext): boolean {
    let percentage: number;
    
    switch (rollout.type) {
      case 'percentage':
        percentage = rollout.percentage || 0;
        break;
        
      case 'gradual':
        if (!rollout.schedule) return false;
        const now = Date.now();
        const start = rollout.schedule.startAt.getTime();
        const end = rollout.schedule.endAt.getTime();
        
        if (now < start) return false;
        if (now > end) percentage = rollout.schedule.endPercentage;
        else {
          const progress = (now - start) / (end - start);
          percentage = rollout.schedule.startPercentage + 
            (rollout.schedule.endPercentage - rollout.schedule.startPercentage) * progress;
        }
        break;
        
      case 'scheduled':
        if (!rollout.schedule) return false;
        const currentTime = Date.now();
        if (currentTime < rollout.schedule.startAt.getTime()) return false;
        if (currentTime > rollout.schedule.endAt.getTime()) return false;
        percentage = rollout.percentage || 100;
        break;
        
      default:
        percentage = 0;
    }
    
    // Deterministic bucketing based on user ID
    const bucket = this.getBucket(context.userId || context.sessionId || 'anonymous');
    return bucket < percentage;
  }
  
  private getBucket(id: string): number {
    // Consistent hashing for deterministic bucketing
    const hash = crypto.createHash('md5').update(id).digest('hex');
    const hashInt = parseInt(hash.substring(0, 8), 16);
    return (hashInt % 100);
  }
}
```

#### 6.5 Incident Response Automation

```typescript
// packages/incident/src/automation/response.ts

export interface IncidentConfig {
  severityLevels: SeverityLevel[];
  escalationPolicies: EscalationPolicy[];
  automatedResponses: AutomatedResponse[];
  oncallIntegration: OncallIntegration;
}

export interface SeverityLevel {
  level: 'critical' | 'high' | 'medium' | 'low';
  responseTime: number;      // Expected response time in minutes
  escalationTime: number;    // Time before escalation in minutes
  notifyChannels: string[];
  requiresIncidentCommander: boolean;
}

export interface EscalationPolicy {
  name: string;
  levels: EscalationLevel[];
}

export interface EscalationLevel {
  order: number;
  targets: EscalationTarget[];
  delayMinutes: number;
}

export interface EscalationTarget {
  type: 'user' | 'schedule' | 'team';
  id: string;
}

export interface AutomatedResponse {
  trigger: AlertTrigger;
  actions: ResponseAction[];
  conditions?: Condition[];
}

export interface ResponseAction {
  type: 'runbook' | 'scale' | 'restart' | 'rollback' | 'notify' | 'page';
  config: Record<string, any>;
}

export const DEFAULT_INCIDENT_CONFIG: IncidentConfig = {
  severityLevels: [
    {
      level: 'critical',
      responseTime: 5,
      escalationTime: 15,
      notifyChannels: ['slack-incidents', 'pagerduty'],
      requiresIncidentCommander: true
    },
    {
      level: 'high',
      responseTime: 15,
      escalationTime: 30,
      notifyChannels: ['slack-incidents'],
      requiresIncidentCommander: true
    },
    {
      level: 'medium',
      responseTime: 60,
      escalationTime: 120,
      notifyChannels: ['slack-alerts'],
      requiresIncidentCommander: false
    },
    {
      level: 'low',
      responseTime: 240,
      escalationTime: 480,
      notifyChannels: ['slack-alerts'],
      requiresIncidentCommander: false
    }
  ],
  escalationPolicies: [
    {
      name: 'default',
      levels: [
        { order: 1, targets: [{ type: 'schedule', id: 'primary-oncall' }], delayMinutes: 0 },
        { order: 2, targets: [{ type: 'schedule', id: 'secondary-oncall' }], delayMinutes: 15 },
        { order: 3, targets: [{ type: 'team', id: 'sre-team' }], delayMinutes: 30 },
        { order: 4, targets: [{ type: 'user', id: 'engineering-manager' }], delayMinutes: 45 }
      ]
    }
  ],
  automatedResponses: [
    {
      trigger: { alertName: 'SandboxPoolExhausted', severity: 'critical' },
      actions: [
        { type: 'scale', config: { deployment: 'sandbox-pool', replicas: '+50%' } },
        { type: 'notify', config: { channel: 'slack-incidents', message: 'Auto-scaling sandbox pool' } }
      ]
    },
    {
      trigger: { alertName: 'APIHighErrorRate', severity: 'critical' },
      actions: [
        { type: 'runbook', config: { id: 'api-high-error-rate' } },
        { type: 'page', config: { policy: 'default' } }
      ],
      conditions: [
        { attribute: 'error_rate', operator: 'gt', value: 0.05 }
      ]
    },
    {
      trigger: { alertName: 'CanaryDegraded', severity: 'high' },
      actions: [
        { type: 'rollback', config: { automatic: true } },
        { type: 'notify', config: { channel: 'slack-deployments', message: 'Auto-rollback triggered' } }
      ]
    }
  ],
  oncallIntegration: {
    provider: 'pagerduty',
    serviceId: process.env.PAGERDUTY_SERVICE_ID!,
    apiKey: process.env.PAGERDUTY_API_KEY!
  }
};

export class IncidentResponseAutomation {
  private config: IncidentConfig;
  private pagerduty: PagerDutyClient;
  private slack: SlackClient;
  
  async handleAlert(alert: Alert): Promise<IncidentResponse> {
    // Determine severity
    const severity = this.determineSeverity(alert);
    const severityConfig = this.config.severityLevels.find(s => s.level === severity)!;
    
    // Create incident
    const incident = await this.createIncident(alert, severity);
    
    // Execute automated responses
    const automatedActions = await this.executeAutomatedResponses(alert, incident);
    
    // Notify channels
    await this.notifyChannels(incident, severityConfig.notifyChannels);
    
    // Page oncall if critical
    if (severity === 'critical' || severity === 'high') {
      await this.pageOncall(incident, severityConfig);
    }
    
    // Start escalation timer
    this.startEscalationTimer(incident, severityConfig);
    
    return {
      incident,
      automatedActions,
      escalationStarted: true
    };
  }
  
  private async executeAutomatedResponses(
    alert: Alert,
    incident: Incident
  ): Promise<ActionResult[]> {
    const results: ActionResult[] = [];
    
    for (const response of this.config.automatedResponses) {
      if (!this.matchesTrigger(alert, response.trigger)) {
        continue;
      }
      
      if (response.conditions && !this.evaluateConditions(alert, response.conditions)) {
        continue;
      }
      
      for (const action of response.actions) {
        try {
          const result = await this.executeAction(action, incident, alert);
          results.push({ action: action.type, success: true, result });
        } catch (error) {
          results.push({ 
            action: action.type, 
            success: false, 
            error: (error as Error).message 
          });
        }
      }
    }
    
    return results;
  }
  
  private async executeAction(
    action: ResponseAction,
    incident: Incident,
    alert: Alert
  ): Promise<any> {
    switch (action.type) {
      case 'runbook':
        return this.executeRunbook(action.config.id, incident);
        
      case 'scale':
        return this.scaleDeployment(
          action.config.deployment,
          action.config.replicas
        );
        
      case 'restart':
        return this.restartService(action.config.service);
        
      case 'rollback':
        return this.triggerRollback(action.config);
        
      case 'notify':
        return this.sendNotification(
          action.config.channel,
          action.config.message,
          incident
        );
        
      case 'page':
        return this.pageOncall(incident, action.config);
        
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }
  
  private async pageOncall(
    incident: Incident,
    config: any
  ): Promise<void> {
    const policy = this.config.escalationPolicies.find(
      p => p.name === (config.policy || 'default')
    )!;
    
    // Create PagerDuty incident
    await this.pagerduty.createIncident({
      title: incident.title,
      description: incident.description,
      severity: incident.severity,
      escalationPolicy: policy.name,
      customDetails: {
        incidentId: incident.id,
        alertName: incident.alertName,
        runbookUrl: incident.runbookUrl
      }
    });
  }
  
  private startEscalationTimer(
    incident: Incident,
    severityConfig: SeverityLevel
  ): void {
    setTimeout(async () => {
      // Check if incident is still open
      const current = await this.getIncident(incident.id);
      if (current.status !== 'resolved' && current.status !== 'acknowledged') {
        await this.escalate(incident);
      }
    }, severityConfig.escalationTime * 60 * 1000);
  }
}
```

---

## 7. Implementation Order

### Recommended PR Sequence

| PR | Name | Dependencies | Estimated Days |
|----|------|--------------|----------------|
| PR-014 | Enterprise Authentication | None | 5 |
| PR-015 | Secrets and Key Management | PR-014 | 4 |
| PR-016 | Data Isolation and Compliance | PR-015 | 5 |
| PR-017 | Sandbox Runtime Selection | None | 6 |
| PR-018 | Job Processing Guarantees | None | 5 |
| PR-019 | Video Processing Pipeline | PR-017 | 7 |
| PR-020 | Collaboration Access Control | PR-014 | 5 |
| PR-021 | SLOs and Incident Ops | None | 6 |

**Total Estimated Time:** 43 engineering days (approximately 2 months with 1 engineer)

### Critical Path

1. **Security First:** PR-014 → PR-015 → PR-016 (must complete before production)
2. **Sandbox Hardening:** PR-017 (required for code execution)
3. **Queue Reliability:** PR-018 (required for production workloads)
4. **Observability:** PR-021 (required before launch)

### Integration Points

Each PR should include:
- Unit tests with >80% coverage
- Integration tests for cross-service interactions
- Load tests for performance-critical paths
- Runbook documentation
- Prometheus metrics and Grafana dashboards
- Feature flags for gradual rollout

---

## References

1. Google SRE Book - https://sre.google/sre-book/
2. OIDC Specification - https://openid.net/specs/openid-connect-core-1_0.html
3. SAML 2.0 - https://docs.oasis-open.org/security/saml/v2.0/
4. SCIM 2.0 - https://datatracker.ietf.org/doc/html/rfc7644
5. gVisor Documentation - https://gvisor.dev/docs/
6. Firecracker - https://firecracker-microvm.github.io/
7. BullMQ - https://docs.bullmq.io/
8. Yjs CRDT - https://docs.yjs.dev/
9. Prometheus - https://prometheus.io/docs/
10. PagerDuty API - https://developer.pagerduty.com/
