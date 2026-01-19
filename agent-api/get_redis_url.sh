#!/bin/bash
# Get REDIS_URL from kubernetes secret

echo "Fetching REDIS_URL from kubernetes secret..."
REDIS_URL=$(kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.REDIS_URL}' | base64 -d)

if [ -z "$REDIS_URL" ]; then
    echo "❌ Failed to fetch REDIS_URL from kubernetes"
    echo "Please set it manually:"
    echo "  export REDIS_URL='your-redis-url'"
    exit 1
fi

echo "✓ Got REDIS_URL"
export REDIS_URL="$REDIS_URL"

echo ""
echo "Run this command to set REDIS_URL in your shell:"
echo "  export REDIS_URL='$REDIS_URL'"
echo ""
echo "Or run:"
echo "  source <(./get_redis_url.sh)"
