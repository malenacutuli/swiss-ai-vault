#!/bin/bash
# Complete deployment fix - follows your documented instructions exactly

set -e

echo "========================================="
echo "COMPLETE DEPLOYMENT FIX"
echo "========================================="
echo ""

# Phase 1: Verify current state
echo "Phase 1: Checking current state..."
kubectl get deployment -n agents 2>/dev/null || echo "No deployment found"
kubectl get pod -n agents 2>/dev/null || echo "No pods found"
echo ""

# Phase 2: Complete deletion
echo "Phase 2: Deleting deployment completely..."
kubectl delete deployment agent-worker -n agents --ignore-not-found=true
echo "Waiting 15 seconds for cleanup..."
sleep 15
echo ""

# Phase 3: Recreate deployment
echo "Phase 3: Recreating deployment from YAML..."
kubectl apply -f k8s/worker-deployment.yaml -n agents
echo ""

# Phase 4: Wait for pod to start
echo "Phase 4: Waiting for pod to be ready (60s timeout)..."
kubectl wait --for=condition=ready pod -n agents -l app=agent-worker --timeout=60s 2>&1 || echo "Wait timed out, checking status..."
echo ""

# Phase 5: Verify image
echo "Phase 5: Verifying image..."
IMAGE=$(kubectl get pod -n agents -l app=agent-worker -o jsonpath='{.items[0].spec.containers[0].image}' 2>/dev/null || echo "UNKNOWN")
echo "Pod is running: $IMAGE"
echo ""

if [[ "$IMAGE" != *"v6-working"* ]]; then
    echo "⚠️ WARNING: Pod is NOT running v6-working!"
    echo "Current: $IMAGE"
    echo "Expected: docker.io/axessvideo/agent-api:v6-working"
    echo ""
    echo "The deployment YAML may be out of sync. Checking..."
    grep "image:" k8s/worker-deployment.yaml
    echo ""
fi

# Phase 6: Check pod status
echo "Phase 6: Checking pod status..."
kubectl get pod -n agents -l app=agent-worker
POD_STATUS=$(kubectl get pod -n agents -l app=agent-worker -o jsonpath='{.items[0].status.phase}' 2>/dev/null || echo "UNKNOWN")
echo "Pod phase: $POD_STATUS"
echo ""

if [ "$POD_STATUS" != "Running" ]; then
    echo "❌ Pod is NOT running!"
    echo "Checking pod events..."
    kubectl describe pod -n agents -l app=agent-worker | tail -30
    echo ""
    exit 1
fi

# Phase 7: Create test run
echo "Phase 7: Creating test run..."
TEST_RUN_ID=$(python3 -c "
from supabase import create_client
import warnings
import uuid
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Create run
run_data = {
    'user_id': 'ad7d2f6d-3292-47ea-b1ad-75388539e89e',
    'prompt': 'COMPLETE_FIX test - list files',
    'status': 'created'
}
result = supabase.table('agent_runs').insert(run_data).execute()
run_id = result.data[0]['id']

# Insert initial message
supabase.table('agent_messages').insert({
    'run_id': run_id,
    'role': 'user',
    'content': run_data['prompt']
}).execute()

# Update to queued
supabase.table('agent_runs').update({'status': 'queued'}).eq('id', run_id).execute()

print(run_id)
" 2>&1 | tail -1)

echo "Created test run: $TEST_RUN_ID"
echo ""

# Phase 8: Enqueue to Redis
echo "Phase 8: Enqueuing job to Redis..."
kubectl exec -n agents deployment/agent-worker -- python3 -c "
import redis
import json
from datetime import datetime

r = redis.from_url('redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379')

job_data = {
    'run_id': '$TEST_RUN_ID',
    'enqueued_at': datetime.utcnow().isoformat(),
    'priority': 0,
    'retry_count': 0
}

r.lpush('jobs:pending', json.dumps(job_data))
print('✓ Job enqueued')
print(f'Queue length: {r.llen(\"jobs:pending\")}')
" 2>&1

echo ""

# Phase 9: Wait and check
echo "Phase 9: Waiting 30 seconds for worker to process..."
sleep 30
echo ""

# Phase 10: Check results
echo "Phase 10: Checking results..."
python3 -c "
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
run = supabase.table('agent_runs').select('*').eq('id', '$TEST_RUN_ID').single().execute()

print('')
print('========================================')
print('FINAL RESULTS')
print('========================================')
print(f'Run ID: $TEST_RUN_ID')
print(f'Status: {run.data[\"status\"]}')
print('')

if run.data.get('error_message'):
    error = run.data['error_message']
    print(f'❌ Error: {error[:300]}')

    if 'SyncQueryRequestBuilder' in error:
        print('')
        print('🚨 STILL GETTING OLD ERROR - Pod has old code!')
        print('')
        print('Solution: Rebuild image with new tag')
        print('  docker build --no-cache -t docker.io/axessvideo/agent-api:v7-final .')
        print('  docker push docker.io/axessvideo/agent-api:v7-final')
        print('  Edit k8s/worker-deployment.yaml to use v7-final')
        print('  Then run this script again')
    else:
        print('')
        print('Different error (not SyncQueryRequestBuilder):')
        print(error)
else:
    print('✅ No errors')

if run.data.get('plan'):
    print('✅ Plan created')
else:
    print('⚠️ No plan')

steps = supabase.table('agent_steps').select('*').eq('run_id', '$TEST_RUN_ID').execute()
print(f'Agent Steps: {len(steps.data or [])}')

messages = supabase.table('agent_messages').select('*').eq('run_id', '$TEST_RUN_ID').execute()
print(f'Agent Messages: {len(messages.data or [])}')

logs = supabase.table('agent_task_logs').select('*').eq('run_id', '$TEST_RUN_ID').limit(5).execute()
print(f'Task Logs: {len(logs.data or [])}')

print('')
if run.data['status'] == 'completed':
    print('🎉 SUCCESS - v6-working is working!')
elif run.data['status'] == 'failed':
    print('❌ FAILED - See error above')
elif run.data['status'] in ['planning', 'executing']:
    print('⏳ STILL RUNNING - Check back in a few seconds')
elif run.data['status'] == 'queued':
    print('⚠️ STILL QUEUED - Worker is NOT processing jobs!')
    print('')
    print('Possible causes:')
    print('1. Worker process crashed on startup')
    print('2. Worker cannot connect to Redis')
    print('3. Worker is stuck in a loop')
    print('')
    print('Check pod logs: kubectl logs -n agents -l app=agent-worker')
else:
    print(f'⚠️ Status: {run.data[\"status\"]}')

print('========================================')
" 2>&1 | grep -v "NotOpenSSLWarning" | grep -v "urllib3/__init__"

echo ""
echo "========================================="
echo "FIX COMPLETE"
echo "========================================="
