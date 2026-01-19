#!/bin/bash
# Single command to get credentials and run test

export SUPABASE_URL=$(kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_URL}' 2>/dev/null | base64 -d 2>/dev/null)
export SUPABASE_SERVICE_ROLE_KEY=$(kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_SERVICE_ROLE_KEY}' 2>/dev/null | base64 -d 2>/dev/null)

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "❌ kubectl not connected. Run this instead:"
    echo ""
    echo "export SUPABASE_URL='<your_url>'"
    echo "export SUPABASE_SERVICE_ROLE_KEY='<your_key>'"
    echo "python3 test_v2_direct.py"
    exit 1
fi

python3 test_v2_direct.py "$@"
