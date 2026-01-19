#!/bin/bash
# Simple check: Is the worker actually running?

echo "=== Checking if worker process is running ==="

# Check if worker process exists in pod
kubectl exec -n agents deployment/agent-worker -- ps aux | grep -E "(python|worker|main)" || echo "No worker process found"

echo ""
echo "=== Checking if worker is listening to Redis ==="

# Try to see what Python processes are running
kubectl exec -n agents deployment/agent-worker -- python3 -c "
import redis
r = redis.from_url('redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379')
print(f'Queue jobs:pending: {r.llen(\"jobs:pending\")}')
print(f'Queue jobs:processing: {r.llen(\"jobs:processing\")}')
print(f'Queue jobs:failed: {r.llen(\"jobs:failed\")}')
" 2>&1

echo ""
echo "=== Checking pod command ==="
kubectl get pod -n agents -l app=agent-worker -o jsonpath='{.items[0].spec.containers[0].command}' && echo ""

echo ""
echo "=== What is the worker supposed to be running? ==="
cat k8s/worker-deployment.yaml | grep -A 5 "command:"
