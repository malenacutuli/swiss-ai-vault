#!/bin/bash
# Force worker pod to refresh with new :e2b image

set -e

echo "=== Force Refresh Worker Pod ==="
echo ""

echo "Step 1: Get current pod name..."
POD=$(kubectl get pods -n agents -l app=agent-worker -o jsonpath='{.items[0].metadata.name}')
echo "Current pod: $POD"

echo ""
echo "Step 2: Delete pod to force image pull..."
kubectl delete pod $POD -n agents

echo ""
echo "Step 3: Wait for new pod to be ready..."
kubectl wait --for=condition=ready pod -l app=agent-worker -n agents --timeout=120s

echo ""
echo "Step 4: Get new pod name..."
NEW_POD=$(kubectl get pods -n agents -l app=agent-worker -o jsonpath='{.items[0].metadata.name}')
echo "New pod: $NEW_POD"

echo ""
echo "Step 5: Wait 30 seconds for worker initialization..."
sleep 30

echo ""
echo "Step 6: Check new pod logs for E2B initialization..."
echo "Looking for: 'Sandbox.create()' usage (not 'Sandbox()' error)"
kubectl logs -n agents $NEW_POD --tail=100 | grep -E "E2B|initialized|Sandbox" || echo "Could not get logs (timeout)"

echo ""
echo "✓ Pod refreshed with new image"
echo ""
echo "Next: Run test job to verify Sandbox.create() works"
