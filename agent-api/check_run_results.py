#!/usr/bin/env python3
"""Check what a specific agent run accomplished"""
import os
import sys
import json
from supabase import create_client

# Get run ID from command line or use the latest test run
run_id = sys.argv[1] if len(sys.argv) > 1 else "5f82f5b8-2277-4180-b6e0-8fa931210c3f"

# Connect to Supabase
supabase_url = os.environ.get('SUPABASE_URL')
supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')

if not supabase_url or not supabase_key:
    print("❌ SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY not set")
    sys.exit(1)

supabase = create_client(supabase_url, supabase_key)

print(f"=== Agent Run Results ===")
print(f"Run ID: {run_id}")
print()

# Get run details
try:
    run = supabase.table('agent_runs').select('*').eq('id', run_id).single().execute()

    if not run.data:
        print(f"❌ Run {run_id} not found")
        sys.exit(1)

    data = run.data

    print(f"Status: {data['status']}")
    print(f"User ID: {data['user_id']}")
    print(f"Created: {data['created_at']}")
    print(f"Completed: {data.get('completed_at', 'N/A')}")
    print()

    print(f"Prompt:")
    print(f"  {data['prompt']}")
    print()

    if data.get('plan'):
        print(f"Plan:")
        if isinstance(data['plan'], dict):
            print(f"  {json.dumps(data['plan'], indent=2)}")
        else:
            print(f"  {data['plan']}")
        print()

    if data.get('error_message'):
        print(f"Error:")
        print(f"  {data['error_message']}")
        print()

    # Get task logs
    logs = supabase.table('agent_task_logs').select('*').eq('run_id', run_id).order('created_at').execute()

    if logs.data:
        print(f"Task Logs ({len(logs.data)} entries):")
        for i, log in enumerate(logs.data, 1):
            print(f"\n  {i}. [{log['log_type']}] {log.get('created_at', 'N/A')}")
            print(f"     {log['message']}")
            if log.get('metadata'):
                print(f"     Metadata: {json.dumps(log['metadata'], indent=6)}")
    else:
        print("No task logs found")

    print()
    print("=" * 80)

except Exception as e:
    print(f"❌ Error fetching run details: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
