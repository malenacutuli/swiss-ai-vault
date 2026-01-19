#!/bin/bash
# Deploy tools-enabled worker and run tests

echo "=== Step 1: Deploy Worker ==="
kubectl apply -f k8s/worker-deployment.yaml
echo ""
echo "Waiting for rollout..."
kubectl rollout status deployment/agent-worker -n agents --timeout=5m
echo ""

echo "=== Step 2: Check Worker Status ==="
kubectl get pods -n agents | grep agent-worker
echo ""

echo "=== Step 3: Create Test Jobs ==="
python3 test_tools.py
echo ""

echo "=== Done ==="
echo ""
echo "Monitor progress:"
echo "  kubectl logs -f -n agents deployment/agent-worker"
echo ""
echo "Or wait 60 seconds and check results with the Run IDs above"
