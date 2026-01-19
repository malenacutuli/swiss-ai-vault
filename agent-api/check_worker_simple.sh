#!/bin/bash
# Simple worker check script

echo "=== Getting pod name ==="
POD_NAME=$(kubectl get pods -n agents -l app=agent-worker -o jsonpath='{.items[0].metadata.name}' 2>&1)
echo "Pod: $POD_NAME"

echo ""
echo "=== Pod status ==="
kubectl get pod -n agents "$POD_NAME" 2>&1

echo ""
echo "=== Trying to get logs (may timeout) ==="
timeout 10 kubectl logs -n agents "$POD_NAME" --tail=50 2>&1 || echo "Log fetch timed out"

echo ""
echo "=== Pod describe (for events) ==="
kubectl describe pod -n agents "$POD_NAME" 2>&1 | tail -50
