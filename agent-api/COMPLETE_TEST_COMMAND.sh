#!/bin/bash
# Complete test command with all known information pre-filled

# Known values from k8s/secrets.yaml:
export SUPABASE_URL="https://auth.swissvault.ai"

# Service role key - needs to be provided
# Get it from K8s or Supabase dashboard

if [ -z "$SUPABASE_SERVICE_ROLE_KEY" ]; then
    echo "=== Get Service Role Key ==="
    echo ""
    echo "Option 1: From K8s (if kubectl works on another machine):"
    echo "  kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_SERVICE_ROLE_KEY}' | base64 -d"
    echo ""
    echo "Option 2: From Supabase Dashboard:"
    echo "  1. Go to: https://supabase.com/dashboard/project/ghmmdochvlrnwbruyrqk/settings/api"
    echo "  2. Copy the 'service_role' key (starts with 'eyJ...')"
    echo ""
    echo "Then run:"
    echo "  export SUPABASE_SERVICE_ROLE_KEY='your_key_here'"
    echo "  bash COMPLETE_TEST_COMMAND.sh"
    echo ""
    exit 1
fi

echo "=== Testing V2 with Known Credentials ==="
echo ""
echo "✓ SUPABASE_URL: $SUPABASE_URL"
echo "✓ SUPABASE_SERVICE_ROLE_KEY: ${SUPABASE_SERVICE_ROLE_KEY:0:20}..."
echo ""

# Run the test
python3 test_v2_direct.py "$@"
