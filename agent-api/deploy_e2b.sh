#!/bin/bash
# Deploy E2B-enabled worker with hybrid architecture

set -e

E2B_API_KEY="e2b_a33017d32c635bed98c3d164e35cfea71765d3dd"

echo "=== Deploying Hybrid E2B Architecture ==="
echo ""
echo "Architecture:"
echo "  - Orchestration: Swiss K8s (Phase 2B infrastructure)"
echo "  - Tool Execution: E2B Sandboxes (reliable networking)"
echo ""

echo "Step 1: Adding E2B API key to K8s secrets..."
kubectl create secret generic agent-api-secrets \
  --from-literal=E2B_API_KEY="$E2B_API_KEY" \
  --namespace=agents \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✓ E2B API key added to secrets"
echo ""

echo "Step 2: Building Docker image with E2B support..."
docker build --platform linux/amd64 -t docker.io/axessvideo/agent-api:e2b . 2>&1 | tail -20

echo ""
echo "Step 3: Pushing image to registry..."
docker push docker.io/axessvideo/agent-api:e2b 2>&1 | tail -10

echo ""
echo "Step 4: Updating deployment to use E2B image..."
kubectl set image deployment/agent-worker worker=docker.io/axessvideo/agent-api:e2b -n agents

echo ""
echo "Step 5: Applying updated deployment configuration..."
kubectl apply -f k8s/worker-deployment.yaml

echo ""
echo "Step 6: Waiting for rollout..."
kubectl rollout status deployment/agent-worker -n agents

echo ""
echo "Step 7: Waiting 60 seconds for worker to initialize..."
sleep 60

echo ""
echo "=== Verifying E2B Integration ==="
python3 check_redis.py | grep -A 10 "Worker Debug Log"

echo ""
echo "✓ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Clear failed jobs: python3 clear_failed_jobs.py"
echo "  2. Run test: python3 setup_test_user.py"
echo "  3. Check results: python3 check_job_status.py <run_id>"
