#!/bin/bash
# Deploy fixed image and run test

echo "=== Deploying Fixed Worker ==="
kubectl apply -f k8s/worker-deployment.yaml
echo ""
echo "Waiting for rollout..."
kubectl rollout status deployment/agent-worker -n agents --timeout=5m || echo "Rollout check timed out, continuing..."
echo ""

echo "=== Creating Test Job ==="
python3 test_supervisor_tools.py

echo ""
echo "✓ Test job created"
echo ""
echo "Wait 90 seconds for AgentSupervisor to:"
echo "  1. Create execution plan"
echo "  2. Call shell tool multiple times via E2B"
echo "  3. Complete the task"
echo ""
echo "Then check results with the Run ID printed above"
