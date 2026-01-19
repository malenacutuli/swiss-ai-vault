#!/bin/bash
set -e

# Swiss K8s Agent API Deployment Script
# Builds, pushes, and deploys the agent API to Swiss K8s cluster

# Configuration
REGISTRY="${REGISTRY:-docker.io/axessvideo}"  # Update with your Docker Hub username
IMAGE_NAME="agent-api"
VERSION="${VERSION:-$(git rev-parse --short HEAD || echo 'latest')}"
FULL_IMAGE="${REGISTRY}/${IMAGE_NAME}:${VERSION}"
LATEST_IMAGE="${REGISTRY}/${IMAGE_NAME}:latest"

echo "================================"
echo "Swiss Agent API Deployment"
echo "================================"
echo "Image: ${FULL_IMAGE}"
echo "Latest: ${LATEST_IMAGE}"
echo ""

# Step 1: Build Docker image
echo "🐳 Building Docker image..."
docker build -t ${FULL_IMAGE} -t ${LATEST_IMAGE} .

echo "✅ Image built successfully"
echo ""

# Step 2: Push to registry
echo "📤 Pushing to registry..."
docker push ${FULL_IMAGE}
docker push ${LATEST_IMAGE}

echo "✅ Images pushed successfully"
echo ""

# Step 3: Apply K8s manifests
echo "☸️  Deploying to Kubernetes..."

# Create namespace if it doesn't exist
kubectl create namespace agents --dry-run=client -o yaml | kubectl apply -f -

# Apply manifests (secrets should already exist)
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

echo "✅ Manifests applied"
echo ""

# Step 4: Wait for rollout
echo "⏳ Waiting for deployment to complete..."
kubectl rollout status deployment/agent-api -n agents --timeout=5m

echo "✅ Deployment complete!"
echo ""

# Step 5: Show status
echo "📊 Deployment status:"
kubectl get pods -n agents -l app=agent-api
echo ""

echo "🌐 Service URLs:"
echo "  - Health: https://api.swissbrain.ai/health"
echo "  - API Docs: https://api.swissbrain.ai/docs"
echo "  - Agent Execute: https://api.swissbrain.ai/agent/execute"
echo ""

echo "🎉 Deployment successful!"
