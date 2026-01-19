#!/bin/bash
set -e

echo "=== Deploying TLS fix image ==="
kubectl set image deployment/agent-worker worker=docker.io/axessvideo/agent-api:phase2b-tls-fix -n agents

echo ""
echo "=== Waiting for rollout ==="
kubectl rollout status deployment/agent-worker -n agents

echo ""
echo "=== Waiting 45 seconds for worker to initialize ==="
sleep 45

echo ""
echo "=== Checking Redis ==="
export REDIS_URL="redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"
python3 check_redis.py

echo ""
echo "=== Pod Status ==="
kubectl get pods -n agents -l app=agent-worker -o wide
