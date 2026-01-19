#!/bin/bash
# Updated test script (no timeout command needed)

RUN_ID="26c5a929-edd7-43f8-ae12-b6588f1124f1"
REDIS_URL="redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"

echo "=== Waiting for new pod to be ready ==="
kubectl wait --for=condition=ready pod -n agents -l app=agent-worker --timeout=60s

echo ""
echo "=== Verifying image ==="
IMAGE=$(kubectl get pods -n agents -l app=agent-worker -o jsonpath='{.items[0].spec.containers[0].image}')
echo "Pod is running: $IMAGE"

if [[ "$IMAGE" != *"v6-working"* ]]; then
    echo "⚠️ WARNING: Pod is not running v6-working!"
    echo "Current image: $IMAGE"
    echo "Expected: docker.io/axessvideo/agent-api:v6-working"
    exit 1
fi

echo ""
echo "=== Enqueue Job to Redis ==="
echo "Run ID: $RUN_ID"
echo ""

kubectl exec -n agents deployment/agent-worker -- python3 -c "
import redis
import json
from datetime import datetime

r = redis.from_url('$REDIS_URL')
job_data = {
    'run_id': '$RUN_ID',
    'enqueued_at': datetime.utcnow().isoformat(),
    'priority': 0,
    'retry_count': 0
}
r.lpush('jobs:pending', json.dumps(job_data))
print('✓ Job enqueued')
queue_len = r.llen('jobs:pending')
print(f'Queue length: {queue_len}')
"

echo ""
echo "=== Waiting 20 seconds for worker to process ==="
sleep 20

echo ""
echo "=== Checking worker logs ==="
kubectl logs -n agents deployment/agent-worker --tail=100 | grep -E "(Processing job|$RUN_ID|Error|SyncQueryRequestBuilder|Planning|Execution)" || echo "No matching log lines"

echo ""
echo "=== Final Status ==="

python3 -c "
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
run = supabase.table('agent_runs').select('*').eq('id', '$RUN_ID').single().execute()

print('')
print('=== RESULTS ===')
print(f'Run ID: $RUN_ID')
print(f'Status: {run.data[\"status\"]}')
print('')

if run.data.get('error_message'):
    error = run.data['error_message']
    print(f'❌ Error: {error[:200]}')

    if 'SyncQueryRequestBuilder' in error:
        print('')
        print('🚨 STILL GETTING OLD ERROR!')
        print('The pod is still running old code.')
        print('')
        print('Try rebuilding and redeploying:')
        print('  1. docker build --no-cache -t docker.io/axessvideo/agent-api:v7-force .')
        print('  2. docker push docker.io/axessvideo/agent-api:v7-force')
        print('  3. Update k8s/worker-deployment.yaml to use v7-force')
        print('  4. kubectl delete deployment agent-worker -n agents')
        print('  5. kubectl apply -f k8s/worker-deployment.yaml')
    else:
        print('')
        print('✅ New error (progress!) - old error is gone')
        print('Full error:')
        print(error)
else:
    print('✅ No errors')

if run.data.get('plan'):
    plan = run.data['plan']
    if isinstance(plan, dict):
        phases = plan.get('phases', [])
        print(f'✅ Plan created with {len(phases)} phases')
    else:
        print('✅ Plan created')
else:
    print('⚠️ No plan')

steps = supabase.table('agent_steps').select('*').eq('run_id', '$RUN_ID').execute()
step_count = len(steps.data or [])
print(f'✅ Agent Steps: {step_count}')
if step_count > 0:
    print('   Steps:')
    for step in (steps.data or [])[:5]:
        print(f'   - {step[\"step_type\"]}: {step[\"status\"]}')

messages = supabase.table('agent_messages').select('*').eq('run_id', '$RUN_ID').execute()
print(f'✅ Agent Messages: {len(messages.data or [])}')

logs = supabase.table('agent_task_logs').select('*').eq('run_id', '$RUN_ID').limit(10).execute()
log_count = len(logs.data or [])
print(f'✅ Task Logs: {log_count}')
if log_count > 0:
    print('   Recent logs:')
    for log in (logs.data or [])[:5]:
        print(f'   [{log[\"log_type\"]}] {log[\"message\"][:80]}')

print('')
if run.data['status'] == 'completed':
    print('🎉 TEST PASSED - v6-working is working!')
    print('AgentSupervisor successfully executed end-to-end!')
elif run.data['status'] == 'failed':
    print('❌ TEST FAILED')
elif run.data['status'] in ['planning', 'executing']:
    print('⏳ Still running - check back in a few seconds')
else:
    print(f'⚠️ Status: {run.data[\"status\"]}')
" 2>&1 | grep -v "NotOpenSSLWarning" | grep -v "urllib3/__init__"

echo ""
echo "=== TEST COMPLETE ==="
