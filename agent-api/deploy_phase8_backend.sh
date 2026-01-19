#!/bin/bash
set -e

echo "=============================================="
echo "Phase 8 Backend Deployment Script"
echo "SwissBrain Advanced Features System"
echo "=============================================="
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
IMAGE_TAG="v14-phase8"
IMAGE="docker.io/axessvideo/agent-api:${IMAGE_TAG}"
NAMESPACE="agents"

echo -e "${BLUE}🔍 Pre-Deployment Checks${NC}"
echo "=============================================="
echo ""

# Check if kubectl is configured
if ! kubectl cluster-info &> /dev/null; then
    echo -e "${RED}❌ kubectl not configured or cluster not accessible${NC}"
    echo ""
    echo -e "${YELLOW}Note: If kubectl is not configured, the deployment will still build"
    echo "and push the Docker image. You can deploy to K8s manually later.${NC}"
    echo ""
    read -p "Continue without kubectl? (y/n) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Deployment cancelled.${NC}"
        exit 1
    fi
    KUBECTL_AVAILABLE=false
else
    echo -e "${GREEN}✓ kubectl configured${NC}"
    KUBECTL_AVAILABLE=true
fi

if [ "$KUBECTL_AVAILABLE" = true ]; then
    # Check if namespace exists
    if ! kubectl get namespace "$NAMESPACE" &> /dev/null; then
        echo -e "${RED}❌ Namespace '$NAMESPACE' not found${NC}"
        exit 1
    fi
    echo -e "${GREEN}✓ Namespace '$NAMESPACE' exists${NC}"
fi

echo ""
echo -e "${BLUE}Phase 8 Features${NC}"
echo "=============================================="
echo ""
echo "Phase 8 implements advanced features (no database migrations required):"
echo "  • Scheduled task system with cron support"
echo "  • Data analysis and visualization tools"
echo "  • Cloud browser session management"
echo "  • MCP protocol support (Model Context Protocol)"
echo ""
echo -e "${GREEN}✓ All features are code-based (no DB changes)${NC}"
echo ""

echo -e "${BLUE}Step 1: Build and Push Docker Image${NC}"
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

if [ "$KUBECTL_AVAILABLE" = false ]; then
    echo ""
    echo -e "${YELLOW}=============================================="
    echo "⚠️  kubectl not configured"
    echo "==============================================${NC}"
    echo ""
    echo "Docker image has been built and pushed successfully:"
    echo -e "  ${GREEN}${IMAGE}${NC}"
    echo ""
    echo "To deploy to Kubernetes manually, run these commands:"
    echo ""
    echo "  # Update API deployment"
    echo "  kubectl set image deployment/agent-api agent-api=$IMAGE -n $NAMESPACE"
    echo ""
    echo "  # Update worker deployment"
    echo "  kubectl set image deployment/agent-worker worker=$IMAGE -n $NAMESPACE"
    echo ""
    echo "  # Wait for rollouts"
    echo "  kubectl rollout status deployment/agent-api -n $NAMESPACE"
    echo "  kubectl rollout status deployment/agent-worker -n $NAMESPACE"
    echo ""
    exit 0
fi

echo ""
echo -e "${BLUE}Step 2: Deploy to Kubernetes${NC}"
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
echo -e "${BLUE}Step 3: Verify Deployment${NC}"
echo "=============================================="
echo ""

echo "Waiting for API rollout..."
if kubectl rollout status deployment/agent-api -n "$NAMESPACE" --timeout=180s ; then
    echo -e "${GREEN}✓ API deployment ready${NC}"
else
    echo -e "${RED}❌ API deployment failed${NC}"
    echo "Check logs with: kubectl logs -f deployment/agent-api -n $NAMESPACE"
    exit 1
fi

echo ""
echo "Waiting for worker rollout..."
if kubectl rollout status deployment/agent-worker -n "$NAMESPACE" --timeout=180s ; then
    echo -e "${GREEN}✓ Worker deployment ready${NC}"
else
    echo -e "${RED}❌ Worker deployment failed${NC}"
    echo "Check logs with: kubectl logs -f deployment/agent-worker -n $NAMESPACE"
    exit 1
fi

echo ""
echo -e "${BLUE}Step 4: Health Checks${NC}"
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
echo "✅ Phase 8 Deployment Complete!"
echo "==============================================${NC}"
echo ""
echo -e "${BLUE}Phase 8 Features Now Available:${NC}"
echo ""
echo "  1. Scheduled Task System ⏰"
echo "     • Cron-based task scheduling"
echo "     • Pause/resume functionality"
echo "     • Execution history tracking"
echo ""
echo "  2. Data Analysis Tools 📊"
echo "     • Dataset analysis with field detection"
echo "     • Statistics calculation (min, max, avg)"
echo "     • Automatic insight generation"
echo "     • Chart data preparation"
echo ""
echo "  3. Cloud Browser Sessions 🌐"
echo "     • Persistent session management"
echo "     • Navigation history tracking"
echo "     • Multi-session support"
echo "     • Activity monitoring"
echo ""
echo "  4. MCP Protocol Support 🔌"
echo "     • Model Context Protocol v1.0"
echo "     • Tool listing and execution"
echo "     • Resource management"
echo "     • Third-party integration ready"
echo ""
echo -e "${BLUE}Python Modules Available:${NC}"
echo "  • app.scheduler.TaskScheduler"
echo "  • app.analysis.DataAnalyzer"
echo "  • app.browser.CloudBrowserSessionManager"
echo "  • app.mcp.MCPProtocolHandler"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "  1. Test scheduled task creation"
echo "  2. Test data analysis on sample datasets"
echo "  3. Create browser sessions and navigate"
echo "  4. Test MCP protocol integration"
echo "  5. Update API routes to expose Phase 8 features"
echo "  6. Create frontend UI for advanced features"
echo ""
echo -e "${BLUE}Verify Deployment:${NC}"
echo "  kubectl get pods -n $NAMESPACE"
echo "  kubectl logs -f deployment/agent-api -n $NAMESPACE"
echo "  kubectl logs -f deployment/agent-worker -n $NAMESPACE"
echo ""
echo -e "${BLUE}Test Phase 8 Features:${NC}"
echo "  # Import and use in Python"
echo "  from app.scheduler import TaskScheduler"
echo "  from app.analysis import DataAnalyzer"
echo "  from app.browser import CloudBrowserSessionManager"
echo "  from app.mcp import MCPProtocolHandler"
echo ""
echo -e "${GREEN}Deployment successful! 🚀${NC}"
echo ""
