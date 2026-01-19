#!/bin/bash
set -e

echo "=== Deploying FINAL image with all TLS fixes ==="
kubectl set image deployment/agent-worker worker=docker.io/axessvideo/agent-api:phase2b-final -n agents

echo ""
echo "=== Waiting for rollout ==="
kubectl rollout status deployment/agent-worker -n agents

echo ""
echo "=== Waiting 60 seconds for worker to fully initialize ==="
sleep 60

echo ""
echo "=== Checking Redis for worker activity ==="
export REDIS_URL="redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"
python3 check_redis.py

echo ""
echo "=== Pod Status ==="
kubectl get pods -n agents -l app=agent-worker -o wide

echo ""
echo "=== Expected Success Markers ==="
echo "✓ Worker __init__ started - Should be recent"
echo "✓ Main loop entered - Worker processing loop started"
echo "✓ Heartbeat fresh (< 60 seconds old)"
echo "✓ Pod Running with 0 restarts"
echo "✓ Jobs:pending decreasing as jobs are processed"
