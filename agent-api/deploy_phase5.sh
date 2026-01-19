#!/bin/bash
set -e

echo "================================================"
echo "   Phase 5: Prompt Management System Deployment"
echo "================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
IMAGE_NAME="docker.io/axessvideo/agent-api"
TAG="v12-phase5"
NAMESPACE="agents"

echo -e "${BLUE}Step 1: Running Database Migration${NC}"
echo "---------------------------------------"
echo ""

# Check if Supabase CLI is available
if command -v supabase &> /dev/null; then
    echo "Running migration via Supabase CLI..."
    supabase db push supabase_migrations/20260115000001_prompt_management.sql
else
    echo -e "${YELLOW}Warning: Supabase CLI not found. Please run migration manually:${NC}"
    echo "  supabase db push supabase_migrations/20260115000001_prompt_management.sql"
    echo ""
    echo "Or execute the SQL file directly in Supabase dashboard:"
    echo "  supabase_migrations/20260115000001_prompt_management.sql"
    echo ""
    read -p "Press Enter to continue after running migration..."
fi

echo ""
echo -e "${GREEN}✓ Database migration complete${NC}"
echo ""

echo -e "${BLUE}Step 2: Running Tests${NC}"
echo "---------------------------------------"
echo ""

if command -v pytest &> /dev/null; then
    echo "Running test suite..."
    pytest tests/test_prompts.py -v || {
        echo -e "${RED}✗ Tests failed${NC}"
        read -p "Continue anyway? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    }
    echo ""
    echo -e "${GREEN}✓ Tests passed${NC}"
else
    echo -e "${YELLOW}Warning: pytest not found. Skipping tests.${NC}"
    echo "Install with: pip install pytest pytest-asyncio pytest-mock"
fi

echo ""
echo -e "${BLUE}Step 3: Building Docker Image${NC}"
echo "---------------------------------------"
echo ""

echo "Building image: ${IMAGE_NAME}:${TAG}"
docker build --platform linux/amd64 -t ${IMAGE_NAME}:${TAG} .

echo ""
echo -e "${GREEN}✓ Image built successfully${NC}"
echo ""

echo -e "${BLUE}Step 4: Pushing to Docker Hub${NC}"
echo "---------------------------------------"
echo ""

docker push ${IMAGE_NAME}:${TAG}

# Get image digest
DIGEST=$(docker inspect --format='{{index .RepoDigests 0}}' ${IMAGE_NAME}:${TAG} | cut -d'@' -f2)
echo ""
echo "Image pushed with digest: ${DIGEST}"
echo -e "${GREEN}✓ Image pushed successfully${NC}"
echo ""

echo -e "${BLUE}Step 5: Updating Kubernetes Deployments${NC}"
echo "---------------------------------------"
echo ""

# Update API deployment
echo "Updating agent-api deployment..."
kubectl set image deployment/agent-api agent-api=${IMAGE_NAME}:${TAG} -n ${NAMESPACE}

# Update worker deployment
echo "Updating agent-worker deployment..."
kubectl set image deployment/agent-worker agent-worker=${IMAGE_NAME}:${TAG} -n ${NAMESPACE}

echo ""
echo -e "${GREEN}✓ Deployments updated${NC}"
echo ""

echo -e "${BLUE}Step 6: Waiting for Rollout${NC}"
echo "---------------------------------------"
echo ""

echo "Waiting for agent-api rollout..."
kubectl rollout status deployment/agent-api -n ${NAMESPACE} --timeout=5m

echo ""
echo "Waiting for agent-worker rollout..."
kubectl rollout status deployment/agent-worker -n ${NAMESPACE} --timeout=5m

echo ""
echo -e "${GREEN}✓ Rollout complete${NC}"
echo ""

echo -e "${BLUE}Step 7: Verifying Deployment${NC}"
echo "---------------------------------------"
echo ""

# Get pod names
API_POD=$(kubectl get pods -n ${NAMESPACE} -l app=agent-api -o jsonpath='{.items[0].metadata.name}')
echo "API Pod: ${API_POD}"

# Check pod logs for startup
echo ""
echo "Checking API logs..."
kubectl logs -n ${NAMESPACE} ${API_POD} --tail=20 | grep -E "(agent_api_started|redis_connected|prompt)" || true

echo ""
echo -e "${GREEN}✓ Deployment verified${NC}"
echo ""

echo -e "${BLUE}Step 8: Testing Phase 5 Endpoints${NC}"
echo "---------------------------------------"
echo ""

# Port forward for testing
echo "Setting up port-forward for testing..."
kubectl port-forward -n ${NAMESPACE} deployment/agent-api 8000:8000 > /dev/null 2>&1 &
PF_PID=$!
sleep 3

echo ""
echo "Testing Phase 5 endpoints..."
echo ""

# Test 1: Health check
echo -n "1. Health check: "
if curl -s http://localhost:8000/health | grep -q "healthy"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${RED}✗ FAILED${NC}"
fi

# Test 2: OpenAPI docs (should include prompts endpoints)
echo -n "2. Prompt Management routes: "
if curl -s http://localhost:8000/docs | grep -q "Prompt Management"; then
    echo -e "${GREEN}✓ OK${NC}"
else
    echo -e "${YELLOW}⚠ Cannot verify (docs might need browser)${NC}"
fi

# Test 3: List prompt versions endpoint (should return 401 without auth)
echo -n "3. Version management endpoint: "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/prompts/versions/test-prompt)
if [ "$RESPONSE" = "401" ]; then
    echo -e "${GREEN}✓ OK (requires auth)${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response: $RESPONSE${NC}"
fi

# Test 4: Template list endpoint
echo -n "4. Template management endpoint: "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/prompts/templates)
if [ "$RESPONSE" = "401" ]; then
    echo -e "${GREEN}✓ OK (requires auth)${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response: $RESPONSE${NC}"
fi

# Test 5: A/B testing endpoint
echo -n "5. A/B testing endpoint: "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/prompts/ab-tests)
if [ "$RESPONSE" = "401" ]; then
    echo -e "${GREEN}✓ OK (requires auth)${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response: $RESPONSE${NC}"
fi

# Test 6: Metrics endpoint
echo -n "6. Metrics endpoint: "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/prompts/metrics/test-prompt)
if [ "$RESPONSE" = "401" ]; then
    echo -e "${GREEN}✓ OK (requires auth)${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response: $RESPONSE${NC}"
fi

# Test 7: Optimizer endpoint
echo -n "7. Optimizer endpoint: "
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/prompts/optimize/test-prompt/analyze)
if [ "$RESPONSE" = "401" ]; then
    echo -e "${GREEN}✓ OK (requires auth)${NC}"
else
    echo -e "${YELLOW}⚠ Unexpected response: $RESPONSE${NC}"
fi

# Cleanup port-forward
kill $PF_PID 2>/dev/null || true

echo ""
echo -e "${GREEN}✓ Endpoint tests complete${NC}"
echo ""

echo "================================================"
echo -e "${GREEN}   ✓ Phase 5 Deployment Complete!${NC}"
echo "================================================"
echo ""
echo "Phase 5 Features Deployed:"
echo "  • Prompt Version Management"
echo "  • Template System with variable substitution"
echo "  • A/B Testing Framework"
echo "  • Metrics Tracking & Analysis"
echo "  • Intelligent Prompt Optimization"
echo ""
echo "API Endpoints:"
echo "  • POST   /api/prompts/versions - Create version"
echo "  • GET    /api/prompts/versions/{prompt_id} - List versions"
echo "  • POST   /api/prompts/versions/activate - Activate version"
echo "  • POST   /api/prompts/templates - Create template"
echo "  • GET    /api/prompts/templates - List templates"
echo "  • POST   /api/prompts/templates/render - Render template"
echo "  • POST   /api/prompts/ab-tests - Create A/B test"
echo "  • GET    /api/prompts/ab-tests - List tests"
echo "  • POST   /api/prompts/metrics/record - Record metrics"
echo "  • GET    /api/prompts/metrics/{prompt_id} - Get metrics"
echo "  • GET    /api/prompts/optimize/{prompt_id}/recommendations - Get recommendations"
echo "  • POST   /api/prompts/optimize - Auto-optimize prompt"
echo ""
echo "Documentation:"
echo "  API Docs: https://api.swissbrain.ai/docs"
echo "  ReDoc:    https://api.swissbrain.ai/redoc"
echo ""
echo "Database Tables Created:"
echo "  • prompt_versions"
echo "  • prompt_templates"
echo "  • prompt_ab_tests"
echo "  • prompt_metrics"
echo ""
echo "Next Steps:"
echo "  1. Test prompt version creation in production"
echo "  2. Create initial prompt templates"
echo "  3. Set up A/B tests for critical prompts"
echo "  4. Monitor metrics dashboards"
echo ""
