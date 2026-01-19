#!/bin/bash
# Test E2B V2 with Sandbox.create() fix

set -e

echo "=== Testing E2B V2 (Final Fix) ==="
echo ""
echo "Fix: Using Sandbox.create() instead of Sandbox()"
echo ""

echo "Step 1: Restart deployment..."
kubectl rollout restart deployment/agent-worker -n agents

echo ""
echo "Step 2: Wait for rollout..."
kubectl rollout status deployment/agent-worker -n agents --timeout=120s

echo ""
echo "Step 3: Wait 30 seconds for worker initialization..."
sleep 30

echo ""
echo "Step 4: Verify E2B initialization in logs..."
kubectl logs -n agents -l app=agent-worker --tail=50 | grep -i "e2b\|initialized" || echo "Warning: Could not check logs"

echo ""
echo "Step 5: Clear failed jobs..."
python3 -c "
import os
from upstash_redis import Redis

redis_url = os.environ['REDIS_URL']
r = Redis.from_url(redis_url)
result = r.delete('jobs:failed')
print(f'✓ Cleared {result} failed jobs')
"

echo ""
echo "Step 6: Create test job..."
TEST_OUTPUT=$(python3 setup_test_user.py 2>&1)
RUN_ID=$(echo "$TEST_OUTPUT" | grep "Created test run:" | awk '{print $NF}')
echo "Test run ID: $RUN_ID"

echo ""
echo "Step 7: Monitor execution (60 seconds)..."
for i in {1..12}; do
    sleep 5
    STATUS=$(python3 check_redis.py 2>&1 | grep -A 5 "Queue Status" || echo "")
    PENDING=$(echo "$STATUS" | grep "Pending jobs:" | awk '{print $NF}')
    FAILED=$(echo "$STATUS" | grep "Failed jobs:" | awk '{print $NF}')
    echo "[$((i*5))s] Pending: $PENDING, Failed: $FAILED"

    if [ "$PENDING" = "0" ] && [ "$FAILED" = "0" ]; then
        echo ""
        echo "✓ Job completed successfully!"
        break
    fi
done

echo ""
echo "Step 8: Final status check..."
python3 check_redis.py 2>&1 | grep -A 10 "Queue Status"

echo ""
echo "Step 9: Check failed jobs (if any)..."
python3 check_failed_jobs.py 2>&1 | head -50

echo ""
echo "=== Test Complete ==="
echo ""
echo "If you see 'Pending: 0, Failed: 0' above, E2B V2 is working!"
echo "If the job failed, check the error message in the failed jobs output above."
