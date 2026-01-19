#!/bin/bash
set -e

echo "========================================"
echo "Phase 2B Deployment Script"
echo "========================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check required environment variables
if [ -z "$S3_ACCESS_KEY" ] || [ -z "$S3_SECRET_KEY" ]; then
    echo -e "${RED}ERROR: Missing required environment variables${NC}"
    echo "Please set:"
    echo "  export S3_ACCESS_KEY='your-exoscale-access-key'"
    echo "  export S3_SECRET_KEY='your-exoscale-secret-key'"
    exit 1
fi

echo -e "${GREEN}✓ Environment variables set${NC}"
echo ""

# Step 1: Update K8s secrets with S3 credentials
echo "Step 1: Updating Kubernetes secrets..."
kubectl create secret generic agent-api-secrets \
  --from-literal=S3_ACCESS_KEY="$S3_ACCESS_KEY" \
  --from-literal=S3_SECRET_KEY="$S3_SECRET_KEY" \
  --namespace=agents \
  --dry-run=client -o yaml | kubectl apply -f -

echo -e "${GREEN}✓ Secrets updated${NC}"
echo ""

# Step 2: Apply resource quota
echo "Step 2: Applying resource quota for tool jobs..."
kubectl apply -f k8s/resource-quota.yaml
echo -e "${GREEN}✓ Resource quota applied${NC}"
echo ""

# Step 3: Deploy worker
echo "Step 3: Deploying agent worker..."
kubectl apply -f k8s/worker-deployment.yaml
echo -e "${GREEN}✓ Worker deployment applied${NC}"
echo ""

# Step 4: Wait for worker rollout
echo "Step 4: Waiting for worker deployment..."
kubectl rollout status deployment/agent-worker -n agents --timeout=300s
echo -e "${GREEN}✓ Worker deployment ready${NC}"
echo ""

# Step 5: Update API to Phase 2B
echo "Step 5: Updating API deployment to Phase 2B..."
kubectl set image deployment/agent-api \
  agent-api=docker.io/axessvideo/agent-api:phase2b \
  -n agents
echo -e "${GREEN}✓ API deployment updated${NC}"
echo ""

# Step 6: Wait for API rollout
echo "Step 6: Waiting for API deployment..."
kubectl rollout status deployment/agent-api -n agents --timeout=300s
echo -e "${GREEN}✓ API deployment ready${NC}"
echo ""

# Step 7: Verify deployments
echo "========================================"
echo "Deployment Verification"
echo "========================================"
echo ""

echo "API Deployment Status:"
kubectl get deployment agent-api -n agents
echo ""

echo "Worker Deployment Status:"
kubectl get deployment agent-worker -n agents
echo ""

echo "API Pods:"
kubectl get pods -n agents -l app=agent-api
echo ""

echo "Worker Pods:"
kubectl get pods -n agents -l app=agent-worker
echo ""

echo "Recent Worker Logs:"
kubectl logs -n agents -l app=agent-worker --tail=20
echo ""

echo -e "${GREEN}========================================"
echo "Phase 2B Deployment Complete!"
echo "========================================${NC}"
echo ""
echo "Next steps:"
echo "1. Test job execution: POST /agent/execute with action=start"
echo "2. Monitor worker logs: kubectl logs -f deployment/agent-worker -n agents"
echo "3. Check Redis queue: redis-cli LLEN jobs:pending"
echo "4. Test log streaming: GET /agent/logs/<run_id>/stream"
echo ""
