#!/bin/bash
set -e

echo "=============================================="
echo "Phase 7 Backend Deployment Script"
echo "SwissBrain Wide Research System"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
IMAGE_TAG="v13-phase7"
IMAGE="docker.io/axessvideo/agent-api:${IMAGE_TAG}"
NAMESPACE="agents"
MIGRATION_FILE="supabase_migrations/20260115000002_research_jobs.sql"

echo -e "${BLUE}🔍 Pre-Deployment Checks${NC}"
echo "=============================================="
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo -e "${RED}❌ Migration file not found: $MIGRATION_FILE${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Migration file found${NC}"

# Check if kubectl is configured
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ kubectl not configured or cluster not accessible${NC}"
    exit 1
fi
echo -e "${GREEN}✓ kubectl configured${NC}"

# Check if namespace exists
if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
    echo -e "${RED}❌ Namespace '$NAMESPACE' not found${NC}"
    exit 1
fi
echo -e "${GREEN}✓ Namespace '$NAMESPACE' exists${NC}"

echo ""
echo -e "${BLUE}Step 1: Database Migration${NC}"
echo "=============================================="
echo ""
echo "The Phase 7 database migration creates 4 tables for wide research:"
echo "  • research_jobs - Main job tracking"
echo "  • research_subtasks - Agent subtask management"
echo "  • research_results - Individual agent results"
echo "  • research_synthesis - Final synthesized output"
echo ""
echo -e "${YELLOW}⚠️  This migration must be applied via Supabase Dashboard${NC}"
echo ""
echo "Steps to apply migration:"
echo "  1. Go to: https://app.supabase.com/project/YOUR_PROJECT_ID/sql"
echo "  2. Click 'New Query'"
echo "  3. Copy the contents of: $MIGRATION_FILE"
echo "  4. Paste into the SQL editor"
echo "  5. Click 'Run' to execute"
echo ""
echo "Preview of migration:"
cat "$MIGRATION_FILE" | head -25
echo "  ... (truncated, see full file for complete schema)"
echo ""
read -p "Have you applied the database migration? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Please apply the database migration first.${NC}"
    echo "You can apply it later by re-running this script."
    exit 1
fi

echo -e "${GREEN}✓ Database migration confirmed${NC}"
echo ""

echo -e "${BLUE}Step 2: Build and Push Docker Image${NC}"
echo "=============================================="
echo -e "Building image: ${GREEN}${IMAGE}${NC}"
echo ""

# Build Docker image
echo "Building Docker image for linux/amd64..."
if docker build --platform linux/amd64 -t "$IMAGE" . ; then
    echo -e "${GREEN}✓ Docker image built successfully${NC}"
else
    echo -e "${RED}❌ Docker build failed${NC}"
    exit 1
fi

echo ""
echo "Pushing image to Docker Hub..."
if docker push "$IMAGE" ; then
    echo -e "${GREEN}✓ Docker image pushed successfully${NC}"
else
    echo -e "${RED}❌ Docker push failed${NC}"
    echo "Make sure you're logged in: docker login"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 3: Deploy to Kubernetes${NC}"
echo "=============================================="
echo ""

# Update API deployment
echo "Updating agent-api deployment..."
if kubectl set image deployment/agent-api agent-api="$IMAGE" -n "$NAMESPACE" ; then
    echo -e "${GREEN}✓ API deployment updated${NC}"
else
    echo -e "${RED}❌ Failed to update API deployment${NC}"
    exit 1
fi

# Update worker deployment
echo "Updating agent-worker deployment..."
if kubectl set image deployment/agent-worker worker="$IMAGE" -n "$NAMESPACE" ; then
    echo -e "${GREEN}✓ Worker deployment updated${NC}"
else
    echo -e "${RED}❌ Failed to update worker deployment${NC}"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 4: Verify Deployment${NC}"
echo "=============================================="
echo ""

echo "Waiting for API rollout..."
if kubectl rollout status deployment/agent-api -n "$NAMESPACE" --timeout=120s ; then
    echo -e "${GREEN}✓ API deployment ready${NC}"
else
    echo -e "${RED}❌ API deployment failed${NC}"
    echo "Check logs with: kubectl logs -f deployment/agent-api -n $NAMESPACE"
    exit 1
fi

echo ""
echo "Waiting for worker rollout..."
if kubectl rollout status deployment/agent-worker -n "$NAMESPACE" --timeout=120s ; then
    echo -e "${GREEN}✓ Worker deployment ready${NC}"
else
    echo -e "${RED}❌ Worker deployment failed${NC}"
    echo "Check logs with: kubectl logs -f deployment/agent-worker -n $NAMESPACE"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 5: Health Checks${NC}"
echo "=============================================="
echo ""

# Check API pods
API_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=agent-api --field-selector=status.phase=Running -o name | wc -l)
echo "API pods running: $API_PODS"

# Check worker pods
WORKER_PODS=$(kubectl get pods -n "$NAMESPACE" -l app=agent-worker --field-selector=status.phase=Running -o name | wc -l)
echo "Worker pods running: $WORKER_PODS"

if [ "$API_PODS" -gt 0 ] && [ "$WORKER_PODS" -gt 0 ]; then
    echo -e "${GREEN}✓ All pods running${NC}"
else
    echo -e "${RED}⚠️  Some pods may not be running${NC}"
fi

echo ""
echo -e "${GREEN}=============================================="
echo "✅ Phase 7 Deployment Complete!"
echo "=============================================="${NC}
echo ""
echo -e "${BLUE}Phase 7 Features Now Available:${NC}"
echo "  • Wide research job system"
echo "  • Parallel agent spawning (up to 20 agents)"
echo "  • Result collection and synthesis"
echo "  • Progress tracking (0-100%)"
echo "  • Error handling and recovery"
echo ""
echo -e "${BLUE}Database Tables Created:${NC}"
echo "  • research_jobs"
echo "  • research_subtasks"
echo "  • research_results"
echo "  • research_synthesis"
echo ""
echo -e "${BLUE}Python Modules Available:${NC}"
echo "  • app.research.WideResearchJobManager"
echo "  • app.research.ParallelAgentCoordinator"
echo "  • app.research.ResultSynthesizer"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Integrate with existing agent system"
echo "  2. Add API endpoints for research jobs"
echo "  3. Create frontend UI for research dashboard"
echo ""
echo -e "${BLUE}Verify Deployment:${NC}"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl logs -f deployment/agent-api -n $NAMESPACE"
echo "  kubectl logs -f deployment/agent-worker -n $NAMESPACE"
echo ""
echo -e "${GREEN}Deployment successful! 🚀${NC}"
echo ""
