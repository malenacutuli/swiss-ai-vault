#!/bin/bash
# Deploy E2B V2 with API key fix

set -e

echo "=== Deploying E2B V2 (Fixed) ==="
echo ""
echo "Fix: Sandbox() now uses E2B_API_KEY from environment (not constructor param)"
echo ""

echo "Step 1: Restart deployment to use updated image..."
kubectl rollout restart deployment/agent-worker -n agents

echo ""
echo "Step 2: Wait for rollout..."
kubectl rollout status deployment/agent-worker -n agents --timeout=120s

echo ""
echo "Step 3: Wait 30 seconds for worker initialization..."
sleep 30

echo ""
echo "Step 4: Check Redis debug logs..."
python3 check_redis.py | head -50

echo ""
echo "Step 5: Clear failed jobs queue..."
redis-cli -u "$REDIS_URL" DEL jobs:failed
echo "✓ Failed jobs queue cleared"

echo ""
echo "Step 6: Create and run test job..."
python3 setup_test_user.py

echo ""
echo "Step 7: Monitor execution (wait 30 seconds)..."
sleep 30

echo ""
echo "Step 8: Check results..."
python3 check_redis.py | grep -A 10 "Queue Status"

echo ""
echo "✓ Deployment complete!"
echo ""
echo "Expected behavior:"
echo "  - Worker creates E2B sandbox successfully"
echo "  - Sandbox installs dependencies (anthropic, supabase, pydantic)"
echo "  - Sandbox fetches run from Supabase"
echo "  - Sandbox calls Anthropic API for planning/execution"
echo "  - Job completes without DNS errors"
