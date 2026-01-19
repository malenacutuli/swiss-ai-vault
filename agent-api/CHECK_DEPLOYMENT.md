# Check V2 Deployment Status

## Current Status

✅ **Code Fixed**:
- User prompt now inserted into conversation history
- JSON extraction improved with multiple patterns
- All changes in job_processor.py and supervisor.py

✅ **Docker Image**:
- Built: `docker.io/axessvideo/agent-api:v2`
- Pushed: digest `sha256:a3e36dad44d963bff016ff2750e9f97a06ff459284122928b410128ca5d1466c`

✅ **Deployment File Updated**:
- `k8s/worker-deployment.yaml` now uses `:v2`

❌ **kubectl Not Working**:
- Connection refused to localhost:8080
- Cannot verify if pod restarted with v2
- Cannot apply deployment directly

## What to Do

### Check if Deployment Auto-Updated

Wait 2-3 minutes, then test:

```bash
python3 QUICK_TEST.py
```

Enter your auth token when prompted, create a test job, wait 90 seconds, and check if it completes successfully.

### If Test Still Fails

The pod might still be running v1. Manually force restart:

**On a machine where kubectl works:**

```bash
# Check current image
kubectl get deployment agent-worker -n agents -o yaml | grep image:

# If it shows v1, force pod restart
kubectl delete pod -n agents -l app=agent-worker

# Wait for new pod to start
kubectl get pods -n agents -w

# Once running, verify image
kubectl describe pod -n agents -l app=agent-worker | grep Image:
```

Should show: `Image: docker.io/axessvideo/agent-api:v2`

### Alternative: Direct Database Fix (If Urgent)

If you can't restart the pod but need to test, you could insert the user prompt manually:

```sql
-- For the failed run 051d425a-f4af-4e74-9489-0aaa724aa5fe
INSERT INTO agent_messages (run_id, role, content, created_at)
VALUES (
  '051d425a-f4af-4e74-9489-0aaa724aa5fe',
  'user',
  'Check the system information and create a report file...',
  NOW()
);

-- Then retry the run
UPDATE agent_runs
SET status = 'queued', error_message = NULL
WHERE id = '051d425a-f4af-4e74-9489-0aaa724aa5fe';
```

But this is messy - better to deploy v2 and create a new test job.

## Summary

| Component | Status | Action Needed |
|-----------|--------|---------------|
| Code fixes | ✅ Done | None |
| Docker image v2 | ✅ Pushed | None |
| Deployment YAML | ✅ Updated | None |
| Pod restart | ❌ Unknown | Verify pod is running v2 |
| Testing | ⏳ Pending | Run QUICK_TEST.py |

**Bottom line**: The code is ready. Just need to ensure the worker pod restarts with the v2 image, then test.
