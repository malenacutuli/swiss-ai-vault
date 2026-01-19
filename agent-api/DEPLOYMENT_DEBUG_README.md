# Worker Deployment Debugging Guide

## Summary

The worker pod was running but never executing `main()`. Root cause identified: using `-m app.worker.main` doesn't trigger the `__main__` block.

## Changes Made

### 1. Diagnostic Prints Added to `app/worker/main.py`

```python
# Line 2 - Module load detection
print("=== main.py MODULE LOADED ===", flush=True)

# Line 11 - After imports
print("=== main.py IMPORTS COMPLETE ===", flush=True)

# Line 168 - Function call detection
def main():
    print("=== main() FUNCTION CALLED ===", flush=True)
```

### 2. Created `entrypoint.py`

Explicitly imports and calls `main()`:

```python
#!/usr/bin/env python3
"""Entrypoint for worker - explicitly calls main()"""
print("=== ENTRYPOINT.PY STARTING ===", flush=True)

from app.worker.main import main

print("=== ENTRYPOINT.PY: main imported, calling main() ===", flush=True)

if __name__ == "__main__":
    main()
```

### 3. Updated Dockerfile

Added `entrypoint.py` to COPY commands (line 47).

### 4. Updated `k8s/worker-deployment.yaml`

Changed command from:
```yaml
command: ["python", "-u", "-m", "app.worker.main"]  # Doesn't trigger __main__
```

To:
```yaml
command: ["python", "-u", "/app/entrypoint.py"]  # Explicitly calls main()
```

## Deployment Steps

### Quick Deploy (Recommended)

```bash
# Run the automated deployment script
./deploy_and_verify.sh
```

### Manual Deploy

```bash
# 1. Apply updated deployment
kubectl apply -f k8s/worker-deployment.yaml

# 2. Wait for rollout
kubectl rollout status deployment/agent-worker -n agents

# 3. Wait 30 seconds for initialization
sleep 30

# 4. Check Redis for diagnostic output
redis-cli -u "$REDIS_URL" LRANGE worker:debug 0 50
redis-cli -u "$REDIS_URL" GET worker:heartbeat

# 5. Check pod status
kubectl get pods -n agents -l app=agent-worker
kubectl describe pod -n agents -l app=agent-worker
```

## What to Look For

### Success Indicators

In Redis `worker:debug` key, you should see:

1. ✅ `"ENTRYPOINT.PY STARTING"` - entrypoint script executed
2. ✅ `"main.py MODULE LOADED"` - module imported successfully
3. ✅ `"main imported, calling main()"` - about to call main()
4. ✅ `"main() FUNCTION CALLED"` - main() executed
5. ✅ `"Worker __init__ started at ..."` - AgentWorker initializing
6. ✅ `"Initial heartbeat written"` - heartbeat written
7. ✅ `"Main loop entered at ..."` - worker processing loop started

In Redis `worker:heartbeat` key:
- Should contain recent ISO timestamp (updated every ~5 minutes)

### Failure Scenarios

**Scenario 1: No prints at all**
- Pod crashed before Python started
- Check: `kubectl describe pod` for OOMKilled, ImagePullBackOff, etc.

**Scenario 2: "ENTRYPOINT.PY STARTING" but nothing after**
- entrypoint.py crashed during import
- Check: `kubectl logs` for Python traceback

**Scenario 3: "main.py MODULE LOADED" but no "main() FUNCTION CALLED"**
- Module loaded but main() never called
- Issue: `if __name__ == "__main__"` block not triggered
- Solution: Already fixed with entrypoint.py

**Scenario 4: All prints appear but no heartbeat**
- Worker initialization failing after main() starts
- Check: Later log entries in `worker:debug` for error details

## Fallback Options

If entrypoint.py doesn't work, try inline `-c` method:

```bash
kubectl patch deployment agent-worker -n agents -p '{"spec":{"template":{"spec":{"containers":[{"name":"worker","command":["python","-u","-c","from app.worker.main import main; main()"]}]}}}}'
```

## Verification Commands

```bash
# Check all diagnostic markers
redis-cli -u "$REDIS_URL" LRANGE worker:debug 0 50 | grep -E "(ENTRYPOINT|MODULE LOADED|FUNCTION CALLED|Main loop)"

# Check job queue status
redis-cli -u "$REDIS_URL" LLEN jobs:pending      # Should be 7 jobs waiting
redis-cli -u "$REDIS_URL" LLEN jobs:processing   # Should increase as worker processes
redis-cli -u "$REDIS_URL" LLEN jobs:failed       # Failed jobs (ideally 0)

# Monitor worker in real-time
watch -n 2 'redis-cli -u "$REDIS_URL" GET worker:heartbeat'

# Check pod events
kubectl get events -n agents --sort-by='.lastTimestamp' | grep agent-worker
```

## Testing the Fix

Once worker is running successfully:

1. **Verify job processing**: Jobs should move from `jobs:pending` to completion
2. **Check log streaming**: API `/logs/{run_id}/stream` should show real-time updates
3. **Test end-to-end**: Create and start a new agent run

## Next Steps After Worker Works

1. ✅ **Verify job processing**: Watch the 7 pending jobs get processed
2. **Test tool execution**: File read/write to S3 workspace
3. **Enable K8s job spawning**: Uncomment executor code for shell/code tools
4. **Re-enable non-root user**: Remove `# USER 1000:1000` comment once stable
5. **Add proper health checks**: Redis-based liveness probe
6. **Scale workers**: Test HPA with multiple replicas

## Image Information

- **Current Image**: `docker.io/axessvideo/agent-api:phase2b`
- **Built**: 2026-01-14
- **Digest**: `sha256:0a0d4ca4b98fd1b0074ae70c8d24df7a26d578f541264ce993453ff7a77f4102`

## Redis Keys Reference

| Key | Purpose | Expected Value |
|-----|---------|----------------|
| `worker:heartbeat` | Worker alive timestamp | ISO datetime (updated every ~5 min) |
| `worker:debug` | Diagnostic log list | Print statements, initialization logs |
| `jobs:pending` | Queued jobs | 7 jobs (from previous runs) |
| `jobs:processing` | In-flight jobs | Should increment as worker processes |
| `jobs:failed` | Dead letter queue | Failed jobs after retries |
| `agent:logs:{run_id}` | Real-time log pub/sub | SSE streaming channel |

## Files Modified in This Debug Session

1. `app/worker/main.py` - Added diagnostic prints
2. `entrypoint.py` - Created explicit entry point
3. `Dockerfile` - Added entrypoint.py to image
4. `k8s/worker-deployment.yaml` - Changed command to use entrypoint.py
5. `deploy_and_verify.sh` - Created automated deployment script

## Build Verification

During `docker build`, you should see:

```
#29 0.925 === main.py MODULE LOADED ===
#29 0.925 === main.py IMPORTS COMPLETE ===
#29 0.925 ✓ Worker main import OK
```

This confirms diagnostic prints work at build time. Now we need to see them at runtime.
