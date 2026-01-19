#!/bin/bash
# Deploy E2B V2: Correct Hybrid Architecture (SwissBrain Standard)
#
# Architecture:
#   - Worker (K8s): Receives jobs, spawns E2B sandboxes, updates Redis
#   - E2B Sandbox: Makes ALL external API calls (LLM, Supabase, etc.)
#
# Why: K8s pods have unreliable DNS. E2B sandboxes have reliable networking.

set -e

E2B_API_KEY="e2b_a33017d32c635bed98c3d164e35cfea71765d3dd"

echo "=== Deploying E2B V2: True Hybrid Architecture ==="
echo ""
echo "Key Changes from V1:"
echo "  ✓ LLM calls moved INSIDE E2B sandbox (not from K8s pod)"
echo "  ✓ Supabase calls moved INSIDE E2B sandbox"
echo "  ✓ Worker only orchestrates - no external API calls"
echo ""

echo "Step 1: Adding E2B API key to K8s secrets..."
kubectl create secret generic agent-api-secrets \
  --from-literal=E2B_API_KEY="$E2B_API_KEY" \
  --namespace=agents \
  --dry-run=client -o yaml | kubectl apply -f -

echo "✓ E2B API key added to secrets"
echo ""

echo "Step 2: Building Docker image with E2B V2 architecture..."
docker build --platform linux/amd64 -t docker.io/axessvideo/agent-api:e2b-v2 . 2>&1 | tail -20

echo ""
echo "Step 3: Pushing image to registry..."
docker push docker.io/axessvideo/agent-api:e2b-v2 2>&1 | tail -10

echo ""
echo "Step 4: Updating deployment to use E2B V2 image..."
kubectl set image deployment/agent-worker worker=docker.io/axessvideo/agent-api:e2b-v2 -n agents

echo ""
echo "Step 5: Waiting for rollout..."
kubectl rollout status deployment/agent-worker -n agents

echo ""
echo "Step 6: Waiting 30 seconds for worker to initialize..."
sleep 30

echo ""
echo "=== Verifying E2B V2 Integration ==="
echo "Looking for: '✓ E2B Agent Executor initialized - using hybrid architecture'"
echo ""
python3 check_redis.py | grep -A 20 "Worker Debug Log" || echo "No recent logs yet"

echo ""
echo "✓ Deployment complete!"
echo ""
echo "Architecture:"
echo "  ┌─────────────────────────────────────┐"
echo "  │   Swiss K8s (Geneva)                │"
echo "  │   ┌─────────────────────────────┐   │"
echo "  │   │ Worker: Orchestration only  │   │"
echo "  │   │ - Dequeue from Redis        │   │"
echo "  │   │ - Spawn E2B sandbox         │   │"
echo "  │   │ - Update Redis/Supabase     │   │"
echo "  │   └─────────────────────────────┘   │"
echo "  └─────────────────────────────────────┘"
echo "                  │"
echo "                  │ HTTPS (spawn sandbox)"
echo "                  ▼"
echo "  ┌─────────────────────────────────────┐"
echo "  │   E2B Cloud (Global)                │"
echo "  │   ┌─────────────────────────────┐   │"
echo "  │   │ Sandbox: All API calls      │   │"
echo "  │   │ - Anthropic LLM ✓           │   │"
echo "  │   │ - Supabase DB ✓             │   │"
echo "  │   │ - Tool execution ✓          │   │"
echo "  │   └─────────────────────────────┘   │"
echo "  └─────────────────────────────────────┘"
echo ""
echo "Next steps:"
echo "  1. Clear pending jobs: redis-cli DEL jobs:pending"
echo "  2. Run test: python3 setup_test_user.py"
echo "  3. Monitor: python3 check_redis.py"
