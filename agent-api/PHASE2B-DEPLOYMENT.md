# Phase 2B Deployment Guide

## Overview

Phase 2B transforms the Swiss Agent API from in-process execution to a distributed, fault-tolerant architecture with:

- **Redis job queue** replacing FastAPI BackgroundTasks
- **Separate worker process** for agent execution
- **K8s job spawning infrastructure** (tools remain mocked initially)
- **S3 workspace storage** for persistent file operations (Exoscale)
- **Redis pub/sub log streaming** for real-time updates

## Architecture

```
API (FastAPI)                    Worker Process              K8s Jobs (Future)
─────────────                    ──────────────              ─────────────────
┌─────────────┐                 ┌──────────────┐            ┌──────────────┐
│ /execute    │  LPUSH          │ BRPOP queue  │   spawn    │ Shell/Code   │
│  → Enqueue  │─────────────────>│  → Process   │───────────>│ Executors    │
│             │  jobs:pending   │  → Planner   │  (future)  │ (S3 mount)   │
└─────────────┘                 │  → Supervisor│            └──────────────┘
                                 └──────────────┘
┌─────────────┐                        │
│ /logs SSE   │  SUBSCRIBE              │ PUBLISH
│  → Stream   │<────────────────────────┘ logs
└─────────────┘  agent:logs:{run_id}
```

## What Changed

### New Components

#### Redis Infrastructure (`app/redis/`)
- **clients.py**: Dual Redis client setup
  - Standard `redis` client for worker (persistent connections)
  - Upstash Redis client for API (serverless-optimized)
- **publisher.py**: Publish logs to Redis pub/sub
- **subscriber.py**: Subscribe to log streams for SSE

#### Worker Process (`app/worker/`)
- **main.py**: Worker entry point with SIGTERM/SIGINT handling
- **job_queue.py**: Redis queue management with retry/DLQ logic
- **job_processor.py**: Job execution (planner → supervisor)

#### Storage (`app/storage/`)
- **s3_workspace.py**: S3 workspace operations using Exoscale
  - Endpoint: `https://sos-ch-gva-2.exo.io`
  - Bucket: `swissbrain-workspaces`
  - Region: `ch-gva-2`

#### K8s Infrastructure (`app/k8s/`)
- **client.py**: K8s client initialization
- **executor.py**: K8s job spawner (infrastructure only, not called yet)

### Modified Components

#### API Routes
- **routes/execute.py**:
  - `handle_start` now enqueues to Redis instead of BackgroundTasks
- **routes/logs.py**:
  - `handle_streaming` now uses Redis pub/sub instead of database polling

#### Agent Core
- **agent/supervisor.py**:
  - All logging methods now publish to both DB (persistence) and Redis (real-time)
- **agent/tools/router.py**:
  - File operations now use S3 workspace
  - Shell/code tools remain mocked (infrastructure ready)

#### Configuration
- **config.py**: Added S3 settings and worker settings
- **main.py**: Initialize Redis clients on startup

### K8s Manifests

#### worker-deployment.yaml
- Single replica worker deployment
- Uses `agent-api-sa` service account
- Command: `python -m app.worker.main`
- Environment variables include S3 configuration
- Resources: 500m-2000m CPU, 1Gi-4Gi memory

#### resource-quota.yaml
- Limits for future tool execution jobs:
  - Max 50 concurrent jobs
  - Total 25 CPUs
  - Total 50GB memory

## Prerequisites

### 1. Exoscale S3 Credentials

You need access credentials for the Exoscale S3 bucket:

```bash
export S3_ACCESS_KEY="your-exoscale-access-key"
export S3_SECRET_KEY="your-exoscale-secret-key"
```

The bucket `swissbrain-workspaces` should already exist in the `ch-gva-2` (Geneva) region.

### 2. Kubernetes Access

Ensure kubectl is configured to access the Swiss K8s cluster:

```bash
kubectl cluster-info
kubectl get namespaces | grep agents
```

### 3. Docker Image

The Phase 2B Docker image is already built and pushed:

```
docker.io/axessvideo/agent-api:phase2b
```

## Deployment Steps

### Option A: Automated Deployment

Run the deployment script:

```bash
cd /Users/malena/swiss-ai-vault/agent-api

# Set S3 credentials
export S3_ACCESS_KEY="your-exoscale-access-key"
export S3_SECRET_KEY="your-exoscale-secret-key"

# Run deployment
./deploy-phase2b.sh
```

This script will:
1. Update K8s secrets with S3 credentials
2. Apply resource quota
3. Deploy worker
4. Update API deployment to phase2b image
5. Wait for rollouts to complete
6. Verify deployments

### Option B: Manual Deployment

#### Step 1: Update Secrets

```bash
kubectl create secret generic agent-api-secrets \
  --from-literal=S3_ACCESS_KEY="$S3_ACCESS_KEY" \
  --from-literal=S3_SECRET_KEY="$S3_SECRET_KEY" \
  --namespace=agents \
  --dry-run=client -o yaml | kubectl apply -f -
```

#### Step 2: Deploy Worker

```bash
kubectl apply -f k8s/resource-quota.yaml
kubectl apply -f k8s/worker-deployment.yaml
kubectl rollout status deployment/agent-worker -n agents
```

#### Step 3: Update API

```bash
kubectl set image deployment/agent-api \
  agent-api=docker.io/axessvideo/agent-api:phase2b \
  -n agents
kubectl rollout status deployment/agent-api -n agents
```

#### Step 4: Verify

```bash
kubectl get deployments -n agents
kubectl get pods -n agents
kubectl logs -f deployment/agent-worker -n agents
```

## Verification

### Automated Testing

Run the verification script:

```bash
# Set API credentials
export API_URL="https://api.swissbrain.ai"
export TOKEN="your-auth-token"

# Run tests
./verify-phase2b.sh
```

This will:
1. Check deployments and pods
2. Create a test agent run
3. Verify job enqueueing to Redis
4. Monitor worker processing
5. Test log streaming via Redis pub/sub
6. Verify S3 workspace configuration

### Manual Testing

#### 1. Create and Start a Run

```bash
# Create run
curl -X POST https://api.swissbrain.ai/agent/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "prompt": "List files and create a test.txt file"
  }'

# Start run (enqueues to Redis)
curl -X POST https://api.swissbrain.ai/agent/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "start",
    "run_id": "<run_id>"
  }'
```

#### 2. Monitor Worker

```bash
# Watch worker logs
kubectl logs -f deployment/agent-worker -n agents

# Check queue depth
kubectl exec -n agents deployment/agent-worker -- \
  redis-cli -u $REDIS_URL LLEN jobs:pending
```

#### 3. Test Log Streaming

```bash
# Stream logs (Redis pub/sub)
curl -N https://api.swissbrain.ai/agent/logs/<run_id>/stream \
  -H "Authorization: Bearer $TOKEN"
```

#### 4. Verify S3 Workspace

```bash
# Check S3 environment variables in worker
kubectl exec -n agents deployment/agent-worker -- env | grep S3

# Expected output:
# S3_ENDPOINT=https://sos-ch-gva-2.exo.io
# S3_WORKSPACE_BUCKET=swissbrain-workspaces
# S3_REGION=ch-gva-2
# S3_ACCESS_KEY=<redacted>
# S3_SECRET_KEY=<redacted>
```

## Monitoring

### Worker Health

```bash
# Worker logs
kubectl logs -f deployment/agent-worker -n agents

# Worker metrics
kubectl top pod -n agents -l app=agent-worker
```

### Redis Queue Status

```bash
# Get Redis URL from secret
REDIS_URL=$(kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.REDIS_URL}' | base64 -d)

# Check queue lengths
kubectl exec -n agents deployment/agent-worker -- redis-cli -u $REDIS_URL LLEN jobs:pending
kubectl exec -n agents deployment/agent-worker -- redis-cli -u $REDIS_URL LLEN jobs:processing
kubectl exec -n agents deployment/agent-worker -- redis-cli -u $REDIS_URL LLEN jobs:retry
kubectl exec -n agents deployment/agent-worker -- redis-cli -u $REDIS_URL LLEN jobs:failed
```

### S3 Workspace

```bash
# List workspaces using AWS CLI with Exoscale endpoint
aws s3 ls s3://swissbrain-workspaces/users/ \
  --endpoint-url https://sos-ch-gva-2.exo.io \
  --region ch-gva-2
```

## Rollback

If issues occur, rollback to previous version:

```bash
# Rollback API
kubectl rollout undo deployment/agent-api -n agents

# Scale down worker
kubectl scale deployment agent-worker --replicas=0 -n agents
```

## Troubleshooting

### Worker Not Processing Jobs

```bash
# Check worker logs
kubectl logs deployment/agent-worker -n agents --tail=100

# Check Redis connectivity
kubectl exec -n agents deployment/agent-worker -- \
  redis-cli -u $REDIS_URL PING

# Check for jobs in queue
kubectl exec -n agents deployment/agent-worker -- \
  redis-cli -u $REDIS_URL LLEN jobs:pending
```

### S3 Access Issues

```bash
# Verify S3 credentials are set
kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.S3_ACCESS_KEY}' | base64 -d
kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.S3_SECRET_KEY}' | base64 -d

# Test S3 access from worker pod
kubectl exec -n agents deployment/agent-worker -- \
  python -c "
import boto3
from app.config import get_settings
settings = get_settings()
s3 = boto3.client('s3',
    endpoint_url=settings.s3_endpoint,
    region_name=settings.s3_region,
    aws_access_key_id=settings.s3_access_key,
    aws_secret_access_key=settings.s3_secret_key
)
print(s3.list_buckets())
"
```

### Log Streaming Not Working

```bash
# Check Redis pub/sub
kubectl exec -n agents deployment/agent-worker -- \
  redis-cli -u $REDIS_URL PUBSUB CHANNELS "agent:logs:*"

# Test publishing
kubectl exec -n agents deployment/agent-worker -- \
  redis-cli -u $REDIS_URL PUBLISH "agent:logs:test" "test message"
```

## Next Steps (Phase 2B.2)

After Phase 2B is stable and verified:

1. **Enable K8s Job Spawning**
   - Activate shell tool execution via K8s jobs
   - Activate code tool execution via K8s jobs

2. **Add Browser Automation**
   - Implement Playwright-based browser tool
   - Add screenshot capture functionality

3. **Enhance Workspace**
   - Add workspace persistence across job runs
   - Implement workspace cleanup policies

4. **Scale Worker**
   - Implement Horizontal Pod Autoscaler
   - Add worker metrics and monitoring

5. **Tool Improvements**
   - Implement web search tool (Brave/Google API)
   - Add connector implementations (GitHub, Linear, etc.)

## Support

For issues or questions:
- Check worker logs: `kubectl logs deployment/agent-worker -n agents`
- Check API logs: `kubectl logs deployment/agent-api -n agents`
- Monitor Redis queue depths
- Verify S3 connectivity

## Summary

Phase 2B introduces a distributed, fault-tolerant architecture with:
- ✅ Redis-based job queue (replacing BackgroundTasks)
- ✅ Separate worker process (independent scaling)
- ✅ Real-time log streaming (Redis pub/sub)
- ✅ Persistent workspace storage (Exoscale S3)
- ✅ K8s job execution infrastructure (ready for Phase 2B.2)
- ✅ Retry logic and dead letter queue
- ✅ Graceful shutdown handling
- ✅ Production-ready monitoring and observability

The system is now ready for production deployment and can scale horizontally as needed.
