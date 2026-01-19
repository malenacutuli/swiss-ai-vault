#!/bin/bash
# Test E2B with real coding task

set -e

echo "Creating coding task agent run..."

# Get the worker pod name
WORKER_POD=$(kubectl get pods -n agents -l app=agent-worker -o jsonpath='{.items[0].metadata.name}' 2>/dev/null || echo "")

if [ -z "$WORKER_POD" ]; then
    echo "❌ Could not find worker pod. Is kubectl configured?"
    echo "Attempting to use local environment..."

    # Try local execution
    python3 create_coding_task.py
    exit $?
fi

echo "✓ Found worker pod: $WORKER_POD"
echo ""

# Copy script to worker pod
kubectl cp create_coding_task.py agents/$WORKER_POD:/tmp/create_coding_task.py

# Execute in worker pod (has all env vars)
echo "Executing in worker pod..."
kubectl exec -n agents $WORKER_POD -- python3 /tmp/create_coding_task.py

echo ""
echo "✓ Task created and enqueued"
echo ""
echo "Monitor execution:"
echo "  kubectl logs -f -n agents $WORKER_POD"
