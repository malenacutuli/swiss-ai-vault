#!/usr/bin/env python3
import os, sys, json
from supabase import create_client

run_id = sys.argv[1] if len(sys.argv) > 1 else "f19b35f5-d961-42f7-85f5-f7ebdc429612"

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

print(f"=== Checking Run: {run_id} ===")
print()

run = supabase.table('agent_runs').select('*').eq('id', run_id).single().execute()

if not run.data:
    print(f"❌ Run not found")
    sys.exit(1)

data = run.data

print(f"Status: {data['status']}")
print(f"Created: {data['created_at']}")
print(f"Completed: {data.get('completed_at', 'N/A')}")
print()
print(f"Prompt: {data['prompt'][:200]}...")
print()

if data.get('plan'):
    print("📋 Plan:")
    plan = data['plan']
    if isinstance(plan, dict) and 'description' in plan:
        desc = plan['description']
        print(desc[:500])
        if len(desc) > 500:
            print(f"... (truncated, total: {len(desc)} chars)")
    else:
        print(plan)
    print()

if data.get('error_message'):
    print(f"❌ Error: {data['error_message']}")
    print()

# Get logs
logs = supabase.table('agent_task_logs').select('*').eq('run_id', run_id).order('created_at').execute()

if logs.data:
    print(f"📝 Task Logs ({len(logs.data)} entries):")
    for i, log in enumerate(logs.data, 1):
        print(f"\n  [{i}] {log['log_type'].upper()} - {log.get('created_at', 'N/A')}")
        print(f"      {log['message'][:500]}")
        if len(log['message']) > 500:
            print(f"      ... (truncated)")

print()
print("=" * 80)

if data['status'] in ['created', 'queued', 'planning', 'executing']:
    print(f"⏳ Job is {data['status']}... check again in a moment")
elif data['status'] == 'completed':
    print(f"✅ Job completed!")
else:
    print(f"Status: {data['status']}")
