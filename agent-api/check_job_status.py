#!/usr/bin/env python3
"""Check the status of a specific job"""
import os
import sys

if len(sys.argv) < 2:
    print("Usage: python3 check_job_status.py <run_id>")
    sys.exit(1)

run_id = sys.argv[1]

from supabase import create_client
supabase = create_client(
    os.environ['SUPABASE_URL'],
    os.environ['SUPABASE_SERVICE_ROLE_KEY']
)

result = supabase.table('agent_runs').select('*').eq('id', run_id).single().execute()

if not result.data:
    print(f"Job {run_id} not found")
    sys.exit(1)

job = result.data
print(f"Run ID: {run_id}")
print(f"Status: {job.get('status')}")
print(f"User ID: {job.get('user_id')}")
print(f"Prompt: {job.get('prompt')}")
print(f"Created: {job.get('created_at')}")
print(f"Updated: {job.get('updated_at')}")

if job.get('plan'):
    print(f"\nPlan: {job.get('plan')}")

if job.get('result'):
    print(f"\nResult: {job.get('result')}")
