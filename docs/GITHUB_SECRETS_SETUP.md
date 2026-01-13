# GitHub Secrets Setup Guide

This document provides step-by-step instructions for configuring GitHub repository secrets required for the CI/CD pipelines.

## Prerequisites

- Admin access to the GitHub repository: `github.com/malenacutuli/swiss-ai-vault`
- Access to Supabase Dashboard
- Access to Swiss K8s cluster kubeconfig

## Required Secrets

### 1. Supabase Secrets

#### `SUPABASE_ACCESS_TOKEN`
**Purpose**: Authenticate with Supabase CLI for deploying Edge Functions

**How to get**:
1. Go to https://supabase.com/dashboard/account/tokens
2. Click "Generate New Token"
3. Copy the token (you won't be able to see it again)

**Value example**: `sbp_1234567890abcdef...`

---

#### `SUPABASE_PROJECT_REF`
**Purpose**: Production Supabase project reference

**How to get**:
1. Go to https://supabase.com/dashboard
2. Select your production project
3. Go to Settings → General
4. Copy "Reference ID"

**Value**: `rljnrgscmosgkcjdvlrq`

---

#### `SUPABASE_PROJECT_REF_STAGING`
**Purpose**: Staging Supabase project reference (optional)

**How to get**:
- Create a separate Supabase project for staging
- Follow same steps as production project

**Value example**: `abc123staging`

---

#### `VITE_SUPABASE_URL`
**Purpose**: Supabase project URL for frontend build

**How to get**:
1. Supabase Dashboard → Settings → API
2. Copy "Project URL"

**Value**: `https://rljnrgscmosgkcjdvlrq.supabase.co`

---

#### `VITE_SUPABASE_ANON_KEY`
**Purpose**: Supabase anonymous key for frontend

**How to get**:
1. Supabase Dashboard → Settings → API
2. Copy "anon public" key

**Value example**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

---

### 2. Swiss K8s Secrets

#### `KUBECONFIG`
**Purpose**: Access Swiss K8s cluster for deployments

**How to get**:
1. Get your kubeconfig file for the Swiss K8s cluster
2. Base64 encode it:
   ```bash
   cat ~/.kube/config | base64 | tr -d '\n'
   ```
3. Copy the output

**Value**: Base64-encoded kubeconfig file

**Security note**: This gives full access to your K8s cluster. Ensure you:
- Use a service account with limited permissions
- Rotate credentials regularly
- Store securely

---

### 3. Optional Secrets (for enhanced features)

#### `CODECOV_TOKEN`
**Purpose**: Upload test coverage reports to Codecov

**How to get**:
1. Go to https://codecov.io
2. Connect your GitHub repository
3. Copy the upload token

**Value example**: `abc123-def456-ghi789`

---

## Adding Secrets to GitHub

### Via GitHub Web Interface

1. Go to your repository: `https://github.com/malenacutuli/swiss-ai-vault`
2. Click **Settings** tab
3. In left sidebar, click **Secrets and variables** → **Actions**
4. Click **New repository secret**
5. Enter **Name** and **Value**
6. Click **Add secret**

Repeat for each secret listed above.

### Via GitHub CLI

```bash
# Install GitHub CLI if not already installed
brew install gh

# Authenticate
gh auth login

# Add secrets
gh secret set SUPABASE_ACCESS_TOKEN
# Paste value when prompted

gh secret set SUPABASE_PROJECT_REF
# Paste value when prompted

gh secret set VITE_SUPABASE_URL
# Paste value when prompted

gh secret set VITE_SUPABASE_ANON_KEY
# Paste value when prompted

gh secret set KUBECONFIG
# Paste base64-encoded value when prompted
```

## Environment-Specific Secrets

GitHub Actions supports environment-specific secrets for staging and production deployments.

### Creating Environments

1. Go to repository **Settings** → **Environments**
2. Click **New environment**
3. Name it `production`
4. Configure protection rules:
   - ✅ Required reviewers (add yourself or team)
   - ✅ Wait timer (optional: 5 minutes)
5. Click **Add environment**
6. Repeat for `staging` environment

### Adding Environment Secrets

1. Go to **Settings** → **Environments** → **production**
2. Click **Add secret**
3. Add environment-specific secrets:
   - `SUPABASE_PROJECT_REF` (production value)
   - `KUBECONFIG` (production cluster)

Repeat for staging environment with staging values.

## Verifying Secrets

### List configured secrets

```bash
gh secret list
```

### Test CI pipeline

1. Push a commit to the repository
2. Go to **Actions** tab
3. Check if the CI pipeline runs successfully
4. If secrets are missing, the pipeline will fail with clear error messages

### Test manual deployments

1. Go to **Actions** tab
2. Select **Deploy Edge Function** workflow
3. Click **Run workflow**
4. Select a function and environment
5. Click **Run workflow**
6. Check if deployment succeeds

## Security Best Practices

### 1. Secret Rotation

Rotate secrets regularly:
- **Supabase tokens**: Every 90 days
- **Kubeconfig**: Every 180 days
- **API keys**: Based on provider recommendations

### 2. Least Privilege

- Use service accounts with minimal required permissions
- For K8s, create a dedicated service account:
  ```bash
  kubectl create serviceaccount github-actions -n swissbrain
  kubectl create rolebinding github-actions-deployer \
    --clusterrole=edit \
    --serviceaccount=swissbrain:github-actions \
    --namespace=swissbrain
  ```

### 3. Audit Logs

- Review GitHub Actions logs regularly
- Monitor Supabase access logs
- Check K8s audit logs for unauthorized access

### 4. Secret Scanning

GitHub automatically scans for exposed secrets. If you accidentally commit a secret:
1. **Immediately** revoke/rotate the exposed secret
2. Remove it from git history:
   ```bash
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch path/to/file" \
     --prune-empty --tag-name-filter cat -- --all
   ```
3. Force push (after team notification)
4. Update the secret in GitHub Secrets

### 5. Dependabot Alerts

Enable Dependabot alerts:
1. **Settings** → **Code security and analysis**
2. Enable **Dependabot alerts**
3. Enable **Dependabot security updates**

## Troubleshooting

### Secret not found error

```
Error: secret SUPABASE_ACCESS_TOKEN not found
```

**Solution**: Add the secret in GitHub repository settings

### Invalid secret format

```
Error: Failed to decode KUBECONFIG
```

**Solution**: Ensure KUBECONFIG is properly base64 encoded:
```bash
cat ~/.kube/config | base64 | tr -d '\n' | pbcopy
```

### Permission denied errors

```
Error: User does not have permission to access project
```

**Solution**: Verify Supabase access token has correct permissions:
1. Generate new token with "All" access
2. Update `SUPABASE_ACCESS_TOKEN` secret

### K8s authentication failed

```
Error: The connection to the server localhost:8080 was refused
```

**Solution**:
1. Verify KUBECONFIG is correctly encoded
2. Check if kubeconfig has expired credentials
3. Regenerate kubeconfig from K8s provider

## Testing Secrets Locally

You can test secrets locally before adding to GitHub:

```bash
# Test Supabase CLI authentication
export SUPABASE_ACCESS_TOKEN="your-token"
supabase projects list

# Test kubectl with kubeconfig
echo "$KUBECONFIG_BASE64" | base64 -d > /tmp/kubeconfig
export KUBECONFIG=/tmp/kubeconfig
kubectl get pods -n swissbrain
```

## References

- [GitHub Actions Secrets Documentation](https://docs.github.com/en/actions/security-guides/encrypted-secrets)
- [Supabase CLI Authentication](https://supabase.com/docs/guides/cli/managing-config)
- [Kubernetes RBAC](https://kubernetes.io/docs/reference/access-authn-authz/rbac/)
