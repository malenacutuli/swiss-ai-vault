#!/usr/bin/env python3
"""Get E2B sandbox execution output from the completed run"""
import os, sys, json
from supabase import create_client

run_id = "4a29901c-ce4d-4a3c-8639-6217192b2ad3"

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

print("=== E2B Execution Output ===")
print(f"Run ID: {run_id}")
print("=" * 80)

# Get the run
run = supabase.table('agent_runs').select('*').eq('id', run_id).single().execute()

if not run.data:
    print("Run not found")
    sys.exit(1)

data = run.data

print(f"\nStatus: {data['status']}")
print(f"Execution time: {data.get('created_at')} -> {data.get('completed_at')}")

# Check if there's any execution output or result stored
if data.get('result'):
    print("\n=== Execution Result ===")
    if isinstance(data['result'], dict):
        print(json.dumps(data['result'], indent=2))
    else:
        print(data['result'])

# Get all task logs (these contain E2B output)
logs = supabase.table('agent_task_logs').select('*').eq('run_id', run_id).order('created_at').execute()

if logs.data:
    print(f"\n=== Task Execution Logs ({len(logs.data)} entries) ===")
    for i, log in enumerate(logs.data, 1):
        print(f"\n[{i}] {log['log_type'].upper()} - {log.get('created_at', 'N/A')}")
        print("-" * 80)
        print(log['message'])
        if log.get('metadata'):
            print(f"\nMetadata:")
            print(json.dumps(log['metadata'], indent=2))
else:
    print("\nNo task logs found.")
    print("\nThis means the E2B execution happened entirely in the sandbox.")
    print("The plan was created, but the simplified E2B executor")
    print("doesn't log intermediate execution steps to the database.")
    print("\nTo see E2B logs, you need to check the worker pod logs:")
    print("  kubectl logs -n agents deployment/agent-worker --tail=500")

print("\n" + "=" * 80)

# Try to get the plan execution result
if data.get('plan'):
    print("\n=== Plan Created by E2B ===")
    plan = data['plan']
    if isinstance(plan, dict) and 'description' in plan:
        # Print first 2000 chars of plan
        desc = plan['description']
        print(desc[:2000])
        if len(desc) > 2000:
            print(f"\n... (truncated, total length: {len(desc)} chars)")
