#!/bin/bash
# Test worker after database schema fix

set -e

echo "=== Phase 2B Post-Schema-Fix Test ==="
echo ""

# Check if REDIS_URL is set
if [ -z "$REDIS_URL" ]; then
    export REDIS_URL="redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"
fi

echo "1. Clear failed jobs queue"
python3 -c "
from redis import Redis
import ssl
r = Redis.from_url('rediss://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379', decode_responses=True, ssl_cert_reqs=ssl.CERT_NONE)
count = r.llen('jobs:failed')
if count > 0:
    for i in range(count):
        r.rpop('jobs:failed')
    print(f'✓ Cleared {count} failed jobs')
else:
    print('✓ No failed jobs to clear')
"

echo ""
echo "2. Check current queue status"
python3 check_redis.py | grep -A 10 "Queue Status"

echo ""
echo "3. Worker status"
kubectl get pods -n agents -l app=agent-worker -o wide

echo ""
echo "4. Create a test job (via API)"
echo "   Run this to test:"
echo "   curl -X POST https://api.swissbrain.ai/agent/execute \\"
echo "     -H 'Authorization: Bearer \$TOKEN' \\"
echo "     -d '{\"action\": \"create\", \"prompt\": \"Test Phase 2B worker\"}'"
echo ""
echo "   Then start it:"
echo "   curl -X POST https://api.swissbrain.ai/agent/execute \\"
echo "     -H 'Authorization: Bearer \$TOKEN' \\"
echo "     -d '{\"action\": \"start\", \"run_id\": \"<run_id>\"}'"

echo ""
echo "5. Monitor queue"
echo "   Watch the queue in real-time:"
echo "   watch -n 2 'python3 check_redis.py | grep -A 10 \"Queue Status\"'"
