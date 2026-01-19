#!/bin/bash
# Get E2B execution logs for the coding task

RUN_ID="4a29901c-ce4d-4a3c-8639-6217192b2ad3"

echo "=== E2B Execution Logs for Run: $RUN_ID ==="
echo ""
echo "Fetching worker logs from the time the job was processed..."
echo ""

# Get logs from the worker pod
# The job ran from 12:52:47 to 12:54:27 UTC
kubectl logs -n agents deployment/agent-worker --tail=500 | grep -A 100 "$RUN_ID" || \
kubectl logs -n agents deployment/agent-worker --tail=1000 | grep -A 200 "4a29901c" || \
echo "Could not find logs with kubectl. Showing recent worker logs:" && \
kubectl logs -n agents deployment/agent-worker --tail=200
