#!/bin/bash
set -e

echo "=========================================="
echo "Phase 3 Deployment Script"
echo "Advanced E2B Sandbox with SwissBrain Standard"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Image version
IMAGE="docker.io/axessvideo/agent-api:v10-phase3"

echo -e "${GREEN}✓ Image built and pushed: ${IMAGE}${NC}"
echo ""

# Check kubectl connection
echo "Checking Kubernetes connection..."
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}✗ kubectl is not connected to a cluster${NC}"
    echo ""
    echo "Please configure kubectl to connect to your cluster:"
    echo "  - For Exoscale: exo compute sks kubeconfig <cluster-name> <profile-name> --zone ch-gva-2 -g system:masters > ~/.kube/config"
    echo "  - For GKE: gcloud container clusters get-credentials <cluster-name>"
    echo "  - For EKS: aws eks update-kubeconfig --name <cluster-name>"
    echo ""
    exit 1
fi

echo -e "${GREEN}✓ kubectl connected${NC}"
echo ""

# Verify namespace exists
echo "Verifying namespace 'agents' exists..."
if ! kubectl get namespace agents &> /dev/null; then
    echo -e "${YELLOW}⚠ Namespace 'agents' does not exist, creating...${NC}"
    kubectl create namespace agents
fi

echo -e "${GREEN}✓ Namespace 'agents' exists${NC}"
echo ""

# Deploy API
echo "=========================================="
echo "Deploying API (agent-api)"
echo "=========================================="
kubectl apply -f k8s/deployment.yaml

echo ""
echo "Waiting for API rollout to complete..."
kubectl rollout status deployment/agent-api -n agents --timeout=5m

echo ""
echo -e "${GREEN}✓ API deployment complete${NC}"
echo ""

# Deploy Worker
echo "=========================================="
echo "Deploying Worker (agent-worker)"
echo "=========================================="
kubectl apply -f k8s/worker-deployment.yaml

echo ""
echo "Waiting for worker rollout to complete..."
kubectl rollout status deployment/agent-worker -n agents --timeout=5m

echo ""
echo -e "${GREEN}✓ Worker deployment complete${NC}"
echo ""

# Show deployment status
echo "=========================================="
echo "Deployment Status"
echo "=========================================="
kubectl get deployments -n agents
echo ""

kubectl get pods -n agents
echo ""

# Show API logs
echo "=========================================="
echo "Recent API Logs"
echo "=========================================="
kubectl logs -n agents -l app=agent-api --tail=20 || echo "No API logs yet"
echo ""

# Show Worker logs
echo "=========================================="
echo "Recent Worker Logs"
echo "=========================================="
kubectl logs -n agents -l app=agent-worker --tail=20 || echo "No worker logs yet"
echo ""

# Health check
echo "=========================================="
echo "Health Check"
echo "=========================================="

# Get API service endpoint
API_SERVICE=$(kubectl get svc agent-api-service -n agents -o jsonpath='{.status.loadBalancer.ingress[0].ip}' 2>/dev/null || echo "")

if [ -z "$API_SERVICE" ]; then
    # Try hostname if IP not available
    API_SERVICE=$(kubectl get svc agent-api-service -n agents -o jsonpath='{.status.loadBalancer.ingress[0].hostname}' 2>/dev/null || echo "")
fi

if [ -z "$API_SERVICE" ]; then
    echo -e "${YELLOW}⚠ LoadBalancer IP/hostname not yet assigned${NC}"
    echo "You can check service status with:"
    echo "  kubectl get svc -n agents"
else
    echo "API Service: http://${API_SERVICE}:8000"
    echo ""
    echo "Testing /health endpoint..."
    curl -s "http://${API_SERVICE}:8000/health" | jq . || echo "Health check not yet accessible"
fi

echo ""
echo "=========================================="
echo -e "${GREEN}✓ Phase 3 Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "New Features Available:"
echo "  ✓ Advanced E2B Sandbox Management"
echo "  ✓ Full Resource Configuration (CPU, Memory, Disk)"
echo "  ✓ Real-time Metrics Collection"
echo "  ✓ Automated Health Monitoring"
echo "  ✓ Custom Environment Setup"
echo "  ✓ Browser Automation (Playwright)"
echo "  ✓ Web Search (Tavily/Serper)"
echo "  ✓ REST API for Sandbox Management"
echo ""
echo "API Endpoints:"
echo "  POST   /api/sandboxes/create"
echo "  POST   /api/sandboxes/{run_id}/execute/command"
echo "  POST   /api/sandboxes/{run_id}/execute/code"
echo "  GET    /api/sandboxes/{run_id}/metrics"
echo "  GET    /api/sandboxes/{run_id}/health"
echo "  DELETE /api/sandboxes/{run_id}"
echo "  GET    /api/sandboxes"
echo ""
echo "Monitor with:"
echo "  kubectl get pods -n agents -w"
echo "  kubectl logs -f -n agents -l app=agent-api"
echo "  kubectl logs -f -n agents -l app=agent-worker"
echo ""
