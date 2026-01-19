#!/bin/bash
# Deploy worker with AgentSupervisor enabled

echo "=== Deploying Worker with AgentSupervisor + E2B Tools ==="
echo ""
echo "Architecture:"
echo "  - AgentPlanner + AgentSupervisor run in K8s worker"
echo "  - Shell and Code tools execute in E2B sandboxes"
echo "  - All other tools work normally"
echo ""
echo "Image: docker.io/axessvideo/agent-api:supervisor-enabled"
echo ""

kubectl apply -f k8s/worker-deployment.yaml

echo ""
echo "Waiting for rollout..."
kubectl rollout status deployment/agent-worker -n agents --timeout=5m

echo ""
echo "✓ Deployment complete"
echo ""
echo "Test with:"
echo "  python3 test_supervisor_tools.py"
echo ""
echo "Then after 90 seconds, check results with the Run ID printed"
