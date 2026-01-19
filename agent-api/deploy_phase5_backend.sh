#!/bin/bash
set -e

echo "=============================================="
echo "Phase 5 Backend Deployment Script"
echo "SwissBrain Prompt Management System"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Image version
IMAGE="docker.io/axessvideo/agent-api:v12-phase5"
NAMESPACE="agents"

echo -e "${BLUE}Step 1: Database Migration${NC}"
echo "=============================================="
echo ""
echo "The database migration must be applied via Supabase Dashboard:"
echo ""
echo "Option 1: Supabase SQL Editor (Recommended)"
echo "  1. Go to: https://app.supabase.com/project/YOUR_PROJECT_ID/sql"
echo "  2. Click 'New Query'"
echo "  3. Copy the contents of: supabase_migrations/20260115000001_prompt_management.sql"
echo "  4. Paste into the SQL editor"
echo "  5. Click 'Run' to execute"
echo ""
echo "Option 2: Supabase CLI (if project linked)"
echo "  supabase db push"
echo ""
read -p "Have you applied the database migration? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Please apply the database migration first.${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Database migration confirmed${NC}"
echo ""

echo -e "${BLUE}Step 2: Docker Image${NC}"
echo "=============================================="
echo -e "Using image: ${GREEN}${IMAGE}${NC}"
echo "Digest: sha256:e19d5b68509a46e6b987a354a8be44211ee87a45b0c7152902799117005307ad"
echo ""

echo -e "${BLUE}Step 3: Update Kubernetes Deployments${NC}"
echo "=============================================="
echo ""

# Update agent-api deployment
echo -e "${YELLOW}Updating agent-api deployment...${NC}"
if kubectl set image deployment/agent-api \
  agent-api=${IMAGE} \
  -n ${NAMESPACE}; then
  echo -e "${GREEN}✓ agent-api deployment updated${NC}"
else
  echo -e "${RED}✗ Failed to update agent-api deployment${NC}"
  exit 1
fi

echo ""

# Update agent-worker deployment
echo -e "${YELLOW}Updating agent-worker deployment...${NC}"
if kubectl set image deployment/agent-worker \
  agent-worker=${IMAGE} \
  -n ${NAMESPACE}; then
  echo -e "${GREEN}✓ agent-worker deployment updated${NC}"
else
  echo -e "${RED}✗ Failed to update agent-worker deployment${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}Step 4: Wait for Rollout${NC}"
echo "=============================================="
echo ""

# Wait for API rollout
echo -e "${YELLOW}Waiting for agent-api rollout...${NC}"
if kubectl rollout status deployment/agent-api -n ${NAMESPACE} --timeout=5m; then
  echo -e "${GREEN}✓ agent-api rollout completed${NC}"
else
  echo -e "${RED}✗ agent-api rollout failed${NC}"
  exit 1
fi

echo ""

# Wait for worker rollout
echo -e "${YELLOW}Waiting for agent-worker rollout...${NC}"
if kubectl rollout status deployment/agent-worker -n ${NAMESPACE} --timeout=5m; then
  echo -e "${GREEN}✓ agent-worker rollout completed${NC}"
else
  echo -e "${RED}✗ agent-worker rollout failed${NC}"
  exit 1
fi

echo ""
echo -e "${BLUE}Step 5: Verify Deployment${NC}"
echo "=============================================="
echo ""

# Check pod status
echo -e "${YELLOW}Checking pod status...${NC}"
kubectl get pods -n ${NAMESPACE} -l app=agent-api
kubectl get pods -n ${NAMESPACE} -l app=agent-worker

echo ""

# Check logs
echo -e "${YELLOW}Recent API logs:${NC}"
kubectl logs deployment/agent-api -n ${NAMESPACE} --tail=20

echo ""
echo -e "${GREEN}=============================================="
echo "Deployment Complete! ✅"
echo "==============================================${NC}"
echo ""
echo "Next steps:"
echo "1. Test Phase 5 endpoints:"
echo "   kubectl port-forward -n ${NAMESPACE} deployment/agent-api 8000:8000"
echo ""
echo "2. Verify health:"
echo "   curl http://localhost:8000/health"
echo ""
echo "3. Check prompt routes (should return 401 - auth required):"
echo "   curl http://localhost:8000/api/prompts/versions/test"
echo ""
echo "4. View API documentation:"
echo "   curl http://localhost:8000/openapi.json | jq '.paths | keys' | grep prompts"
echo ""
echo "Phase 5 Prompt Management System is now live! 🚀"
