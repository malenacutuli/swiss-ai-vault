#!/bin/bash
# Simple E2B V2 test

set -e

echo "=== E2B V2 Test ==="
echo ""

echo "Step 1: Check recent worker logs from Redis..."
python3 check_redis.py 2>&1 | head -30

echo ""
echo "Step 2: Clear old failed jobs..."
python3 clear_failed.py

echo ""
echo "Step 3: Create new test job..."
python3 setup_test_user.py 2>&1 | grep -E "Created test run:|enqueued|Error" || echo "Check full output"

echo ""
echo "Step 4: Wait 60 seconds for processing..."
sleep 60

echo ""
echo "Step 5: Check queue status..."
python3 check_redis.py 2>&1 | grep -A 10 "Queue Status"

echo ""
echo "Step 6: Check if any jobs failed..."
python3 check_failed_jobs.py 2>&1 | head -60

echo ""
echo "=== Test Complete ==="
