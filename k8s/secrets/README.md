# Kubernetes Secrets

This directory contains templates and documentation for managing Kubernetes secrets.

## ⚠️ SECURITY WARNING

**NEVER commit actual secrets to version control!**

This directory should only contain:
- ✅ `secrets-template.yaml` - Template with placeholders
- ✅ `README.md` - This documentation
- ✅ `.gitignore` - Prevents accidental commits

## Quick Start

### 1. Generate Secrets

Use the automated script:

```bash
# Generate random secrets
cd scripts/config
./generate-secrets.sh

# Edit the generated file and add API keys
vim secrets-generated.yaml

# Apply to Kubernetes
kubectl apply -f secrets-generated.yaml

# Delete the file immediately
rm secrets-generated.yaml
```

### 2. Manual Creation

```bash
# Copy template
cp secrets-template.yaml secrets.yaml

# Edit and replace all <PLACEHOLDER> values
vim secrets.yaml

# Apply to Kubernetes
kubectl apply -f secrets.yaml

# Delete the file
rm secrets.yaml
```

### 3. Using kubectl Directly

```bash
# Create secret from literal values
kubectl create secret generic api-keys \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-xxx \
  --from-literal=OPENAI_API_KEY=sk-xxx \
  -n swissbrain

# Create secret from files
kubectl create secret generic supabase-secrets \
  --from-file=SUPABASE_URL=./url.txt \
  --from-file=SUPABASE_ANON_KEY=./anon-key.txt \
  -n swissbrain
```

## Secret Types

### Required Secrets

1. **supabase-secrets**
   - SUPABASE_URL
   - SUPABASE_ANON_KEY
   - SUPABASE_SERVICE_ROLE_KEY

2. **api-keys**
   - ANTHROPIC_API_KEY
   - OPENAI_API_KEY (optional)
   - STABILITY_API_KEY (optional)

3. **redis-secrets**
   - REDIS_PASSWORD

4. **oauth-secrets**
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - JWT_SECRET
   - JWT_REFRESH_SECRET

### Optional Secrets

5. **stripe-secrets** (if using billing)
6. **smtp-secrets** (if sending emails)
7. **monitoring-secrets** (if using external monitoring)

## Generating Strong Secrets

```bash
# JWT Secret (64 bytes base64)
openssl rand -base64 64

# Redis Password (32 bytes base64)
openssl rand -base64 32

# Encryption Key (32 bytes hex)
openssl rand -hex 32

# Random password (20 characters)
openssl rand -base64 20
```

## Verifying Secrets

```bash
# List all secrets
kubectl get secrets -n swissbrain

# Describe a secret (shows keys, not values)
kubectl describe secret api-keys -n swissbrain

# View secret value (decode base64)
kubectl get secret api-keys -n swissbrain \
  -o jsonpath='{.data.ANTHROPIC_API_KEY}' | base64 --decode
```

## Updating Secrets

```bash
# Method 1: Patch existing secret
kubectl patch secret api-keys -n swissbrain \
  -p '{"stringData":{"ANTHROPIC_API_KEY":"new-key-value"}}'

# Method 2: Delete and recreate
kubectl delete secret api-keys -n swissbrain
kubectl create secret generic api-keys \
  --from-literal=ANTHROPIC_API_KEY=new-value \
  -n swissbrain

# Method 3: Edit directly
kubectl edit secret api-keys -n swissbrain
```

## Secret Rotation

Recommended rotation schedule:

| Secret Type | Frequency | Impact |
|-------------|-----------|---------|
| JWT secrets | 90 days | Users must re-login |
| API keys | Per vendor | Usually none |
| Redis password | 90 days | App restart required |
| Encryption keys | 180 days | Data re-encryption |

**Rotation Process**:
1. Generate new secret value
2. Update secret in Kubernetes
3. Rolling restart affected pods
4. Verify application works
5. Document rotation date

## Best Practices

1. **Never commit secrets to git**
   ```bash
   # Always check before committing
   git status
   git diff
   ```

2. **Use strong random values**
   ```bash
   # Don't use weak passwords
   # Use openssl rand or password managers
   ```

3. **Limit access**
   ```bash
   # Use RBAC to control who can read secrets
   kubectl create rolebinding secret-reader \
     --clusterrole=view \
     --serviceaccount=swissbrain:app \
     -n swissbrain
   ```

4. **Audit secret access**
   ```bash
   # Enable audit logging
   # Monitor who accesses secrets
   ```

5. **Use external secret management** (recommended for production)
   - AWS Secrets Manager
   - HashiCorp Vault
   - Azure Key Vault
   - Google Secret Manager

## Troubleshooting

### Secret not found

```bash
# Check if secret exists
kubectl get secret api-keys -n swissbrain

# If not, create it
kubectl create secret generic api-keys \
  --from-literal=ANTHROPIC_API_KEY=sk-ant-xxx \
  -n swissbrain
```

### Pod can't access secret

```bash
# Check if secret is mounted in pod
kubectl describe pod <pod-name> -n swissbrain

# Verify secret reference in deployment
kubectl get deployment sandbox-executor -n swissbrain -o yaml | grep -A 5 secretRef
```

### Invalid base64 encoding

```bash
# When creating from stringData, K8s auto-encodes
# When creating from data, you must base64 encode:
echo -n "my-secret-value" | base64
```

## External Secrets (Advanced)

For production, consider using external-secrets operator:

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
    kind: SecretStore
  target:
    name: api-keys
  data:
    - secretKey: ANTHROPIC_API_KEY
      remoteRef:
        key: swissbrain/anthropic-api-key
```

Benefits:
- Secrets stored in AWS/Azure/GCP
- Automatic rotation
- Centralized management
- Audit logging
- Fine-grained access control

## Support

For detailed information, see:
- [Environment Management Guide](../../docs/ENVIRONMENT_MANAGEMENT_GUIDE.md)
- [Kubernetes Secrets Documentation](https://kubernetes.io/docs/concepts/configuration/secret/)
- [External Secrets Operator](https://external-secrets.io/)
