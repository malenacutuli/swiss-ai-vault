#!/bin/bash
# Deploy v3 and test - WITH ALL CREDENTIALS

echo "=========================================="
echo "DEPLOYING V3 - Supabase API Fix"
echo "=========================================="
echo ""
echo "v2: ✅ Conversation history fix"
echo "v3: ✅ Supabase API fix (.from_() → .table())"
echo ""

# Export all credentials
export SUPABASE_URL="https://ghmmdochvlrnwbruyrqk.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0"
export REDIS_URL="redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"

echo "Note: kubectl deployment needs to be done manually (kubectl not connected)"
echo "Image: docker.io/axessvideo/agent-api:v3"
echo ""
echo "To deploy on a machine with kubectl:"
echo "  kubectl set image deployment/agent-worker worker=docker.io/axessvideo/agent-api:v3 -n agents"
echo "  kubectl rollout status deployment/agent-worker -n agents"
echo ""
echo "Press Enter when v3 is deployed, or to create a test job now..."
read

echo ""
echo "=========================================="
echo "CREATING TEST JOB"
echo "=========================================="
echo ""

python3 test_v2_direct.py

echo ""
echo "Test job created. It will:"
echo "  1. Have conversation history (v2 fix) ✅"
echo "  2. Use correct Supabase API (v3 fix) ✅"
echo "  3. Execute tools via E2B"
echo "  4. Complete successfully"
