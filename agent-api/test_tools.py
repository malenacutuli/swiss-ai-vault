#!/usr/bin/env python3
"""Test shell and code tool execution"""
import os
import sys
import json
from datetime import datetime
from supabase import create_client
from redis import Redis

# Get credentials
supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

user_id = 'ad7d2f6d-3292-47ea-b1ad-75388539e89e'

# Test 1: Shell execution
print("Creating shell execution test...")
shell_prompt = """Execute these shell commands and report the results:
1. echo "Hello from E2B shell!"
2. date
3. uname -a
4. pwd
5. ls -la /workspace
"""

run1 = supabase.table('agent_runs').insert({
    'user_id': user_id,
    'prompt': shell_prompt,
    'status': 'created',
    'created_at': datetime.utcnow().isoformat()
}).execute()

shell_run_id = run1.data[0]['id']
print(f"✓ Shell test created: {shell_run_id}")

# Test 2: Python code execution
print("\nCreating Python code execution test...")
code_prompt = """Write and execute Python code to:
1. Calculate the sum of numbers 1 to 100
2. Generate a list of the first 10 prime numbers
3. Create a dictionary with system information
4. Print all results
"""

run2 = supabase.table('agent_runs').insert({
    'user_id': user_id,
    'prompt': code_prompt,
    'status': 'created',
    'created_at': datetime.utcnow().isoformat()
}).execute()

code_run_id = run2.data[0]['id']
print(f"✓ Code test created: {code_run_id}")

# Enqueue both jobs
redis_url = os.environ['REDIS_URL']
if 'upstash.io' in redis_url:
    redis_url = redis_url.replace('redis://', 'rediss://')

conn_kwargs = {'decode_responses': True}
if redis_url.startswith('rediss://'):
    conn_kwargs['ssl_cert_reqs'] = 'none'

r = Redis.from_url(redis_url, **conn_kwargs)

for run_id, test_type in [(shell_run_id, "shell"), (code_run_id, "code")]:
    r.lpush('jobs:pending', json.dumps({
        'run_id': run_id,
        'enqueued_at': datetime.utcnow().isoformat(),
        'priority': 0,
        'retry_count': 0
    }))
    print(f"✓ Enqueued {test_type} test: {run_id}")

print("\n" + "="*80)
print("Tests enqueued!")
print("="*80)
print(f"\nShell test: {shell_run_id}")
print(f"Code test: {code_run_id}")
print(f"\nMonitor with:")
print(f"  python3 check_run_results.py {shell_run_id}")
print(f"  python3 check_run_results.py {code_run_id}")
