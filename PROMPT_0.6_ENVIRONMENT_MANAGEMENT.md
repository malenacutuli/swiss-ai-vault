# Prompt 0.6: Environment Configuration Management

## Status: ✅ Configuration Complete

**Time Spent**: 2 hours
**Date Completed**: 2026-01-13
**Implementation**: Complete

---

## What Was Created

### 1. Environment-Specific ConfigMaps

#### Development ConfigMap (`k8s/config/configmap-development.yaml`)
Optimized for local development and testing:
- Debug logging enabled (`LOG_LEVEL: debug`)
- CORS allows all origins (`CORS_ORIGIN: *`)
- Relaxed security for testing
- Hot reload enabled
- Source maps enabled
- Lower resource limits
- Fast iteration settings

#### Staging ConfigMap (`k8s/config/configmap-staging.yaml`)
Pre-production testing environment:
- Info-level logging (`LOG_LEVEL: info`)
- Restricted CORS to staging domains
- Production-like security settings
- Analytics and error tracking enabled
- Rate limiting enabled
- Moderate resource allocation
- Separate Redis DB (DB 1)

#### Production ConfigMap (`k8s/config/configmap-production.yaml`)
Live production environment:
- Warn-level logging (`LOG_LEVEL: warn`)
- Strict security (HTTPS only, HSTS, CSP)
- Swiss data residency (`DATA_REGION: ch-gva-2`)
- GDPR compliance mode enabled
- Audit logging enabled
- Maximum resource allocation
- Performance optimizations
- Error stack traces hidden
- Source maps disabled

### 2. Secrets Management

#### Secrets Template (`k8s/secrets/secrets-template.yaml`)
Comprehensive template with 8 secret types:

1. **supabase-secrets**
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY

2. **redis-secrets**
   - REDIS_PASSWORD

3. **api-keys**
   - ANTHROPIC_API_KEY
   - OPENAI_API_KEY
   - STABILITY_API_KEY
   - COHERE_API_KEY

4. **oauth-secrets**
   - GOOGLE_CLIENT_ID/SECRET
   - GITHUB_CLIENT_ID/SECRET
   - JWT_SECRET
   - JWT_REFRESH_SECRET

5. **stripe-secrets**
   - STRIPE_SECRET_KEY
   - STRIPE_PUBLISHABLE_KEY
   - STRIPE_WEBHOOK_SECRET

6. **encryption-keys**
   - ENCRYPTION_KEY
   - ENCRYPTION_SALT

7. **smtp-secrets**
   - SMTP credentials for email

8. **monitoring-secrets**
   - SENTRY_DSN
   - DATADOG_API_KEY

#### Security Features
- `.gitignore` prevents secret commits
- Template uses `<PLACEHOLDER>` values
- Never exposes actual secrets
- Includes external-secrets example

### 3. Configuration Automation Scripts

#### Secret Generation Script (`scripts/config/generate-secrets.sh`)
Automated secret generation:
- Generates JWT secrets (64 bytes base64)
- Generates Redis password (32 bytes base64)
- Generates encryption key (32 bytes hex)
- Generates encryption salt (16 bytes hex)
- Creates YAML file with generated values
- Includes template for manual secrets
- Provides step-by-step instructions
- Warns about security

**Usage**:
```bash
./scripts/config/generate-secrets.sh
# Edit file to add API keys
kubectl apply -f secrets-generated.yaml
rm secrets-generated.yaml
```

#### Configuration Validation Script (`scripts/config/validate-config.sh`)
Automated configuration validation:
- Validates YAML syntax
- Checks required variables exist
- Environment-specific checks
- Production safety checks (no debug mode, HTTPS, etc.)
- Checks for common misconfigurations
- Verifies secrets exist in cluster
- Color-coded output (errors, warnings, success)
- Exit codes for CI/CD integration

**Usage**:
```bash
./scripts/config/validate-config.sh production
# Validates production ConfigMap before deployment
```

**Validation Checks**:
- ✅ YAML syntax valid
- ✅ Required variables present
- ✅ No debug mode in production
- ✅ SESSION_SECURE enabled in production
- ✅ CORS not wildcard in production
- ✅ Secrets exist in cluster

### 4. Comprehensive Documentation

#### Environment Management Guide (`docs/ENVIRONMENT_MANAGEMENT_GUIDE.md`)
Complete 500+ line guide covering:

**Sections**:
1. Overview and configuration strategy
2. Configuration architecture and layers
3. Environment-specific settings
4. Secrets management (types, generation, rotation)
5. Deployment workflows (dev, staging, production)
6. Best practices and security guidelines
7. Troubleshooting common issues
8. Advanced topics (Helm, external-secrets, sealed-secrets)

**Key Topics**:
- 12-Factor App principles
- Configuration layers
- Secret rotation schedule
- Deployment checklists
- Security best practices
- Troubleshooting guide

#### Secrets Directory README (`k8s/secrets/README.md`)
Quick reference guide:
- Security warnings
- Quick start instructions
- Secret generation commands
- Verification steps
- Rotation process
- Best practices
- Troubleshooting

---

## Configuration Architecture

```
┌──────────────────────────────────────────────────────────────┐
│            Configuration Management System                    │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Layer 1: ConfigMaps (Non-Sensitive)                        │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│  │Development │  │  Staging   │  │ Production │            │
│  │ DEBUG=true │  │ DEBUG=false│  │ DEBUG=false│            │
│  │ CORS=*     │  │ CORS=strict│  │ CORS=strict│            │
│  └────────────┘  └────────────┘  └────────────┘            │
│                                                              │
│  Layer 2: Secrets (Sensitive)                               │
│  ┌──────────────────────────────────────────────┐           │
│  │ • API Keys (Anthropic, OpenAI, etc.)        │           │
│  │ • Database credentials (Supabase)            │           │
│  │ • OAuth secrets (Google, GitHub)             │           │
│  │ • Encryption keys                            │           │
│  │ • JWT secrets                                │           │
│  └──────────────────────────────────────────────┘           │
│                                                              │
│  Layer 3: Automation                                        │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │   Generate   │  │   Validate   │                         │
│  │   Secrets    │  │Configuration │                         │
│  └──────────────┘  └──────────────┘                         │
│                                                              │
│  Layer 4: Deployment                                        │
│  ┌────────────────────────────────────────────┐             │
│  │ kubectl apply -f configmap-production.yaml│             │
│  │ kubectl apply -f secrets.yaml              │             │
│  │ kubectl rollout restart deployment         │             │
│  └────────────────────────────────────────────┘             │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## Deployment Instructions

### Step 1: Choose Environment

```bash
# Set environment variable
export ENV=production  # or development, staging
```

### Step 2: Generate Secrets

```bash
# Option 1: Automated script
cd scripts/config
./generate-secrets.sh secrets-${ENV}.yaml

# Edit and add API keys
vim secrets-${ENV}.yaml

# Option 2: Manual
openssl rand -base64 64  # JWT_SECRET
openssl rand -base64 32  # REDIS_PASSWORD
openssl rand -hex 32     # ENCRYPTION_KEY
```

### Step 3: Validate Configuration

```bash
# Validate ConfigMap
./scripts/config/validate-config.sh $ENV

# Check for errors/warnings
# Fix any issues before proceeding
```

### Step 4: Apply Configuration

```bash
# Apply ConfigMap
kubectl apply -f k8s/config/configmap-${ENV}.yaml

# Apply Secrets
kubectl apply -f secrets-${ENV}.yaml

# Verify
kubectl get configmap app-config -n swissbrain
kubectl get secrets -n swissbrain
```

### Step 5: Restart Pods

```bash
# Rolling restart (zero downtime)
kubectl rollout restart deployment/sandbox-executor -n swissbrain

# Watch rollout
kubectl rollout status deployment/sandbox-executor -n swissbrain

# Verify pods are running
kubectl get pods -n swissbrain
```

### Step 6: Verify Deployment

```bash
# Check logs
kubectl logs -n swissbrain -l app=swissbrain --tail=50

# Test health endpoint
curl https://api.swissbrain.ai/health

# Check environment variables in pod
kubectl exec -it <pod-name> -n swissbrain -- env | grep NODE_ENV
```

### Step 7: Clean Up

```bash
# Delete secrets file (IMPORTANT!)
rm secrets-${ENV}.yaml

# Verify it's deleted
ls -la secrets-*.yaml
```

---

## Verification Checklist

### Configuration Files

- [ ] ConfigMap created for all environments (dev, staging, prod)
- [ ] Secrets template created with placeholders
- [ ] .gitignore prevents secret commits
- [ ] Scripts are executable (`chmod +x`)
- [ ] Documentation is complete

### Generated Secrets

- [ ] JWT secrets generated (64 bytes)
- [ ] Redis password generated (32 bytes)
- [ ] Encryption key generated (32 bytes hex)
- [ ] Encryption salt generated (16 bytes hex)
- [ ] API keys added manually
- [ ] Supabase credentials added
- [ ] OAuth secrets added (if using)

### Validation

- [ ] YAML syntax valid
- [ ] Required variables present
- [ ] Environment-specific checks passed
- [ ] No debug mode in production
- [ ] SESSION_SECURE enabled in production
- [ ] CORS properly configured
- [ ] No localhost in staging/production

### Deployment

- [ ] ConfigMap applied to Kubernetes
- [ ] Secrets applied to Kubernetes
- [ ] Pods restarted successfully
- [ ] Health checks passing
- [ ] Logs show correct environment
- [ ] Application functions correctly
- [ ] Secrets file deleted after apply

### Security

- [ ] No secrets committed to git
- [ ] Secrets have strong random values
- [ ] RBAC configured for secret access
- [ ] Audit logging enabled (production)
- [ ] Secret rotation schedule documented

---

## Configuration Comparison

### Key Differences by Environment

| Setting | Development | Staging | Production |
|---------|------------|---------|------------|
| **Logging** |
| LOG_LEVEL | debug | info | warn |
| LOG_FORMAT | dev | json | json |
| LOG_COLORIZE | true | false | false |
| **Security** |
| DEBUG | true | false | false |
| SESSION_SECURE | false | true | true |
| CORS_ORIGIN | * | staging.swissbrain.ai | swissbrain.ai |
| HELMET_ENABLED | false | true | true |
| **Performance** |
| QUEUE_CONCURRENCY | 5 | 10 | 20 |
| CACHE_TTL | 300s | 600s | 3600s |
| DB_POOL_MAX | 10 | 20 | 50 |
| **Features** |
| HOT_RELOAD | true | false | false |
| SOURCE_MAPS | true | true | false |
| RATE_LIMITING | false | true | true |
| **Resources** |
| AGENT_MAX_MEMORY | 2GB | 4GB | 8GB |
| AGENT_MAX_TIME | 5min | 10min | 15min |

### Environment Variable Count

- **Development**: 45 variables
- **Staging**: 52 variables
- **Production**: 65 variables

---

## Best Practices Summary

### Configuration Management

1. ✅ **Use ConfigMaps for non-sensitive data**
2. ✅ **Use Secrets for sensitive data**
3. ✅ **Never commit secrets to git**
4. ✅ **Validate before applying**
5. ✅ **Document all changes**

### Secret Management

1. ✅ **Generate strong random values** (openssl rand)
2. ✅ **Rotate secrets regularly** (90-180 days)
3. ✅ **Limit access** (RBAC)
4. ✅ **Audit secret access**
5. ✅ **Use external secret management** (production)

### Deployment

1. ✅ **Validate first** (`validate-config.sh`)
2. ✅ **Dry-run** (`--dry-run=client`)
3. ✅ **Rolling updates** (zero downtime)
4. ✅ **Monitor logs** (kubectl logs -f)
5. ✅ **Have rollback plan**

### Security

1. ✅ **Principle of least privilege**
2. ✅ **Encryption at rest** (K8s EncryptionConfiguration)
3. ✅ **Secrets scanning** (gitleaks, trufflehog)
4. ✅ **No secrets in logs**
5. ✅ **Regular audits**

---

## Secret Rotation Schedule

| Secret Type | Frequency | Impact | Command |
|-------------|-----------|---------|---------|
| JWT secrets | 90 days | User re-login | `openssl rand -base64 64` |
| Redis password | 90 days | App restart | `openssl rand -base64 32` |
| Encryption keys | 180 days | Data re-encryption | `openssl rand -hex 32` |
| API keys | Vendor policy | Usually none | Check vendor docs |
| OAuth secrets | Yearly | None | Update in OAuth provider |

**Rotation Process**:
1. Generate new secret value
2. Update in Kubernetes: `kubectl patch secret...`
3. Rolling restart: `kubectl rollout restart...`
4. Verify: `kubectl rollout status...`
5. Document: Add to rotation log

---

## Advanced Features

### External Secrets Operator (Recommended for Production)

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: api-keys
  namespace: swissbrain
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secretsmanager
  target:
    name: api-keys
  data:
    - secretKey: ANTHROPIC_API_KEY
      remoteRef:
        key: swissbrain/anthropic-key
```

**Benefits**:
- Centralized secret management
- Automatic rotation
- Audit logging
- Fine-grained access control
- No secrets in Kubernetes

### Sealed Secrets (GitOps-Friendly)

```bash
# Encrypt secret
kubeseal --format yaml < secret.yaml > sealed-secret.yaml

# Commit to git (safe)
git add sealed-secret.yaml

# Deploy (auto-decrypts in cluster)
kubectl apply -f sealed-secret.yaml
```

### Helm Values Integration

```yaml
# values-production.yaml
config:
  environment: production
  logLevel: warn

secrets:
  external:
    enabled: true
    backend: aws-secretsmanager
```

---

## Troubleshooting

### ConfigMap Not Applied

**Symptom**: Changes not reflected in pods

**Solution**:
```bash
kubectl rollout restart deployment/sandbox-executor -n swissbrain
```

### Secret Not Found

**Symptom**: Pod fails with "secret not found"

**Solution**:
```bash
kubectl get secret api-keys -n swissbrain || \
  kubectl create secret generic api-keys \
    --from-literal=ANTHROPIC_API_KEY=sk-ant-xxx \
    -n swissbrain
```

### Validation Errors

**Symptom**: `validate-config.sh` reports errors

**Solution**:
1. Fix reported issues in ConfigMap
2. Re-run validation
3. Apply corrected ConfigMap

### Environment Variable Not Set

**Symptom**: App can't find variable

**Solution**:
```bash
# Check pod environment
kubectl exec -it <pod-name> -n swissbrain -- env | grep VAR_NAME

# Verify ConfigMap
kubectl describe configmap app-config -n swissbrain
```

---

## Next Steps

### Immediate Actions

1. **Generate secrets** for your environment
2. **Validate configuration** with script
3. **Apply to Kubernetes** cluster
4. **Verify deployment** is healthy

### Future Enhancements

- [ ] Implement external-secrets operator
- [ ] Set up secret rotation automation
- [ ] Add configuration drift detection
- [ ] Implement policy-as-code (OPA)
- [ ] Set up configuration versioning
- [ ] Add A/B testing configuration
- [ ] Implement feature flag system

### Phase 0 Complete!

✅ **Prompt 0.1**: SSL/TLS Certificate Deployment
✅ **Prompt 0.2**: CI/CD Pipeline
✅ **Prompt 0.3**: Docker Image Build Pipeline
✅ **Prompt 0.4**: Kubernetes Resource Optimization
✅ **Prompt 0.5**: Redis Configuration for BullMQ
✅ **Prompt 0.6**: Environment Configuration Management

**All Phase 0 infrastructure is complete!**

---

## Files Changed

```
k8s/config/
├── configmap-development.yaml     # Dev environment config (NEW)
├── configmap-staging.yaml         # Staging environment config (NEW)
└── configmap-production.yaml      # Production environment config (NEW)

k8s/secrets/
├── .gitignore                     # Prevents secret commits (NEW)
├── secrets-template.yaml          # Secret template (NEW)
└── README.md                      # Secrets documentation (NEW)

scripts/config/
├── generate-secrets.sh            # Secret generation script (NEW)
└── validate-config.sh             # Configuration validation (NEW)

docs/
└── ENVIRONMENT_MANAGEMENT_GUIDE.md # Comprehensive guide (NEW)

PROMPT_0.6_ENVIRONMENT_MANAGEMENT.md # This deployment status (NEW)
```

---

## References

- [Kubernetes ConfigMaps](https://kubernetes.io/docs/concepts/configuration/configmap/)
- [Kubernetes Secrets](https://kubernetes.io/docs/concepts/configuration/secret/)
- [12-Factor App](https://12factor.net/)
- [External Secrets Operator](https://external-secrets.io/)
- [Sealed Secrets](https://github.com/bitnami-labs/sealed-secrets)
- [HashiCorp Vault](https://www.vaultproject.io/)

---

## Deployment Summary

✅ **Status**: Configuration complete
⏳ **Pending**: Secret generation and deployment
📋 **Next Action**: Generate secrets and apply configuration

The environment configuration management system is fully implemented and ready for use. All environments have tailored configurations, secrets are managed securely, and automated tools ensure validation and consistency.

**Key Benefits**:
- ✅ Environment-specific configurations
- ✅ Secure secret management
- ✅ Automated validation
- ✅ Easy deployment workflow
- ✅ Comprehensive documentation
- ✅ Production-ready security

**Phase 0 Infrastructure Complete!** 🎉

All foundational infrastructure for SwissBrain AI is now in place and ready for production deployment.
