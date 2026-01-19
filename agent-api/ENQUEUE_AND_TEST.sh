#!/bin/bash
# Run this on a machine with kubectl access to test v6-working

RUN_ID="26c5a929-edd7-43f8-ae12-b6588f1124f1"
REDIS_URL="redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"

echo "=== Enqueue Job to Redis ==="
echo "Run ID: $RUN_ID"
echo ""

# Enqueue the job
kubectl exec -n agents deployment/agent-worker -- python3 -c "
import redis
import json
from datetime import datetime

r = redis.from_url('$REDIS_URL')
job_data = {
    'run_id': '$RUN_ID',
    'enqueued_at': '2026-01-14T17:59:25.112565',
    'priority': 0,
    'retry_count': 0
}
r.lpush('jobs:pending', json.dumps(job_data))
print('✓ Job enqueued')
print(f'Queue length: {r.llen(\"jobs:pending\")}')
"

echo ""
echo "=== Monitoring Worker Logs ==="
echo "Watching for run $RUN_ID..."
echo ""

# Watch logs for 30 seconds
timeout 30 kubectl logs -n agents deployment/agent-worker -f --tail=50 | grep -E "(Processing job|$RUN_ID|Error|SyncQueryRequestBuilder)" &
LOGS_PID=$!

# Wait 30 seconds
sleep 30

# Kill log watch
kill $LOGS_PID 2>/dev/null

echo ""
echo "=== Check Final Status ==="

python3 -c "
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
run = supabase.table('agent_runs').select('*').eq('id', '$RUN_ID').single().execute()

print(f'')
print(f'=== FINAL RESULTS ===')
print(f'Run ID: $RUN_ID')
print(f'Status: {run.data[\"status\"]}')
print(f'')

if run.data.get('error_message'):
    print(f'❌ Error: {run.data[\"error_message\"]}')
    # Check if it's the old error
    if 'SyncQueryRequestBuilder' in run.data['error_message']:
        print('')
        print('⚠️ STILL GETTING OLD ERROR - Pod may not have pulled v6-working!')
        print('Try: kubectl delete pod -n agents -l app=agent-worker --force')
    else:
        print('')
        print('Different error (progress!):')
        print(run.data['error_message'][:200])
else:
    print('✓ No errors')

if run.data.get('plan'):
    print(f'✓ Plan created')

steps = supabase.table('agent_steps').select('*').eq('run_id', '$RUN_ID').execute()
print(f'✓ Agent Steps: {len(steps.data or [])}')

messages = supabase.table('agent_messages').select('*').eq('run_id', '$RUN_ID').execute()
print(f'✓ Agent Messages: {len(messages.data or [])}')

logs = supabase.table('agent_task_logs').select('*').eq('run_id', '$RUN_ID').limit(5).execute()
print(f'✓ Task Logs: {len(logs.data or [])}')
if logs.data:
    print('')
    print('Recent logs:')
    for log in logs.data:
        print(f'  [{log[\"log_type\"]}] {log[\"message\"][:80]}')

print('')
if run.data['status'] == 'completed':
    print('✅ TEST PASSED - v6-working is working!')
elif run.data['status'] == 'failed':
    print('❌ TEST FAILED')
elif run.data['status'] in ['planning', 'executing']:
    print('⏳ Still running - may need more time')
else:
    print(f'⚠️ Status: {run.data[\"status\"]}')
"
