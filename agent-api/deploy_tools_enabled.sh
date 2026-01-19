#!/bin/bash
# Deploy worker with E2B tools enabled

echo "=== Deploying Worker with E2B Tools Enabled ==="
echo ""
echo "Image: docker.io/axessvideo/agent-api:tools-enabled"
echo ""

# Apply updated deployment
kubectl apply -f k8s/worker-deployment.yaml

echo ""
echo "Waiting for rollout..."
kubectl rollout status deployment/agent-worker -n agents --timeout=5m

echo ""
echo "✓ Deployment complete"
echo ""
echo "Check worker logs:"
echo "  kubectl logs -f -n agents deployment/agent-worker"
