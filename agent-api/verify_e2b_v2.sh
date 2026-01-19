#!/bin/bash
# Verify E2B V2 deployment and check for E2B initialization

set -e

echo "=== Verifying E2B V2 Deployment ==="
echo ""

echo "Step 1: Check current pod..."
kubectl get pods -n agents -l app=agent-worker

echo ""
echo "Step 2: Force restart deployment (ensure new pod with new image)..."
kubectl rollout restart deployment/agent-worker -n agents

echo ""
echo "Step 3: Wait for new pod to be ready..."
kubectl rollout status deployment/agent-worker -n agents --timeout=120s

echo ""
echo "Step 4: Get new pod name..."
NEW_POD=$(kubectl get pods -n agents -l app=agent-worker -o jsonpath='{.items[0].metadata.name}')
echo "New pod: $NEW_POD"

echo ""
echo "Step 5: Wait 30 seconds for worker initialization..."
sleep 30

echo ""
echo "Step 6: Check Redis debug logs for E2B initialization..."
echo "Looking for: '✓ E2B Agent Executor initialized - using hybrid architecture'"
echo ""
python3 check_redis.py | head -50

echo ""
echo "Step 7: Check if worker entered main loop..."
python3 check_redis.py | grep -A 3 "Recent worker logs" || true

echo ""
echo "Step 8: Check queue status..."
python3 check_redis.py | grep -A 5 "Queue Status"

echo ""
echo "=== Manual Verification ==="
echo ""
echo "To check pod logs directly (if kubectl works):"
echo "  kubectl logs -n agents $NEW_POD --tail=100"
echo ""
echo "Expected in logs:"
echo "  ✓ E2B Code Interpreter available"
echo "  ✓ E2B API key configured: e2b_a33017..."
echo "  ✓ E2B Agent Executor initialized - using hybrid architecture"
echo "  Initialized job processor"
echo ""
echo "If you see these logs, E2B V2 is working!"
