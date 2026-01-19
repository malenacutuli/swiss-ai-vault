#!/bin/bash
# Manual test for v6-working deployment
# Run this on a machine with kubectl access to the cluster

echo "=== V6-WORKING MANUAL TEST ==="
echo ""

# Run ID from the test
RUN_ID="f8e6e13b-9775-497e-bd82-9ba0a5b01e49"
REDIS_URL="redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"

echo "1. Enqueueing job to Redis..."
kubectl exec -n agents deployment/agent-worker -- python3 -c "
import redis
import json
r = redis.from_url('$REDIS_URL')
job_data = {
    'run_id': '$RUN_ID',
    'enqueued_at': '2026-01-14T17:53:40.257474',
    'priority': 0,
    'retry_count': 0
}
r.lpush('jobs:pending', json.dumps(job_data))
print('✓ Job enqueued')
print(f'Queue length: {r.llen(\"jobs:pending\")}')
"

echo ""
echo "2. Waiting 30 seconds for worker to process..."
sleep 30

echo ""
echo "3. Checking worker logs..."
kubectl logs -n agents deployment/agent-worker --tail=50 | grep -E "(Processing job|Error|f8e6e13b)"

echo ""
echo "4. Checking run status in database..."
python3 -c "
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
run = supabase.table('agent_runs').select('*').eq('id', '$RUN_ID').single().execute()

print(f'Status: {run.data[\"status\"]}')
if run.data.get('error'):
    print(f'❌ Error: {run.data[\"error\"]}')
else:
    print('✓ No errors')

if run.data.get('plan'):
    print(f'✓ Plan created')
else:
    print('⚠️ No plan')

steps = supabase.table('agent_steps').select('*').eq('run_id', '$RUN_ID').execute()
print(f'Agent Steps: {len(steps.data or [])}')

messages = supabase.table('agent_messages').select('*').eq('run_id', '$RUN_ID').execute()
print(f'Agent Messages: {len(messages.data or [])}')

logs = supabase.table('agent_task_logs').select('*').eq('run_id', '$RUN_ID').execute()
print(f'Task Logs: {len(logs.data or [])}')

if run.data['status'] == 'completed':
    print('')
    print('✅ TEST PASSED!')
elif run.data['status'] == 'failed':
    print('')
    print('❌ TEST FAILED')
    print(f'Error: {run.data.get(\"error\", \"Unknown\")}')
else:
    print('')
    print(f'⚠️ Still processing: {run.data[\"status\"]}')
"

echo ""
echo "=== TEST COMPLETE ==="
