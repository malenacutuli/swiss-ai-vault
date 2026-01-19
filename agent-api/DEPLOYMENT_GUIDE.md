# Agent API - Complete Deployment Guide

## Prerequisites

### 1. Configure kubectl Access

Download kubeconfig from Exoscale Console:
1. Go to https://portal.exoscale.com/
2. Navigate to: **Compute** → **Kubernetes**
3. Select cluster **in ch-gva-2 zone**
4. Click **"Download Kubeconfig"**
5. Save to: `/Users/malena/.kube/swiss-k8s-config`

Set environment variable:
```bash
export KUBECONFIG=/Users/malena/.kube/swiss-k8s-config
kubectl cluster-info
# Should show: Kubernetes control plane is running at...
```

### 2. Get Required Credentials

Collect these values before starting:

| Secret | Where to Get It |
|--------|-----------------|
| **SUPABASE_SERVICE_ROLE_KEY** | Supabase Dashboard → Project ghmmdochvlrnwbruyrqk → Settings → API → service_role key |
| **ANTHROPIC_API_KEY** | Anthropic Dashboard → https://console.anthropic.com/settings/keys |
| **REDIS_URL** | Upstash Dashboard → Select Redis database → REST API section |

### 3. Setup Container Registry

Choose one:

**Option A: Docker Hub**
```bash
# Update in deploy.sh (line 6) and k8s/deployment.yaml (line 27)
REGISTRY="docker.io/yourusername"
docker login
```

**Option B: Private Registry**
```bash
# If you have registry.swissvault.ai
REGISTRY="registry.swissvault.ai"
docker login registry.swissvault.ai
```

---

## Deployment Steps

### Step 1: Apply Database Migrations

```bash
cd /Users/malena/swiss-ai-vault
supabase db push --db-url "postgresql://postgres:[password]@db.[project-id].supabase.co:5432/postgres"
```

Or manually apply migrations from Supabase SQL Editor:
1. Go to: https://supabase.com/dashboard/project/ghmmdochvlrnwbruyrqk/editor
2. Run each migration file from `/Users/malena/swiss-ai-vault/supabase/migrations/`:
   - `20260113000001_agent_runs.sql`
   - `20260113000002_agent_steps.sql`
   - `20260113000003_agent_messages.sql`
   - `20260113000004_agent_artifacts.sql`
   - `20260113000005_agent_run_connectors.sql`
   - `20260113000006_agent_task_queue.sql`
   - `20260113000007_agent_task_logs.sql`

### Step 2: Update Registry Settings

```bash
cd /Users/malena/swiss-ai-vault/agent-api

# Edit deploy.sh (line 6)
# Change: REGISTRY="registry.your-domain.com"
# To: REGISTRY="docker.io/yourusername"  # or your registry

# Edit k8s/deployment.yaml (line 27)
# Change: image: registry.your-domain.com/agent-api:latest
# To: image: docker.io/yourusername/agent-api:latest
```

### Step 3: Setup K8s Secrets

```bash
cd /Users/malena/swiss-ai-vault/agent-api
./setup-secrets.sh
```

Enter when prompted:
- **SUPABASE_URL**: `https://auth.swissvault.ai`
- **SUPABASE_SERVICE_ROLE_KEY**: (from Supabase dashboard)
- **ANTHROPIC_API_KEY**: (from Anthropic dashboard)
- **REDIS_URL**: (from Upstash dashboard)

### Step 4: Build and Deploy

```bash
./deploy.sh
```

This will:
1. Build Docker image
2. Push to registry
3. Deploy to K8s
4. Wait for rollout
5. Show status

### Step 5: Verify Deployment

```bash
# Check pods
kubectl get pods -n agents

# Expected output:
# NAME                         READY   STATUS    RESTARTS   AGE
# agent-api-xxxxxxxxxx-xxxxx   1/1     Running   0          1m

# Check logs
kubectl logs -f deployment/agent-api -n agents

# Test API
curl https://api.swissbrain.ai/health
# Should return: {"status":"healthy","version":"1.0.0","service":"agent-api"}
```

---

## Manual Deployment (If Scripts Fail)

### 1. Build Docker Image

```bash
cd /Users/malena/swiss-ai-vault/agent-api
docker build -t docker.io/yourusername/agent-api:latest .
```

### 2. Push to Registry

```bash
docker push docker.io/yourusername/agent-api:latest
```

### 3. Create Namespace

```bash
kubectl create namespace agents
```

### 4. Create Secrets

```bash
kubectl create secret generic agent-api-secrets \
  --from-literal=SUPABASE_URL="https://auth.swissvault.ai" \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="your-key-here" \
  --from-literal=ANTHROPIC_API_KEY="your-key-here" \
  --from-literal=REDIS_URL="your-redis-url-here" \
  --namespace=agents
```

### 5. Deploy Manifests

```bash
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

### 6. Wait for Rollout

```bash
kubectl rollout status deployment/agent-api -n agents --timeout=5m
```

---

## Testing

### Test 1: Health Check

```bash
curl https://api.swissbrain.ai/health
```

**Expected**:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "service": "agent-api"
}
```

### Test 2: Create Agent Run

```bash
# Get JWT token first
SIGNIN=$(curl -s -X POST "https://rljnrgscmosgkcjdvlrq.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{"email":"your@email.com","password":"your-password"}')

TOKEN=$(echo "$SIGNIN" | jq -r '.access_token')

# Create agent run
curl -X POST https://api.swissbrain.ai/agent/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"create","prompt":"Write hello world in Python"}'
```

**Expected**:
```json
{
  "run_id": "uuid-here",
  "status": "created",
  "message": "Agent run created successfully"
}
```

### Test 3: Get Status

```bash
curl -X POST https://api.swissbrain.ai/agent/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"run_id":"uuid-from-above"}'
```

### Test 4: API Documentation

Open in browser:
```
https://api.swissbrain.ai/docs
```

---

## Troubleshooting

### Issue: Pods not starting

```bash
# Check pod status
kubectl get pods -n agents

# Describe pod
kubectl describe pod <pod-name> -n agents

# Check events
kubectl get events -n agents --sort-by='.lastTimestamp' | tail -20
```

**Common causes**:
- Image pull error → Check registry credentials
- CrashLoopBackOff → Check logs with `kubectl logs`
- Pending → Check resource availability

### Issue: 404 on api.swissbrain.ai

```bash
# Check ingress
kubectl describe ingress agent-api-ingress -n agents

# Check service endpoints
kubectl get endpoints agent-api -n agents

# Check if pods are ready
kubectl get pods -n agents
```

**Solutions**:
- Wait 1-2 minutes for DNS propagation
- Verify ingress controller is running: `kubectl get pods -n ingress-nginx`
- Check if TLS certificate is ready: `kubectl get certificate -n agents`

### Issue: Secrets not found

```bash
# List secrets
kubectl get secrets -n agents

# Recreate secrets
./setup-secrets.sh
```

### Issue: Image pull error

```bash
# Check image exists
docker pull docker.io/yourusername/agent-api:latest

# Create image pull secret (if using private registry)
kubectl create secret docker-registry regcred \
  --docker-server=registry.swissvault.ai \
  --docker-username=your-username \
  --docker-password=your-password \
  --namespace=agents

# Update deployment to use imagePullSecrets
```

---

## Scaling

### Manual Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment agent-api --replicas=5 -n agents
```

### Auto-Scaling

Create HPA:
```bash
kubectl autoscale deployment agent-api \
  --cpu-percent=70 \
  --min=3 \
  --max=10 \
  -n agents
```

---

## Monitoring

### View Logs

```bash
# Follow logs from all pods
kubectl logs -f deployment/agent-api -n agents

# Logs from specific pod
kubectl logs <pod-name> -n agents

# Logs from previous crash
kubectl logs --previous <pod-name> -n agents
```

### Resource Usage

```bash
# CPU/Memory usage
kubectl top pods -n agents

# Node resources
kubectl top nodes
```

### Check Metrics

```bash
# Deployment status
kubectl get deployment agent-api -n agents

# Pod status
kubectl get pods -n agents -w
```

---

## Next Steps

Once deployed successfully:

1. ✅ **Frontend Integration**: Update frontend to call `https://api.swissbrain.ai`
2. ⚠️  **Complete Agent Logic**: Port TypeScript modules to Python (planner, supervisor, tools)
3. ⚠️  **K8s Job Spawning**: Implement tool execution in isolated pods
4. ⚠️  **Monitoring Setup**: Add Prometheus/Grafana
5. ⚠️  **Load Testing**: Test with concurrent requests

---

## Support

For issues:
1. Check logs: `kubectl logs -f deployment/agent-api -n agents`
2. Check events: `kubectl get events -n agents`
3. Review README: `/Users/malena/swiss-ai-vault/agent-api/README.md`
4. Review manifests: `/Users/malena/swiss-ai-vault/agent-api/k8s/`

---

**Last Updated**: 2026-01-13
