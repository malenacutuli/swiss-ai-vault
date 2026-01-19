# Force Deploy V2 - Worker Not Processing Jobs

## Problem

Test job created but status is still "queued" - worker not picking it up.

**Possible causes:**
1. Worker pod not running v2 image
2. Worker not connected to Redis
3. Deployment didn't update

## Solution: Force Pod Restart

The v2 image is built and pushed. We just need the worker pod to restart and pull it.

### If kubectl works on another machine:

```bash
# Check current image
kubectl describe pod -n agents -l app=agent-worker | grep Image:

# Should show: docker.io/axessvideo/agent-api:v2
# If it shows v1 or earlier, force restart:

kubectl delete pod -n agents -l app=agent-worker

# Wait for new pod
kubectl get pods -n agents -w

# Once Running, check image again
kubectl describe pod -n agents -l app=agent-worker | grep Image:
```

### Alternative: Update deployment directly

```bash
kubectl set image deployment/agent-worker worker=docker.io/axessvideo/agent-api:v2 -n agents
kubectl rollout status deployment/agent-worker -n agents
```

## After Restart

Wait 2-3 minutes for the new pod to start, then create a new test:

```bash
export SUPABASE_URL="https://ghmmdochvlrnwbruyrqk.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0"

python3 test_v2_direct.py
```

## What to Expect with v2

**Before (v1):**
```
Status: queued → failed
❌ No conversation messages (the bug!)
Error: Failed to determine next action
```

**After (v2):**
```
Status: queued → planning → executing → completed
✓ Conversation Messages: 1+
  USER: Check the system information...
✓ Agent Steps: 4+
  - shell_execute: completed
```

## Current Test Job

Run ID: `c307819d-d016-4024-b7a7-93f46272ec25`

Check status:
```bash
export SUPABASE_URL="https://ghmmdochvlrnwbruyrqk.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0"

python3 test_v2_direct.py c307819d-d016-4024-b7a7-93f46272ec25
```
