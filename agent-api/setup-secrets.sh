#!/bin/bash
set -e

# Setup K8s secrets for Agent API
# This script creates the secrets needed by the agent API

echo "================================"
echo "K8s Secrets Setup"
echo "================================"
echo ""

# Check if secrets already exist
if kubectl get secret agent-api-secrets -n agents &> /dev/null; then
    echo "⚠️  Secret 'agent-api-secrets' already exists in namespace 'agents'"
    read -p "Do you want to delete and recreate it? (y/N) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kubectl delete secret agent-api-secrets -n agents
        echo "✅ Deleted existing secret"
    else
        echo "❌ Aborted. Keeping existing secret."
        exit 0
    fi
fi

echo "📝 Enter secret values (they will be hidden):"
echo ""

# Get Supabase credentials
echo "Supabase (Direct project: ghmmdochvlrnwbruyrqk)"
read -p "SUPABASE_URL [https://auth.swissvault.ai]: " SUPABASE_URL
SUPABASE_URL=${SUPABASE_URL:-https://auth.swissvault.ai}

echo -n "SUPABASE_SERVICE_ROLE_KEY: "
read -s SUPABASE_SERVICE_ROLE_KEY
echo ""

# Get Anthropic API key
echo ""
echo -n "ANTHROPIC_API_KEY: "
read -s ANTHROPIC_API_KEY
echo ""

# Get Redis URL
echo ""
echo "Upstash Redis"
echo -n "REDIS_URL: "
read -s REDIS_URL
echo ""
echo ""

# Create namespace if it doesn't exist
kubectl create namespace agents --dry-run=client -o yaml | kubectl apply -f -

# Create secret
echo "🔐 Creating K8s secret..."
kubectl create secret generic agent-api-secrets \
  --from-literal=SUPABASE_URL="${SUPABASE_URL}" \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY}" \
  --from-literal=ANTHROPIC_API_KEY="${ANTHROPIC_API_KEY}" \
  --from-literal=REDIS_URL="${REDIS_URL}" \
  --namespace=agents

echo "✅ Secret created successfully!"
echo ""

# Verify secret
echo "📋 Verifying secret..."
kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data}' | jq 'keys'

echo ""
echo "🎉 Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Build and push Docker image: ./deploy.sh"
echo "  2. Apply K8s manifests: kubectl apply -f k8s/"
echo "  3. Check deployment: kubectl get pods -n agents"
