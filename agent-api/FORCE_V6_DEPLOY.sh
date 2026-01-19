#!/bin/bash
# Force complete v6-working deployment with fresh pod

echo "=== FORCE V6-WORKING DEPLOYMENT ==="
echo ""

# 1. Verify deployment YAML has v6-working
echo "1. Checking deployment YAML..."
grep "image:" k8s/worker-deployment.yaml

# 2. Delete the entire deployment (not just pods)
echo ""
echo "2. Deleting worker deployment completely..."
kubectl delete deployment agent-worker -n agents

# 3. Wait a moment for cleanup
echo ""
echo "3. Waiting for cleanup..."
sleep 5

# 4. Re-apply deployment (creates fresh deployment)
echo ""
echo "4. Re-creating deployment from scratch..."
kubectl apply -f k8s/worker-deployment.yaml

# 5. Wait for new pod to be ready
echo ""
echo "5. Waiting for new pod to be ready..."
kubectl wait --for=condition=ready pod -n agents -l app=agent-worker --timeout=180s

# 6. Verify the actual image being used
echo ""
echo "6. Verifying pod is running v6-working..."
kubectl get pods -n agents -l app=agent-worker -o jsonpath='{.items[0].spec.containers[0].image}'
echo ""

# 7. Check pod logs for any startup errors
echo ""
echo "7. Checking worker pod logs (last 20 lines)..."
kubectl logs -n agents -l app=agent-worker --tail=20

echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "Wait 10 seconds for worker to stabilize..."
sleep 10

# 8. Run test
echo ""
echo "=== CREATING TEST JOB ==="
export SUPABASE_URL="https://ghmmdochvlrnwbruyrqk.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0"
export REDIS_URL="redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"

python3 /tmp/test_v2_direct.py
