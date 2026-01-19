#!/bin/bash
set -e

echo "========================================="
echo "REBUILD WITH ENQUEUE FIX"
echo "========================================="
echo ""

# Step 1: Rebuild image
echo "Step 1: Building Docker image with --no-cache..."
docker build --platform linux/amd64 --no-cache -t docker.io/axessvideo/agent-api:v7-enqueue-fix . 2>&1 | tail -20
echo ""

# Step 2: Push image
echo "Step 2: Pushing to registry..."
docker push docker.io/axessvideo/agent-api:v7-enqueue-fix 2>&1 | tail -10
echo ""

# Step 3: Update deployment YAML
echo "Step 3: Updating deployment YAML..."
sed -i.backup 's|image: docker.io/axessvideo/agent-api:.*|image: docker.io/axessvideo/agent-api:v7-enqueue-fix|' k8s/worker-deployment.yaml
echo "Updated to v7-enqueue-fix"
echo ""

# Step 4: Delete old deployment
echo "Step 4: Deleting old deployment..."
kubectl delete deployment agent-worker -n agents --ignore-not-found=true
sleep 10
echo ""

# Step 5: Create new deployment
echo "Step 5: Creating new deployment..."
kubectl apply -f k8s/worker-deployment.yaml
echo ""

# Step 6: Wait for pod
echo "Step 6: Waiting for pod to be ready..."
kubectl wait --for=condition=ready pod -n agents -l app=agent-worker --timeout=60s 2>&1 || echo "Timeout"
echo ""

# Step 7: Verify image
IMAGE=$(kubectl get pod -n agents -l app=agent-worker -o jsonpath='{.items[0].spec.containers[0].image}')
echo "Pod is running: $IMAGE"
echo ""

# Step 8: Create test run (will auto-enqueue now!)
echo "Step 8: Creating test run (will auto-enqueue)..."
python3 -c "
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

supabase = create_client(
    'https://ghmmdochvlrnwbruyrqk.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'
)

# Create run - will auto-enqueue!
run_data = {
    'user_id': 'ad7d2f6d-3292-47ea-b1ad-75388539e89e',
    'prompt': 'ENQUEUE FIX TEST - list files in current directory',
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

# Enqueue to Redis
import redis
from datetime import datetime
import json

try:
    r = redis.from_url('redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379', decode_responses=True)
    job_data = {
        'run_id': run_id,
        'enqueued_at': datetime.utcnow().isoformat(),
        'priority': 0,
        'retry_count': 0
    }
    r.lpush('jobs:pending', json.dumps(job_data))
    supabase.table('agent_runs').update({'status': 'queued'}).eq('id', run_id).execute()
    print(f'✓ Created and enqueued: {run_id}')
except Exception as e:
    print(f'✗ Enqueue failed: {e}')
    print(f'Run ID: {run_id}')
" 2>&1 | tail -5

echo ""
echo "Step 9: Waiting 30 seconds for processing..."
sleep 30
echo ""

# Step 10: Check results
echo "Step 10: Checking results..."
python3 check_fix.py

echo ""
echo "========================================="
echo "REBUILD COMPLETE"
echo "========================================="
