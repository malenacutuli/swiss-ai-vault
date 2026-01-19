#!/bin/bash
# Check why pod is crashing

POD_NAME=$(kubectl get pods -n agents -l app=agent-worker -o jsonpath='{.items[0].metadata.name}')

echo "=== Pod Name ==="
echo "$POD_NAME"

echo ""
echo "=== Container Status ==="
kubectl get pod -n agents "$POD_NAME" -o jsonpath='{.status.containerStatuses[0]}' | python3 -m json.tool

echo ""
echo "=== Last Termination Reason ==="
kubectl get pod -n agents "$POD_NAME" -o jsonpath='{.status.containerStatuses[0].lastState.terminated.reason}'
echo ""

echo ""
echo "=== Last Exit Code ==="
kubectl get pod -n agents "$POD_NAME" -o jsonpath='{.status.containerStatuses[0].lastState.terminated.exitCode}'
echo ""

echo ""
echo "=== Last Termination Message ==="
kubectl get pod -n agents "$POD_NAME" -o jsonpath='{.status.containerStatuses[0].lastState.terminated.message}'
echo ""

echo ""
echo "=== Pod Events ==="
kubectl get events -n agents --field-selector involvedObject.name="$POD_NAME" --sort-by='.lastTimestamp' | tail -20

echo ""
echo "=== Previous Pod Logs (if accessible) ==="
timeout 5 kubectl logs -n agents "$POD_NAME" --previous --tail=50 2>&1 || echo "(previous logs not accessible)"
