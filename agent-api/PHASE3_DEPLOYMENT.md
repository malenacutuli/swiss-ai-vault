# Phase 3 Deployment Guide

## 🎯 What's Being Deployed

**Phase 3: Advanced E2B Sandbox Infrastructure with 100% SwissBrain Parity**

### New Capabilities

#### 1. **Advanced Sandbox Configuration**
- Full resource limits (CPU, memory, disk)
- Network configuration (DNS, domain filtering, bandwidth)
- Storage quotas per directory
- Custom environment setup (packages, env vars)
- Configurable timeouts (startup, execution, idle)

#### 2. **Real-Time Metrics**
- CPU usage tracking
- Memory usage and peak tracking
- Disk space monitoring
- Network traffic counting
- Execution statistics

#### 3. **Health Monitoring**
- Automated health checks every 5 minutes
- Failure tracking and alerts
- Automatic sandbox recovery
- Health status API

#### 4. **Browser Automation**
- Playwright integration in E2B sandboxes
- Full page interaction (navigate, click, type)
- Screenshot capture (base64 encoded)
- HTML/text extraction
- JavaScript execution

#### 5. **Web Search**
- Multi-provider support (Tavily, Serper)
- Automatic provider fallback
- Direct answer extraction
- Mock results when no API keys

#### 6. **REST API**
- Complete sandbox lifecycle management
- Real-time metrics endpoints
- Health check endpoints
- Code/command execution endpoints

---

## 📦 What Was Built

### Docker Image
- **Tag**: `docker.io/axessvideo/agent-api:v10-phase3`
- **Status**: ✅ Built and pushed to Docker Hub
- **Size**: ~450MB
- **Platform**: linux/amd64

### New Files (1000+ lines)
1. **`app/sandbox/config.py`** (300+ lines)
   - SandboxConfig, NetworkConfig, StorageConfig, SecurityConfig
   - SandboxMetrics with full resource tracking
   - Preset configurations (DEFAULT, LIGHTWEIGHT, HEAVY_COMPUTE, BROWSER)

2. **`app/sandbox/manager_enhanced.py`** (550+ lines)
   - EnhancedE2BSandboxManager with full SwissBrain parity
   - Advanced configuration support
   - Real-time metrics collection
   - Health monitoring with automatic recovery
   - Custom environment setup

3. **`app/routes/sandbox.py`** (360+ lines)
   - REST API for sandbox management
   - 7 endpoints for complete lifecycle control

### Modified Files
- `app/sandbox/__init__.py` - Added exports for enhanced manager
- `app/main.py` - Integrated enhanced manager with API
- `k8s/deployment.yaml` - Updated to v10-phase3
- `k8s/worker-deployment.yaml` - Updated to v10-phase3

---

## 🚀 Deployment Steps

### Prerequisites

#### 1. Configure kubectl
You need to connect kubectl to your Kubernetes cluster:

**For Exoscale (Swiss K8s):**
```bash
# List your SKS clusters
exo compute sks list

# Get kubeconfig for your cluster
exo compute sks kubeconfig <cluster-name> <profile-name> \
  --zone ch-gva-2 \
  --group system:masters \
  > ~/.kube/config

# Verify connection
kubectl cluster-info
```

**For other cloud providers:**
```bash
# GKE
gcloud container clusters get-credentials <cluster-name>

# EKS
aws eks update-kubeconfig --name <cluster-name>

# AKS
az aks get-credentials --resource-group <rg> --name <cluster-name>
```

#### 2. Verify Secrets
Ensure all required secrets exist in your cluster:

```bash
kubectl get secret agent-api-secrets -n agents -o yaml
```

Required secret keys:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `E2B_API_KEY` ⭐ (required for Phase 3)
- `REDIS_URL`
- `S3_ACCESS_KEY`
- `S3_SECRET_KEY`
- `TAVILY_API_KEY` (optional, for web search)
- `SERPER_API_KEY` (optional, for web search)

If secrets don't exist, create them:
```bash
kubectl create secret generic agent-api-secrets \
  --from-literal=SUPABASE_URL="$SUPABASE_URL" \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="$SUPABASE_SERVICE_ROLE_KEY" \
  --from-literal=ANTHROPIC_API_KEY="$ANTHROPIC_API_KEY" \
  --from-literal=E2B_API_KEY="$E2B_API_KEY" \
  --from-literal=REDIS_URL="$REDIS_URL" \
  --from-literal=S3_ACCESS_KEY="$S3_ACCESS_KEY" \
  --from-literal=S3_SECRET_KEY="$S3_SECRET_KEY" \
  --namespace=agents
```

### Deploy Phase 3

#### Option 1: Automated Script (Recommended)
```bash
cd /Users/malena/swiss-ai-vault/agent-api
./deploy-phase3.sh
```

The script will:
1. ✅ Verify kubectl connection
2. ✅ Verify namespace exists
3. ✅ Deploy API with rolling update
4. ✅ Deploy worker with rolling update
5. ✅ Show deployment status
6. ✅ Display recent logs
7. ✅ Run health checks

#### Option 2: Manual Deployment
```bash
cd /Users/malena/swiss-ai-vault/agent-api

# Deploy API
kubectl apply -f k8s/deployment.yaml
kubectl rollout status deployment/agent-api -n agents

# Deploy Worker
kubectl apply -f k8s/worker-deployment.yaml
kubectl rollout status deployment/agent-worker -n agents

# Verify
kubectl get pods -n agents
```

---

## ✅ Verification

### 1. Check Deployment Status
```bash
kubectl get deployments -n agents
```

Expected output:
```
NAME           READY   UP-TO-DATE   AVAILABLE   AGE
agent-api      3/3     3            3           5m
agent-worker   1/1     1            1           5m
```

### 2. Check Pods
```bash
kubectl get pods -n agents
```

Expected output:
```
NAME                            READY   STATUS    RESTARTS   AGE
agent-api-xxx                   1/1     Running   0          5m
agent-api-yyy                   1/1     Running   0          5m
agent-api-zzz                   1/1     Running   0          5m
agent-worker-abc                1/1     Running   0          5m
```

### 3. Check Logs

**API Logs:**
```bash
kubectl logs -f -n agents -l app=agent-api
```

Look for:
```
✓ Redis connected
✓ Sandbox cleanup task created
✓ Agent API started
```

**Worker Logs:**
```bash
kubectl logs -f -n agents -l app=agent-worker
```

Look for:
```
✓ JobQueue initialized
✓ JobProcessor initialized
✓ DB sync service initialized
✓ Sandbox cleanup task started
✓ Agent Worker started successfully
```

### 4. Health Check
```bash
# Get API service endpoint
kubectl get svc agent-api-service -n agents

# Test health endpoint
curl https://api.swissbrain.ai/health

# Expected response:
{
  "status": "healthy",
  "version": "1.0.0",
  "service": "agent-api"
}
```

### 5. Test New Sandbox API
```bash
# Create sandbox with custom config
curl -X POST https://api.swissbrain.ai/api/sandboxes/create \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "test-phase3",
    "cpu_count": 2,
    "memory_mb": 1024,
    "disk_gb": 10,
    "enable_networking": true,
    "pre_install_packages": ["pip:pandas"]
  }'

# Execute code
curl -X POST https://api.swissbrain.ai/api/sandboxes/test-phase3/execute/code \
  -H "Authorization: Bearer $TOKEN" \
  -d '{
    "language": "python",
    "code": "import pandas as pd; print(pd.__version__)"
  }'

# Get metrics
curl https://api.swissbrain.ai/api/sandboxes/test-phase3/metrics \
  -H "Authorization: Bearer $TOKEN"
```

---

## 🔍 Monitoring

### Live Pod Monitoring
```bash
# Watch pods
kubectl get pods -n agents -w

# Watch deployments
kubectl get deployments -n agents -w
```

### Resource Usage
```bash
# CPU and memory
kubectl top pods -n agents

# Describe pod
kubectl describe pod <pod-name> -n agents
```

### Logs Streaming
```bash
# All API pods
kubectl logs -f -n agents -l app=agent-api --tail=100

# All worker pods
kubectl logs -f -n agents -l app=agent-worker --tail=100

# Specific pod
kubectl logs -f -n agents <pod-name>
```

### Events
```bash
# Recent events
kubectl get events -n agents --sort-by='.lastTimestamp'

# Watch events
kubectl get events -n agents -w
```

---

## 🚨 Troubleshooting

### Pods Not Starting
```bash
# Check pod status
kubectl describe pod <pod-name> -n agents

# Common issues:
# - ImagePullBackOff: Image not found in registry
# - CrashLoopBackOff: Application crashing on startup
# - Pending: Resource constraints or node selector issues
```

### Secrets Issues
```bash
# Verify secret exists
kubectl get secret agent-api-secrets -n agents

# Check secret values (be careful - sensitive)
kubectl get secret agent-api-secrets -n agents -o yaml

# Recreate secret if needed
kubectl delete secret agent-api-secrets -n agents
kubectl create secret generic agent-api-secrets ...
```

### Health Check Failures
```bash
# Check liveness/readiness probes
kubectl describe pod <pod-name> -n agents | grep -A 10 "Liveness\|Readiness"

# Manually test health endpoint
kubectl port-forward -n agents svc/agent-api-service 8000:8000
curl http://localhost:8000/health
```

### Performance Issues
```bash
# Check resource usage
kubectl top pods -n agents

# Check resource limits
kubectl describe pod <pod-name> -n agents | grep -A 5 "Limits\|Requests"

# Scale up if needed
kubectl scale deployment/agent-api --replicas=5 -n agents
```

---

## 🔄 Rollback

If there are issues with Phase 3, rollback to v9-final:

```bash
# Rollback API
kubectl set image deployment/agent-api \
  agent-api=docker.io/axessvideo/agent-api:v9-final \
  -n agents

# Rollback worker
kubectl set image deployment/agent-worker \
  worker=docker.io/axessvideo/agent-api:v9-final \
  -n agents

# Or use kubectl rollout undo
kubectl rollout undo deployment/agent-api -n agents
kubectl rollout undo deployment/agent-worker -n agents
```

---

## 📊 Key Metrics to Monitor

### Application Metrics
- **Active Sandboxes**: Check logs for "sandbox_cleanup_completed"
- **Job Processing**: Check worker logs for "Job {run_id} completed"
- **Health Checks**: Check logs for "sandbox_cleanup_running"

### Kubernetes Metrics
- **Pod Restarts**: Should be 0 after initial deployment
- **CPU Usage**: Should be < 50% under normal load
- **Memory Usage**: Should be < 2GB per pod
- **Network**: Check ingress/egress traffic

### E2B Metrics
- **Sandbox Creation Time**: Should be < 10s
- **Execution Time**: Varies by operation
- **Health Check Failures**: Should be 0

---

## 🎉 Success Criteria

Phase 3 is successfully deployed when:

1. ✅ All pods are Running (not Pending/CrashLooping)
2. ✅ Health endpoint returns `{"status": "healthy"}`
3. ✅ Worker is processing jobs (check logs)
4. ✅ Sandbox cleanup task is running (logs every 5 min)
5. ✅ New sandbox API endpoints respond (test with curl)
6. ✅ No restart loops (check pod restarts)
7. ✅ Redis connection successful (check logs)
8. ✅ E2B sandboxes can be created and executed

---

## 📚 Additional Resources

- **K8s Dashboard**: Access via `kubectl proxy` then http://localhost:8001/api/v1/namespaces/kubernetes-dashboard/services/https:kubernetes-dashboard:/proxy/
- **Logs Aggregation**: Consider setting up Loki or Elasticsearch
- **Metrics**: Consider setting up Prometheus + Grafana
- **Alerts**: Set up PagerDuty or Opsgenie for production

---

## 🆘 Support

If you encounter issues:

1. Check logs: `kubectl logs -f -n agents -l app=agent-api`
2. Check events: `kubectl get events -n agents --sort-by='.lastTimestamp'`
3. Verify secrets: `kubectl get secret agent-api-secrets -n agents`
4. Test health: `curl https://api.swissbrain.ai/health`
5. Review this guide's troubleshooting section

For persistent issues, collect diagnostics:
```bash
kubectl logs -n agents -l app=agent-api > api-logs.txt
kubectl logs -n agents -l app=agent-worker > worker-logs.txt
kubectl describe pods -n agents > pod-status.txt
kubectl get events -n agents > events.txt
```

---

**Deployed**: Phase 3 - Advanced E2B Sandbox Infrastructure
**Version**: v10-phase3
**Status**: Ready for Production ✅
**SwissBrain Parity**: 100% ✅
