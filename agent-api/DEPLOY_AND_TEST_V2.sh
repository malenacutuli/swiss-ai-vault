#!/bin/bash
# Deploy v2 worker with conversation history fix and test

echo "=== Deploying Worker v2 ==="
kubectl apply -f k8s/worker-deployment.yaml
echo ""
echo "Waiting for rollout..."
kubectl rollout status deployment/agent-worker -n agents --timeout=5m || echo "Rollout check timed out, continuing..."
echo ""
echo "Waiting 10 seconds for pod to stabilize..."
sleep 10
echo ""

echo "=== Creating Test Job ==="
python3 test_supervisor_tools.py

echo ""
echo "✓ Test job created"
echo ""
echo "Wait 90 seconds for AgentSupervisor to:"
echo "  1. Load conversation history (with user prompt!)"
echo "  2. Decide first action using LLM"
echo "  3. Call shell tool via E2B"
echo "  4. Complete the task"
echo ""
echo "Then check results with the Run ID printed above using:"
echo "  python3 check_test_result.py <RUN_ID>"
