#!/bin/bash
# Force complete v4 deployment with image pull

echo "=== FORCE V4 DEPLOYMENT ==="
echo ""

# 1. Verify deployment YAML has v4
echo "1. Checking deployment YAML..."
grep "image:" k8s/worker-deployment.yaml

# 2. Apply the deployment (should update to v4)
echo ""
echo "2. Applying deployment..."
kubectl apply -f k8s/worker-deployment.yaml

# 3. Force delete all worker pods to pull fresh image
echo ""
echo "3. Force deleting worker pods..."
kubectl delete pods -n agents -l app=agent-worker

# 4. Wait for new pod
echo ""
echo "4. Waiting for new pod..."
kubectl wait --for=condition=ready pod -n agents -l app=agent-worker --timeout=180s

# 5. Verify image
echo ""
echo "5. Verifying image version..."
kubectl describe pod -n agents -l app=agent-worker | grep -A 2 "Image:"

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "Wait 10 seconds for worker to stabilize..."
sleep 10

# 6. Create test job
echo ""
echo "=== CREATING TEST JOB ==="
export SUPABASE_URL="https://ghmmdochvlrnwbruyrqk.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0"
export REDIS_URL="redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"

python3 test_v2_direct.py
