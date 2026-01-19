#!/bin/bash
# One-line test - gets credentials from k8s and runs test

echo "=== Getting credentials from K8s ==="
export SUPABASE_URL=$(kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_URL}' 2>/dev/null | base64 -d 2>/dev/null)
export SUPABASE_SERVICE_ROLE_KEY=$(kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_SERVICE_ROLE_KEY}' 2>/dev/null | base64 -d 2>/dev/null)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo ""
    echo "❌ Could not get credentials from K8s"
    echo ""
    echo "kubectl is not connected. Please set manually:"
    echo ""
    echo "  export SUPABASE_URL=\"your_url\""
    echo "  export SUPABASE_SERVICE_ROLE_KEY=\"your_key\""
    echo "  python3 test_v2_direct.py"
    echo ""
    exit 1
fi

echo "✓ Got credentials"
echo ""

echo "=== Running Test ==="
python3 test_v2_direct.py
