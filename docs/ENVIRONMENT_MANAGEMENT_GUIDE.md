# Environment Configuration Management Guide

This guide provides comprehensive documentation for managing environment-specific configurations, secrets, and deployment settings across development, staging, and production environments for SwissBrain AI.

## Table of Contents

1. [Overview](#overview)
2. [Configuration Architecture](#configuration-architecture)
3. [Environment-Specific Settings](#environment-specific-settings)
4. [Secrets Management](#secrets-management)
5. [Deployment Workflow](#deployment-workflow)
6. [Best Practices](#best-practices)
7. [Troubleshooting](#troubleshooting)

---

## Overview

### Configuration Strategy

SwissBrain AI uses a **12-Factor App** approach for configuration management:

1. **Store config in the environment**: Use ConfigMaps and Secrets
2. **Strict separation**: Config changes don't require code changes
3. **Never commit secrets**: Use templates and generation scripts
4. **Environment parity**: Minimize differences between environments
5. **Validation**: Automated checks before deployment

### Configuration Layers

```
┌─────────────────────────────────────────────────────────────┐
│                   Configuration Layers                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Layer 1: Base Configuration (ConfigMap)                   │
│  • Application settings                                    │
│  • Feature flags                                           │
│  • Non-sensitive configuration                             │
│                                                             │
│  Layer 2: Secrets (Kubernetes Secrets)                     │
│  • API keys                                                │
│  • Database credentials                                    │
│  • Encryption keys                                         │
│  • OAuth secrets                                           │
│                                                             │
│  Layer 3: Environment Variables (Pod Spec)                 │
│  • Runtime configuration                                   │
│  • References to ConfigMaps/Secrets                        │
│                                                             │
│  Layer 4: Runtime Configuration (Application Code)         │
│  • Dynamic feature flags                                   │
│  • A/B testing configuration                               │
│  • User preferences                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuration Architecture

### Directory Structure

```
k8s/
├── config/
│   ├── configmap-development.yaml    # Dev environment config
│   ├── configmap-staging.yaml        # Staging environment config
│   └── configmap-production.yaml     # Production environment config
├── secrets/
│   ├── .gitignore                    # Prevents secret commits
│   ├── secrets-template.yaml         # Template with placeholders
│   └── README.md                     # Secrets documentation
└── storage/
    └── storage-classes.yaml          # Persistent storage config

scripts/config/
├── generate-secrets.sh               # Generate random secrets
├── validate-config.sh                # Validate configuration
└── deploy-config.sh                  # Deploy to specific environment
```

### Configuration Flow

```
┌──────────────┐
│ Developer    │
│ Changes      │
└──────┬───────┘
       │
       ▼
┌──────────────────────┐
│ Edit ConfigMap       │
│ (environment-specific)│
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Validate             │
│ ./validate-config.sh │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Apply to K8s         │
│ kubectl apply -f     │
└──────┬───────────────┘
       │
       ▼
┌──────────────────────┐
│ Pods Restart         │
│ (if needed)          │
└──────────────────────┘
```

---

## Environment-Specific Settings

### Development Environment

**Purpose**: Local development and testing

**Key Characteristics**:
- Debug logging enabled
- CORS allows all origins
- Relaxed security for testing
- Hot reload enabled
- Source maps enabled

**ConfigMap**: `configmap-development.yaml`

```yaml
NODE_ENV: "development"
LOG_LEVEL: "debug"
DEBUG: "true"
CORS_ORIGIN: "*"
SESSION_SECURE: "false"
ENABLE_RATE_LIMITING: "false"
```

**Use Cases**:
- Local development
- Unit testing
- Integration testing
- Debugging

### Staging Environment

**Purpose**: Pre-production testing and QA

**Key Characteristics**:
- Info-level logging
- Restricted CORS
- Production-like security
- Analytics enabled
- Error tracking enabled

**ConfigMap**: `configmap-staging.yaml`

```yaml
NODE_ENV: "staging"
LOG_LEVEL: "info"
DEBUG: "false"
CORS_ORIGIN: "https://staging.swissbrain.ai"
SESSION_SECURE: "true"
ENABLE_RATE_LIMITING: "true"
```

**Use Cases**:
- QA testing
- User acceptance testing (UAT)
- Performance testing
- Integration testing with external services

### Production Environment

**Purpose**: Live user-facing application

**Key Characteristics**:
- Warn-level logging
- Strict security settings
- All monitoring enabled
- Optimized performance
- Swiss data residency

**ConfigMap**: `configmap-production.yaml`

```yaml
NODE_ENV: "production"
LOG_LEVEL: "warn"
DEBUG: "false"
SESSION_SECURE: "true"
HELMET_ENABLED: "true"
DATA_REGION: "ch-gva-2"
GDPR_COMPLIANCE_MODE: "true"
```

**Use Cases**:
- Live production traffic
- Real user data
- Mission-critical operations

---

## Secrets Management

### Secret Types

#### 1. Supabase Secrets

```yaml
supabase-secrets:
  SUPABASE_URL: "https://xxx.supabase.co"
  SUPABASE_ANON_KEY: "eyJ..."
  SUPABASE_SERVICE_ROLE_KEY: "eyJ..."  # Admin key
```

#### 2. API Keys

```yaml
api-keys:
  ANTHROPIC_API_KEY: "sk-ant-..."
  OPENAI_API_KEY: "sk-..."
  STABILITY_API_KEY: "sk-..."
```

#### 3. OAuth Secrets

```yaml
oauth-secrets:
  GOOGLE_CLIENT_ID: "xxx.apps.googleusercontent.com"
  GOOGLE_CLIENT_SECRET: "GOCSPX-..."
  GITHUB_CLIENT_ID: "Iv1.xxx"
  GITHUB_CLIENT_SECRET: "xxx"
  JWT_SECRET: "generated-64-char-string"
```

#### 4. Infrastructure Secrets

```yaml
redis-secrets:
  REDIS_PASSWORD: "generated-32-char-string"

encryption-keys:
  ENCRYPTION_KEY: "hex-64-char-string"
  ENCRYPTION_SALT: "hex-32-char-string"
```

### Generating Secrets

**Method 1: Automated Script**

```bash
# Generate secrets file
./scripts/config/generate-secrets.sh

# Edit generated file and fill in API keys
vim secrets-generated.yaml

# Apply to Kubernetes
kubectl apply -f secrets-generated.yaml

# Delete file immediately
rm secrets-generated.yaml
```

**Method 2: Manual Generation**

```bash
# JWT Secret (64 bytes base64)
openssl rand -base64 64

# Redis Password (32 bytes base64)
openssl rand -base64 32

# Encryption Key (32 bytes hex)
openssl rand -hex 32

# Encryption Salt (16 bytes hex)
openssl rand -hex 16
```

**Method 3: Using kubectl**

```bash
# Create secret directly
kubectl create secret generic api-keys \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-xxx \
  --from-literal=OPENAI_API_KEY=sk-xxx \
  -n swissbrain

# From file
kubectl create secret generic supabase-secrets \
  --from-file=SUPABASE_URL=./supabase-url.txt \
  --from-file=SUPABASE_ANON_KEY=./supabase-anon.txt \
  -n swissbrain
```

### Secret Rotation

**Quarterly Rotation Schedule**:

| Secret Type | Rotation Frequency | Impact |
|-------------|-------------------|---------|
| JWT secrets | Every 90 days | Requires user re-login |
| Redis password | Every 90 days | Requires app restart |
| Encryption keys | Every 180 days | Requires data re-encryption |
| API keys | Vendor-specific | No downtime if dual-key |
| OAuth secrets | Yearly | No downtime |

**Rotation Process**:

```bash
# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 64)

# 2. Update secret in Kubernetes
kubectl patch secret jwt-secrets -n swissbrain \
  -p "{\"data\":{\"JWT_SECRET\":\"$(echo -n $NEW_SECRET | base64)\"}}"

# 3. Rolling restart pods
kubectl rollout restart deployment/sandbox-executor -n swissbrain

# 4. Verify
kubectl rollout status deployment/sandbox-executor -n swissbrain

# 5. Document rotation
echo "$(date): Rotated JWT_SECRET" >> secrets-rotation-log.txt
```

---

## Deployment Workflow

### Deploy to Development

```bash
# 1. Validate configuration
./scripts/config/validate-config.sh development

# 2. Apply ConfigMap
kubectl apply -f k8s/config/configmap-development.yaml

# 3. Create/update secrets (if needed)
./scripts/config/generate-secrets.sh
kubectl apply -f secrets-generated.yaml
rm secrets-generated.yaml

# 4. Restart pods (if needed)
kubectl rollout restart deployment -n swissbrain

# 5. Verify
kubectl get pods -n swissbrain
kubectl logs -n swissbrain -l app=swissbrain --tail=50
```

### Deploy to Staging

```bash
# 1. Validate configuration
./scripts/config/validate-config.sh staging

# 2. Review changes
kubectl diff -f k8s/config/configmap-staging.yaml

# 3. Apply ConfigMap
kubectl apply -f k8s/config/configmap-staging.yaml

# 4. Verify no errors
kubectl describe configmap app-config -n swissbrain

# 5. Rolling restart
kubectl rollout restart deployment/sandbox-executor -n swissbrain
kubectl rollout status deployment/sandbox-executor -n swissbrain

# 6. Smoke test
curl https://api-staging.swissbrain.ai/health
```

### Deploy to Production

```bash
# 1. Validate configuration
./scripts/config/validate-config.sh production

# 2. Review changes carefully
kubectl diff -f k8s/config/configmap-production.yaml

# 3. Create change request (if required)
# Document: what, why, when, rollback plan

# 4. Apply during maintenance window
kubectl apply -f k8s/config/configmap-production.yaml

# 5. Rolling restart with monitoring
kubectl rollout restart deployment/sandbox-executor -n swissbrain

# 6. Monitor logs and metrics
kubectl logs -f -n swissbrain -l app=swissbrain

# 7. Health checks
curl https://api.swissbrain.ai/health

# 8. Verify user impact (if any)
# Check error rates, response times, active users

# 9. Rollback if needed
kubectl rollout undo deployment/sandbox-executor -n swissbrain
```

---

## Best Practices

### Configuration Management

1. **✅ Use ConfigMaps for non-sensitive data**
   ```yaml
   # Good
   data:
     API_URL: "https://api.swissbrain.ai"
     LOG_LEVEL: "info"
   ```

2. **✅ Use Secrets for sensitive data**
   ```yaml
   # Good
   stringData:
     ANTHROPIC_API_KEY: "sk-ant-xxx"
   ```

3. **✅ Never commit secrets to git**
   ```bash
   # .gitignore
   k8s/secrets/*
   !k8s/secrets/secrets-template.yaml
   !k8s/secrets/.gitignore
   ```

4. **✅ Validate before applying**
   ```bash
   ./scripts/config/validate-config.sh production
   kubectl apply --dry-run=client -f config.yaml
   ```

5. **✅ Document configuration changes**
   ```bash
   git commit -m "config: Update API rate limit from 200 to 500 req/min"
   ```

### Security Best Practices

1. **Principle of Least Privilege**
   - Only grant necessary permissions
   - Use RBAC to restrict secret access
   - Audit secret access logs

2. **Encryption at Rest**
   ```yaml
   # Enable encryption at rest in K8s
   apiVersion: apiserver.config.k8s.io/v1
   kind: EncryptionConfiguration
   resources:
     - resources:
         - secrets
       providers:
         - aescbc:
             keys:
               - name: key1
                 secret: <base64-encoded-secret>
   ```

3. **Secrets Scanning**
   ```bash
   # Use tools like gitleaks, trufflehog
   gitleaks detect --source . --verbose
   ```

4. **External Secrets Management** (Recommended for production)
   ```yaml
   # Use external-secrets operator with AWS Secrets Manager
   apiVersion: external-secrets.io/v1beta1
   kind: ExternalSecret
   metadata:
     name: api-keys
   spec:
     secretStoreRef:
       name: aws-secretsmanager
     target:
       name: api-keys
     data:
       - secretKey: ANTHROPIC_API_KEY
         remoteRef:
           key: swissbrain/anthropic-key
   ```

### Environment Parity

Maintain similarity across environments:

| Setting | Development | Staging | Production |
|---------|------------|---------|------------|
| **Same** | Redis | Redis | Redis |
| **Same** | PostgreSQL | PostgreSQL | PostgreSQL |
| **Similar** | 1 replica | 2 replicas | 3-10 replicas |
| **Different** | Debug logs | Info logs | Warn logs |
| **Different** | Local storage | Cloud storage | Cloud storage |

---

## Troubleshooting

### ConfigMap Not Applied

**Problem**: Changes to ConfigMap not reflected in pods

**Solution**:
```bash
# Pods don't automatically restart on ConfigMap changes
kubectl rollout restart deployment/sandbox-executor -n swissbrain

# Or delete pods (they'll be recreated)
kubectl delete pods -n swissbrain -l app=swissbrain
```

### Secret Not Found

**Problem**: Pod fails with "secret not found" error

**Solution**:
```bash
# Check if secret exists
kubectl get secret api-keys -n swissbrain

# If not, create it
kubectl create secret generic api-keys \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-xxx \
  -n swissbrain

# Verify
kubectl describe secret api-keys -n swissbrain
```

### Invalid Configuration

**Problem**: Pod crashes due to invalid config

**Solution**:
```bash
# Check pod logs
kubectl logs -n swissbrain <pod-name>

# Validate configuration
./scripts/config/validate-config.sh production

# Fix config and reapply
kubectl apply -f k8s/config/configmap-production.yaml
kubectl rollout restart deployment/sandbox-executor -n swissbrain
```

### Environment Variable Not Set

**Problem**: Application can't find environment variable

**Solution**:
```bash
# Check if ConfigMap/Secret is mounted
kubectl describe pod <pod-name> -n swissbrain

# Verify environment variables in pod
kubectl exec -it <pod-name> -n swissbrain -- env | grep API_URL

# Check deployment spec
kubectl get deployment sandbox-executor -n swissbrain -o yaml | grep -A 20 envFrom
```

### Secret Decoding

**Problem**: Need to view secret value

**Solution**:
```bash
# Get base64-encoded secret
kubectl get secret api-keys -n swissbrain -o jsonpath='{.data.ANTHROPIC_API_KEY}'

# Decode
kubectl get secret api-keys -n swissbrain -o jsonpath='{.data.ANTHROPIC_API_KEY}' | base64 --decode

# View all secrets in secret
kubectl get secret api-keys -n swissbrain -o json | jq -r '.data | map_values(@base64d)'
```

---

## Advanced Topics

### Using Helm for Configuration

```yaml
# values-production.yaml
environment: production
replicaCount: 3

config:
  logLevel: warn
  enableDebug: false

secrets:
  supabase:
    url: "https://xxx.supabase.co"
    anonKey: "{{ .Values.secrets.supabase.anonKey }}"  # From --set or external source
```

### External Secrets Operator

```yaml
apiVersion: external-secrets.io/v1beta1
kind: SecretStore
metadata:
  name: aws-secretsmanager
  namespace: swissbrain
spec:
  provider:
    aws:
      service: SecretsManager
      region: eu-central-1
      auth:
        jwt:
          serviceAccountRef:
            name: external-secrets
```

### Sealed Secrets

```bash
# Install sealed-secrets controller
kubectl apply -f https://github.com/bitnami-labs/sealed-secrets/releases/download/v0.24.0/controller.yaml

# Encrypt secret
kubeseal --format yaml < secret.yaml > sealed-secret.yaml

# Commit sealed secret to git (safe)
git add sealed-secret.yaml
git commit -m "Add sealed secret"

# Controller automatically decrypts in cluster
```

---

## Checklist

### Pre-Deployment

- [ ] Configuration validated with `validate-config.sh`
- [ ] All required secrets created
- [ ] Secrets rotated if needed
- [ ] Environment-specific settings reviewed
- [ ] YAML syntax validated
- [ ] Dry-run completed successfully
- [ ] Rollback plan documented

### Post-Deployment

- [ ] Pods restarted successfully
- [ ] Health checks passing
- [ ] Logs show no errors
- [ ] Metrics look normal
- [ ] User functionality verified
- [ ] Deployment documented
- [ ] Team notified

---

## Additional Resources

- [Kubernetes ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [12-Factor App Config](https://12factor.net/config)
- [External Secrets Operator](https://external-secrets.io/)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [HashiCorp Vault](https://www.vaultproject.io/)

---

## Summary

This guide provides a comprehensive framework for managing environment configurations across the SwissBrain AI platform:

- ✅ Environment-specific ConfigMaps (dev, staging, production)
- ✅ Secure secrets management
- ✅ Automated secret generation
- ✅ Configuration validation
- ✅ Deployment workflows
- ✅ Best practices and security guidelines
- ✅ Troubleshooting guide

With this system, configuration is:
- **Secure**: Secrets never committed to git
- **Validated**: Automated checks before deployment
- **Versioned**: Configuration changes tracked in git
- **Auditable**: All changes documented
- **Environment-specific**: Tailored for each environment

For questions or issues, refer to the troubleshooting section or contact the SwissBrain infrastructure team.
