#!/usr/bin/env python3
import os, sys, json, time
from supabase import create_client

run_id = "4a29901c-ce4d-4a3c-8639-6217192b2ad3"

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

print(f"Checking run: {run_id}")
print("=" * 80)

run = supabase.table('agent_runs').select('*').eq('id', run_id).single().execute()

if not run.data:
    print(f"❌ Run not found")
    sys.exit(1)

data = run.data

print(f"\nStatus: {data['status']}")
print(f"Created: {data['created_at']}")
print(f"Completed: {data.get('completed_at', 'N/A')}")
print(f"\nPrompt: {data['prompt']}")

if data.get('plan'):
    print(f"\n📋 Plan:")
    if isinstance(data['plan'], dict):
        print(json.dumps(data['plan'], indent=2))
    else:
        print(data['plan'])

if data.get('error_message'):
    print(f"\n❌ Error: {data['error_message']}")

# Get logs
logs = supabase.table('agent_task_logs').select('*').eq('run_id', run_id).order('created_at').execute()

if logs.data:
    print(f"\n📝 Task Logs ({len(logs.data)} entries):")
    for i, log in enumerate(logs.data, 1):
        print(f"\n  {i}. [{log['log_type']}] {log.get('created_at', 'N/A')}")
        print(f"     {log['message']}")

print("\n" + "=" * 80)

if data['status'] in ['created', 'queued', 'planning', 'executing']:
    print(f"\n⏳ Job is {data['status']}... run this script again to check progress")
elif data['status'] == 'completed':
    print(f"\n✅ Job completed successfully!")
else:
    print(f"\n❌ Job status: {data['status']}")
