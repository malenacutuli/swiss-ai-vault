# v6-working Deployment Status

## ✅ What's Been Fixed

### 1. Code Changes
- ✅ **All Supabase API calls fixed**: Changed `.from_()` → `.table()` in:
  - `app/agent/supervisor.py` (5 locations)
  - `app/agent/planner.py` (3 locations)
  - `app/agent/tools/router.py` (2 locations)

### 2. Dependencies
- ✅ **Pinned postgrest version**: `postgrest==2.27.1` in requirements.txt
- ✅ **Verified in image**: Built Dockerfile.debug confirmed correct versions

### 3. Deployment
- ✅ **Fresh image built**: `docker.io/axessvideo/agent-api:v6-working` with `--no-cache`
- ✅ **Deployment recreated**: Deleted and re-created worker deployment
- ✅ **Pod running v6-working**: Confirmed with kubectl (image tag correct)

## 🧪 Current Test State

### Test Run Created
- **Run ID**: `26c5a929-edd7-43f8-ae12-b6588f1124f1`
- **User ID**: `ad7d2f6d-3292-47ea-b1ad-75388539e89e`
- **Prompt**: "List files in the current directory"
- **Status**: `queued` (waiting for Redis enqueue)
- ✅ **agent_messages populated**: Initial user message inserted

### What's Missing
- ⏳ **Job not enqueued to Redis**: Local machine can't connect to Redis/kubectl
- ⏳ **Worker hasn't picked up job**: Needs cluster access to enqueue

## 🎯 Next Step - Run This on Cluster Machine

**On a machine with kubectl access**, run:

```bash
cd /Users/malena/swiss-ai-vault/agent-api
./ENQUEUE_AND_TEST.sh
```

This script will:
1. Enqueue the job to Redis
2. Monitor worker logs for 30 seconds
3. Check final status in database
4. Report if the `SyncQueryRequestBuilder` error is gone

## 📊 Expected Results

### ✅ Success (v6-working works):
```
Status: completed (or planning/executing)
✓ Plan created
✓ Agent Steps: 1+
✓ No SyncQueryRequestBuilder errors
```

### ❌ Still Failing (pod didn't update):
```
Status: failed
❌ Error: 'SyncQueryRequestBuilder' object has no attribute 'select'
⚠️ STILL GETTING OLD ERROR - Pod may not have pulled v6-working!
```

**If still failing**, force pod restart:
```bash
kubectl delete pod -n agents -l app=agent-worker --force
kubectl wait --for=condition=ready pod -n agents -l app=agent-worker --timeout=180s
```

## 🔍 Verification Commands

### Check pod is running v6-working:
```bash
kubectl get pods -n agents -l app=agent-worker -o jsonpath='{.items[0].spec.containers[0].image}'
# Should show: docker.io/axessvideo/agent-api:v6-working
```

### Check worker logs:
```bash
kubectl logs -n agents deployment/agent-worker --tail=50
```

### Check Redis queue:
```bash
kubectl exec -n agents deployment/agent-worker -- python3 -c "
import redis
r = redis.from_url('redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379')
print(f'jobs:pending length: {r.llen(\"jobs:pending\")}')
print(f'jobs:processing length: {r.llen(\"jobs:processing\")}')
print(f'jobs:failed length: {r.llen(\"jobs:failed\")}')
"
```

## 📝 Architecture Flow (For Reference)

### User Flow:
```
1. POST /agent/execute {"action": "create", "prompt": "..."}
   → Creates agent_runs record
   → Inserts initial message to agent_messages
   → Returns run_id

2. POST /agent/execute {"action": "start", "run_id": "..."}
   → Updates status to "queued"
   → Enqueues to Redis jobs:pending
   → Returns immediately

3. Worker Process:
   → BRPOP from jobs:pending
   → Fetches run from agent_runs
   → Creates plan (AgentPlanner)
   → Executes (AgentSupervisor)
     → _load_conversation_history() ← FAILS HERE with old code
     → _decide_next_action()
     → _execute_action()
     → ...loop until complete
```

### Where the Error Occurred:
```python
# supervisor.py:326-329
async def _load_conversation_history(self):
    result = self.supabase.table("agent_messages")\
        .select("role, content, created_at")\  # ← FAILS HERE
        .eq("run_id", self.run_id)\
        .order("created_at")\
        .execute()
```

**Error**: `'SyncQueryRequestBuilder' object has no attribute 'select'`

**Cause**: Incompatible postgrest version installed when `requirements.txt` had unpinned version

**Fix**: Pin `postgrest==2.27.1` and rebuild image with `--no-cache`

## 🚀 Files Modified

1. `app/agent/supervisor.py` - Fixed all Supabase calls
2. `app/agent/planner.py` - Fixed all Supabase calls
3. `app/agent/tools/router.py` - Fixed all Supabase calls
4. `requirements.txt` - Pinned postgrest==2.27.1
5. `k8s/worker-deployment.yaml` - Updated to v6-working
6. `test_v6_direct.py` - Test script (creates run ready for enqueue)
7. `ENQUEUE_AND_TEST.sh` - Enqueue and monitor script

## 📚 Previous Deployments

- v3: First fix attempt (only code changes)
- v4: Second attempt (manual kubectl apply)
- v5-final: With --no-cache (still had unpinned postgrest)
- **v6-working**: Current - with postgrest==2.27.1 pinned ✅

## 🎯 Success Criteria

The deployment is successful when:
1. ✅ Job processes without errors
2. ✅ Plan is created
3. ✅ Agent steps are executed
4. ✅ No `SyncQueryRequestBuilder` errors
5. ✅ Status reaches `completed` or `executing`
