#!/bin/bash
set -e

echo "=== Deploying Worker with Entrypoint ==="

# Update deployment
echo "1. Patching deployment to use entrypoint.py..."
kubectl patch deployment agent-worker -n agents -p '{"spec":{"template":{"spec":{"containers":[{"name":"worker","command":["python","-u","/app/entrypoint.py"]}]}}}}'

# Wait for rollout
echo "2. Waiting for rollout..."
kubectl rollout status deployment/agent-worker -n agents

# Wait for worker to initialize
echo "3. Waiting 30 seconds for worker to initialize..."
sleep 30

# Check Redis for diagnostic output
echo "4. Checking Redis for diagnostic prints..."
echo ""
echo "=== Worker Debug Log (last 50 entries) ==="
redis-cli -u "$REDIS_URL" LRANGE worker:debug 0 50

echo ""
echo "=== Worker Heartbeat ==="
redis-cli -u "$REDIS_URL" GET worker:heartbeat

echo ""
echo "=== Pod Status ==="
kubectl get pods -n agents -l app=agent-worker

echo ""
echo "=== Recent Pod Events ==="
kubectl describe pod -n agents -l app=agent-worker | grep -A 20 "Events:"

echo ""
echo "=== Looking for diagnostic markers ==="
if redis-cli -u "$REDIS_URL" LRANGE worker:debug 0 50 | grep -q "ENTRYPOINT.PY STARTING"; then
    echo "✓ entrypoint.py started"
else
    echo "✗ entrypoint.py did NOT start"
fi

if redis-cli -u "$REDIS_URL" LRANGE worker:debug 0 50 | grep -q "main.py MODULE LOADED"; then
    echo "✓ main.py module loaded"
else
    echo "✗ main.py module did NOT load"
fi

if redis-cli -u "$REDIS_URL" LRANGE worker:debug 0 50 | grep -q "main() FUNCTION CALLED"; then
    echo "✓ main() function was called"
else
    echo "✗ main() function was NOT called"
fi

echo ""
echo "=== Queue Status ==="
echo "Pending jobs: $(redis-cli -u "$REDIS_URL" LLEN jobs:pending)"
echo "Processing jobs: $(redis-cli -u "$REDIS_URL" LLEN jobs:processing)"
echo "Failed jobs: $(redis-cli -u "$REDIS_URL" LLEN jobs:failed)"
