#!/bin/bash
set -e

echo "=== Deploying verbose logging image ==="
kubectl set image deployment/agent-worker worker=docker.io/axessvideo/agent-api:phase2b-verbose -n agents

echo ""
echo "=== Waiting for rollout ==="
kubectl rollout status deployment/agent-worker -n agents

echo ""
echo "=== Waiting 90 seconds for initialization ==="
sleep 90

echo ""
echo "=== Checking Redis (should show where it hangs) ==="
export REDIS_URL="redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"
python3 check_redis.py

echo ""
echo "=== Pod Status ==="
kubectl get pods -n agents -l app=agent-worker -o wide

echo ""
echo "=== What to look for in worker:debug: ==="
echo "1. 'Worker __init__ started' - Init begins"
echo "2. 'Initializing JobQueue...' - About to create JobQueue"
echo "3. '✓ JobQueue initialized' - JobQueue created successfully"
echo "4. 'Initializing JobProcessor...' - About to create JobProcessor"
echo "5. '✓ JobProcessor initialized' - JobProcessor created successfully"
echo "6. '✓ Agent Worker fully initialized' - __init__ complete"
echo "7. '=== start() method called ===' - start() begins"
echo "8. 'Main loop entered' - THE GOAL - worker is processing jobs"
echo ""
echo "If any step is missing, that's where it hangs!"
