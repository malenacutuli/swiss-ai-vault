#!/bin/bash
set -e

echo "=== Deploying debug image ==="
kubectl set image deployment/agent-worker worker=docker.io/axessvideo/agent-api:phase2b-debug -n agents

echo ""
echo "=== Waiting for rollout ==="
kubectl rollout status deployment/agent-worker -n agents

echo ""
echo "=== Waiting 30 seconds for worker to start ==="
sleep 30

echo ""
echo "=== Checking Redis for new diagnostics ==="
REDIS_URL="redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"
python3 check_redis.py

echo ""
echo "=== Pod Status ==="
kubectl get pods -n agents -l app=agent-worker -o wide
