#!/usr/bin/env python3
"""Test AgentSupervisor with real tool execution"""
import os, sys, json
from datetime import datetime
from supabase import create_client
from redis import Redis

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

user_id = 'ad7d2f6d-3292-47ea-b1ad-75388539e89e'

# Create a task that REQUIRES shell tool execution
prompt = """Check the system information and create a report file.

Steps:
1. Run 'uname -a' to get system info
2. Run 'date' to get current date
3. Run 'echo "System Report" > /tmp/report.txt' to create a file
4. Verify the file was created with 'cat /tmp/report.txt'

Report all results to me."""

print("Creating AgentSupervisor test with shell tool execution...")
run = supabase.table('agent_runs').insert({
    'user_id': user_id,
    'prompt': prompt,
    'status': 'created',
    'created_at': datetime.utcnow().isoformat()
}).execute()

run_id = run.data[0]['id']

# Enqueue
redis_url = os.environ['REDIS_URL']
if 'upstash.io' in redis_url:
    redis_url = redis_url.replace('redis://', 'rediss://')

conn_kwargs = {'decode_responses': True}
if redis_url.startswith('rediss://'):
    conn_kwargs['ssl_cert_reqs'] = 'none'

r = Redis.from_url(redis_url, **conn_kwargs)
r.lpush('jobs:pending', json.dumps({
    'run_id': run_id,
    'enqueued_at': datetime.utcnow().isoformat(),
    'priority': 0,
    'retry_count': 0
}))

print(f'\n✓ Test created and enqueued')
print(f'Run ID: {run_id}')
print(f'\nThis will:')
print(f'  1. Create execution plan with AgentPlanner')
print(f'  2. Execute with AgentSupervisor')
print(f'  3. AgentSupervisor will call shell tool multiple times')
print(f'  4. Shell tool will execute in E2B sandboxes')
print(f'\nWait 90 seconds, then check:')
print(f'python3 check_test_result.py {run_id}')
