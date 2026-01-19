#!/bin/bash
# Test v6-working via the API (simpler than manual Redis)

echo "=== Testing v6-working via API ==="
echo ""

# You'll need a valid API token - get it from Supabase auth
# For now using service role key directly (only for testing!)
API_URL="https://api.swissbrain.ai"
TOKEN="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0"

echo "1. Creating run..."
CREATE_RESPONSE=$(curl -k -s -X POST "$API_URL/agent/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action": "create", "prompt": "List all files in the current directory"}')

echo "Raw response:"
echo "$CREATE_RESPONSE"
echo ""
echo "Attempting to parse JSON..."
echo "$CREATE_RESPONSE" | python3 -m json.tool 2>&1 || echo "Failed to parse JSON"

RUN_ID=$(echo "$CREATE_RESPONSE" | python3 -c "import sys, json; print(json.load(sys.stdin).get('run_id', ''))")

if [ -z "$RUN_ID" ]; then
    echo "❌ Failed to create run"
    exit 1
fi

echo ""
echo "✓ Created run: $RUN_ID"

echo ""
echo "2. Starting run (will enqueue to Redis automatically)..."
START_RESPONSE=$(curl -k -s -X POST "$API_URL/agent/execute" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"action\": \"start\", \"run_id\": \"$RUN_ID\"}")

echo "$START_RESPONSE" | python3 -m json.tool

echo ""
echo "3. Waiting 30 seconds for worker..."
sleep 30

echo ""
echo "4. Checking status..."
python3 -c "
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_SERVICE_ROLE_KEY = '$TOKEN'

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
run = supabase.table('agent_runs').select('*').eq('id', '$RUN_ID').single().execute()

print(f'Run ID: $RUN_ID')
print(f'Status: {run.data[\"status\"]}')

if run.data.get('error'):
    print(f'❌ Error: {run.data[\"error\"]}')
    print('')
    print('Full error details:')
    print(run.data['error'])
else:
    print('✓ No errors')

if run.data.get('plan'):
    print(f'✓ Plan created')

steps = supabase.table('agent_steps').select('*').eq('run_id', '$RUN_ID').execute()
print(f'✓ Agent Steps: {len(steps.data or [])}')

messages = supabase.table('agent_messages').select('*').eq('run_id', '$RUN_ID').execute()
print(f'✓ Agent Messages: {len(messages.data or [])}')

logs = supabase.table('agent_task_logs').select('*').eq('run_id', '$RUN_ID').limit(10).execute()
print(f'✓ Task Logs: {len(logs.data or [])}')
if logs.data:
    print('')
    print('Recent logs:')
    for log in logs.data[:5]:
        print(f'  [{log[\"log_type\"]}] {log[\"message\"][:80]}')

if run.data['status'] == 'completed':
    print('')
    print('✅ TEST PASSED - AgentSupervisor working!')
elif run.data['status'] == 'failed':
    print('')
    print('❌ TEST FAILED')
else:
    print('')
    print(f'⚠️ Status: {run.data[\"status\"]} (may need more time)')
"

echo ""
echo "=== TEST COMPLETE ==="
