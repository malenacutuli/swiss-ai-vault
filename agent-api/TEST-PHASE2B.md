# Phase 2B Testing Guide

## Deployment Status ✅

**Successfully Deployed:**
- API Server: 3/3 pods running (`phase2b` image)
- Worker Process: 1/1 pod running (`phase2b` image)
- Redis Queue: Connected (with DNS retry logic)
- S3 Workspace: Configured (Exoscale Geneva)
- Resource Quotas: Applied

## Testing the System

### Option 1: Test via API with User Token

If you have a user JWT token from logging into SwissVault:

```bash
# Set your token
export TOKEN="your-jwt-token-here"

# Create a run
RUN_RESPONSE=$(curl -X POST https://api.swissbrain.ai/agent/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "create",
    "prompt": "Test Phase 2B: List files in workspace and create a hello.txt file with Phase 2B working!"
  }')

echo "$RUN_RESPONSE"
RUN_ID=$(echo "$RUN_RESPONSE" | jq -r '.run_id')

# Start the run (enqueues to Redis)
curl -X POST https://api.swissbrain.ai/agent/execute \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"action\": \"start\",
    \"run_id\": \"$RUN_ID\"
  }"

# Stream logs in real-time (Redis pub/sub)
curl -N https://api.swissbrain.ai/agent/logs/$RUN_ID/stream \
  -H "Authorization: Bearer $TOKEN"
```

### Option 2: Test via Database (Direct)

If you have database access:

```bash
# Connect to one of the API pods
kubectl exec -it deployment/agent-api -n agents -- python

# Then in Python:
from supabase import create_client
from redis import Redis
import json
from datetime import datetime

# Create run
supabase = create_client(
    'https://rljnrgscmosgkcjdvlrq.supabase.co',
    'SERVICE_ROLE_KEY_HERE'
)

test_user_id = '00000000-0000-0000-0000-000000000001'
result = supabase.table('agent_runs').insert({
    'user_id': test_user_id,
    'prompt': 'Test Phase 2B deployment',
    'status': 'queued'
}).execute()

run_id = result.data[0]['id']
print(f'Created run: {run_id}')

# Enqueue to Redis
redis = Redis.from_url(
    'rediss://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379',
    decode_responses=True,
    ssl_cert_reqs=None
)

redis.lpush('jobs:pending', json.dumps({
    'run_id': run_id,
    'enqueued_at': datetime.utcnow().isoformat(),
    'priority': 0,
    'retry_count': 0
}))

print(f'Enqueued! Queue depth: {redis.llen("jobs:pending")}')
```

### Option 3: Monitor Existing Activity

Watch the worker processing jobs:

```bash
# Monitor worker logs
kubectl logs -f deployment/agent-worker -n agents

# Check queue status
kubectl exec deployment/agent-worker -n agents -- \
  python -c "
from redis import Redis
r = Redis.from_url(
    'rediss://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379',
    decode_responses=True,
    ssl_cert_reqs=None
)
print(f'Pending: {r.llen(\"jobs:pending\")}')
print(f'Processing: {r.llen(\"jobs:processing\")}')
print(f'Retry: {r.llen(\"jobs:retry\")}')
print(f'Failed: {r.llen(\"jobs:failed\")}')
"

# Check API pods
kubectl get pods -n agents -l app=agent-api

# Check worker pods
kubectl get pods -n agents -l app=agent-worker
```

## What to Expect

### Successful Run Flow:

1. **Job Created**: Run created in database with status `"created"`
2. **Job Queued**: Status updated to `"queued"`, job added to Redis `jobs:pending`
3. **Worker Picks Up**: Worker dequeues job via `BRPOP`, moves to `jobs:processing`
4. **Planning Phase**: Agent planner creates execution plan
5. **Execution Phase**: Agent supervisor executes plan with tools
6. **Real-time Logs**: Logs published to Redis pub/sub channel `agent:logs:{run_id}`
7. **Completion**: Run status updated to `"completed"` or `"failed"`
8. **Queue Cleanup**: Job removed from `jobs:processing`

### Redis Queue States:

- `jobs:pending` - New jobs waiting to be processed
- `jobs:high_priority` - Priority jobs (processed first)
- `jobs:processing` - Currently being processed (for crash recovery)
- `jobs:retry` - Failed jobs awaiting retry
- `jobs:failed` - Dead letter queue (max retries exceeded)

## Monitoring Commands

```bash
# Watch all pods
kubectl get pods -n agents -w

# Follow worker logs
kubectl logs -f deployment/agent-worker -n agents

# Follow API logs
kubectl logs -f deployment/agent-api -n agents

# Check resource usage
kubectl top pods -n agents

# Check resource quotas
kubectl get resourcequota -n agents

# Check deployments
kubectl get deployments -n agents -o wide
```

## Troubleshooting

### Worker Not Processing Jobs

```bash
# Check worker status
kubectl get pods -n agents -l app=agent-worker

# Check worker logs for errors
kubectl logs deployment/agent-worker -n agents --tail=100

# Verify Redis connectivity
kubectl exec deployment/agent-worker -n agents -- \
  python -c "from redis import Redis; r = Redis.from_url('REDIS_URL', ssl_cert_reqs=None); r.ping(); print('Connected!')"
```

### Jobs Stuck in Queue

```bash
# Check queue depths
kubectl exec deployment/agent-worker -n agents -- \
  python -c "
from redis import Redis
r = Redis.from_url('REDIS_URL', decode_responses=True, ssl_cert_reqs=None)
print(f'Pending: {r.llen(\"jobs:pending\")}')
print(f'Processing: {r.llen(\"jobs:processing\")}')
"

# Restart worker if needed
kubectl rollout restart deployment/agent-worker -n agents
```

### S3 Access Issues

```bash
# Verify S3 credentials in secret
kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.S3_ACCESS_KEY}' | base64 -d

# Test S3 access from worker
kubectl exec deployment/agent-worker -n agents -- \
  python -c "
from app.storage.s3_workspace import S3Workspace
ws = S3Workspace('test-user', 'test-run')
print('S3 workspace initialized successfully')
"
```

## Success Indicators

✅ **Worker is healthy**: `kubectl get pods -n agents -l app=agent-worker` shows `1/1 Running`

✅ **Redis connected**: Worker logs show "Redis connection established successfully"

✅ **Queue processing**: Jobs move from `jobs:pending` to `jobs:processing` to completion

✅ **Real-time logs**: Log streaming via `/agent/logs/{run_id}/stream` shows live updates

✅ **S3 workspace**: File operations succeed in tools

## Phase 2B Architecture Verified

```
User Request
    ↓
API (3 pods) → Redis Queue (jobs:pending)
    ↓
Worker (1 pod) → BRPOP → Process Job
    ↓
Agent Planner → Supervisor → Tools
    ↓
Redis Pub/Sub (agent:logs:{run_id})
    ↓
API → User (SSE Stream)

Files: S3 (swissbrain-workspaces @ Exoscale Geneva)
```

## Next Steps

After verifying Phase 2B works:

1. **Scale Worker**: Add horizontal pod autoscaler based on queue depth
2. **Enable K8s Jobs**: Activate tool execution via K8s jobs (Phase 2B.2)
3. **Add Monitoring**: Prometheus metrics for queue depth, worker throughput
4. **Browser Tool**: Implement Playwright-based browser automation
5. **Web Search**: Integrate search API (Brave/Google)

---

**Status**: ✅ Phase 2B Deployed and Running
**Date**: 2026-01-14
**Version**: phase2b
