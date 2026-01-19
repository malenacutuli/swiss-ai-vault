#!/bin/bash
# Create and start a test job to verify Phase 2B works end-to-end

set -e

# Check if TOKEN is set
if [ -z "$SWISSBRAIN_TOKEN" ]; then
    echo "Error: SWISSBRAIN_TOKEN environment variable not set"
    echo "Export it with: export SWISSBRAIN_TOKEN='your-token-here'"
    exit 1
fi

API_URL="https://api.swissbrain.ai/agent/execute"

echo "=== Creating test job ==="
CREATE_RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Authorization: Bearer $SWISSBRAIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "create", "prompt": "Test Phase 2B worker infrastructure - list files in current directory"}')

echo "Create response: $CREATE_RESPONSE"

# Extract run_id
RUN_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('run_id', ''))")

if [ -z "$RUN_ID" ]; then
    echo "Error: Failed to create job or extract run_id"
    echo "Response: $CREATE_RESPONSE"
    exit 1
fi

echo ""
echo "✓ Job created with run_id: $RUN_ID"

echo ""
echo "=== Starting job ==="
START_RESPONSE=$(curl -s -X POST "$API_URL" \
  -H "Authorization: Bearer $SWISSBRAIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"action\": \"start\", \"run_id\": \"$RUN_ID\"}")

echo "Start response: $START_RESPONSE"

echo ""
echo "=== Monitoring queue (20 seconds) ==="
export REDIS_URL="redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"

for i in {1..10}; do
    echo "Check $i/10:"
    python3 check_redis.py 2>/dev/null | grep -A 5 "Queue Status" || true
    echo ""
    sleep 2
done

echo ""
echo "=== Final status ==="
python3 check_redis.py | grep -A 10 "Queue Status"

echo ""
echo "=== Check if job succeeded ==="
python3 check_failed_jobs.py | head -20

echo ""
echo "Run ID: $RUN_ID"
echo "Check logs at: https://api.swissbrain.ai/agent/logs/$RUN_ID/stream"
