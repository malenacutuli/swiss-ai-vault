# Phase 2B Quick Start Guide

## Prerequisites

✅ Docker image built: `docker.io/axessvideo/agent-api:phase2b`
✅ All code written and tested
⏸️ Needs: K8s cluster access + Exoscale S3 credentials

## 3-Step Deployment

### Step 1: Get S3 Credentials

Obtain Exoscale S3 credentials for the `swissbrain-workspaces` bucket in Geneva (ch-gva-2):

```bash
export S3_ACCESS_KEY="your-exoscale-access-key"
export S3_SECRET_KEY="your-exoscale-secret-key"
```

### Step 2: Deploy

```bash
./deploy-phase2b.sh
```

This will:
- Update K8s secrets with S3 credentials
- Deploy worker process (1 replica)
- Update API to phase2b image
- Apply resource quotas
- Wait for rollouts

**Expected time**: 2-3 minutes

### Step 3: Verify

```bash
export TOKEN="your-api-token"
./verify-phase2b.sh
```

This will:
- Create test agent run
- Verify Redis queueing
- Test log streaming
- Check S3 workspace

**Expected time**: 30 seconds

## What Changed

| Component | Before | After |
|-----------|--------|-------|
| **Job Queue** | FastAPI BackgroundTasks | Redis queue (persistent) |
| **Execution** | In-process | Separate worker process |
| **Log Streaming** | DB polling (1s) | Redis pub/sub (real-time) |
| **File Storage** | In-memory | Exoscale S3 (persistent) |
| **Scaling** | Single process | Horizontal worker scaling |

## Architecture

```
User Request
    ↓
API Server (FastAPI)
    ↓ enqueue job
Redis Queue (jobs:pending)
    ↓ BRPOP
Worker Process
    ↓ execute agent
Planner → Supervisor → Tools
    ↓ publish logs
Redis Pub/Sub (agent:logs:{run_id})
    ↓ subscribe
API Server → User (SSE stream)

Files stored in: S3 (swissbrain-workspaces)
```

## Monitoring

```bash
# Watch worker
kubectl logs -f deployment/agent-worker -n agents

# Watch API
kubectl logs -f deployment/agent-api -n agents

# Check queue
redis-cli LLEN jobs:pending

# Check pods
kubectl get pods -n agents
```

## Testing

```bash
# Create run
curl -X POST https://api.swissbrain.ai/agent/execute \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "create", "prompt": "Test"}'

# Start run (enqueues to Redis)
curl -X POST https://api.swissbrain.ai/agent/execute \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action": "start", "run_id": "<run_id>"}'

# Stream logs (real-time via Redis pub/sub)
curl -N https://api.swissbrain.ai/agent/logs/<run_id>/stream \
  -H "Authorization: Bearer $TOKEN"
```

## Rollback

If issues occur:

```bash
kubectl rollout undo deployment/agent-api -n agents
kubectl scale deployment agent-worker --replicas=0 -n agents
```

## Files

- `deploy-phase2b.sh` - Automated deployment
- `verify-phase2b.sh` - Automated testing
- `PHASE2B-DEPLOYMENT.md` - Full deployment guide
- `PHASE2B-CHANGES.md` - Complete change list

## Support

**Worker not processing jobs?**
```bash
kubectl logs deployment/agent-worker -n agents
redis-cli LLEN jobs:pending
```

**S3 access issues?**
```bash
kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.S3_ACCESS_KEY}' | base64 -d
```

**Logs not streaming?**
```bash
kubectl exec -n agents deployment/agent-worker -- redis-cli -u $REDIS_URL PING
```

## Next Steps

After Phase 2B is stable:
1. Enable K8s job spawning for shell/code tools
2. Add browser automation (Playwright)
3. Scale worker horizontally (HPA)
4. Add monitoring and alerts

---

**Status**: ✅ Ready to deploy
**Image**: `docker.io/axessvideo/agent-api:phase2b`
**Docs**: See `PHASE2B-DEPLOYMENT.md` for details
