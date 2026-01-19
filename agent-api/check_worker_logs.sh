#!/bin/bash
# Check worker pod logs and status

echo "=== Worker Pod Status ==="
kubectl get pods -n agents -l app=agent-worker

echo ""
echo "=== Worker Pod Logs (last 100 lines) ==="
kubectl logs -n agents deployment/agent-worker --tail=100

echo ""
echo "=== Looking for diagnostic prints in logs ==="
if kubectl logs -n agents deployment/agent-worker --tail=200 | grep -q "ENTRYPOINT.PY STARTING"; then
    echo "✓ Found: ENTRYPOINT.PY STARTING"
else
    echo "✗ Not found: ENTRYPOINT.PY STARTING"
fi

if kubectl logs -n agents deployment/agent-worker --tail=200 | grep -q "main.py MODULE LOADED"; then
    echo "✓ Found: main.py MODULE LOADED"
else
    echo "✗ Not found: main.py MODULE LOADED"
fi

if kubectl logs -n agents deployment/agent-worker --tail=200 | grep -q "main() FUNCTION CALLED"; then
    echo "✓ Found: main() FUNCTION CALLED"
else
    echo "✗ Not found: main() FUNCTION CALLED"
fi

echo ""
echo "=== Recent Pod Events ==="
kubectl describe pod -n agents -l app=agent-worker | grep -A 30 "Events:"
