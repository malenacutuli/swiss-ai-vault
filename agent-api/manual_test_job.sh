#!/bin/bash
# Manually enqueue a job to test worker without needing API token

set -e

echo "=== Manual Job Queue Test ==="
echo ""

# You'll need a valid user_id and run_id from your database
# Let's check what's in agent_runs table first

echo "This test requires a valid run_id from your database."
echo ""
echo "Steps to create a test job manually:"
echo ""
echo "1. In Supabase SQL Editor, create a test run:"
echo ""
echo "INSERT INTO agent_runs (id, user_id, prompt, status)"
echo "VALUES ("
echo "  gen_random_uuid(),"
echo "  (SELECT user_id FROM credit_balances LIMIT 1),"
echo "  'Test Phase 2B: List files',"
echo "  'queued'"
echo ")"
echo "RETURNING id;"
echo ""
echo "2. Copy the returned run_id"
echo ""
echo "3. Enqueue it to Redis:"
echo ""
echo "export REDIS_URL=\"redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379\""
echo ""
echo 'python3 -c "'
echo 'from redis import Redis'
echo 'import ssl'
echo 'import json'
echo 'from datetime import datetime'
echo 'r = Redis.from_url(\"rediss://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379\", decode_responses=True, ssl_cert_reqs=ssl.CERT_NONE)'
echo 'job = {'
echo '    \"run_id\": \"YOUR_RUN_ID_HERE\",'
echo '    \"enqueued_at\": datetime.utcnow().isoformat(),'
echo '    \"priority\": 0,'
echo '    \"retry_count\": 0'
echo '}'
echo 'r.lpush(\"jobs:pending\", json.dumps(job))'
echo 'print(\"Job enqueued!\")'
echo '"'
echo ""
echo "4. Monitor the queue:"
echo "   watch -n 2 'python3 check_redis.py | grep -A 10 \"Queue Status\"'"
