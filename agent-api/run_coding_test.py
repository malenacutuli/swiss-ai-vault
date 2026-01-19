#!/usr/bin/env python3
import os, sys, json
from datetime import datetime
from supabase import create_client
from redis import Redis

print("Creating coding task...")

supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

run = supabase.table('agent_runs').insert({
    'user_id': 'ad7d2f6d-3292-47ea-b1ad-75388539e89e',
    'prompt': 'Create a Python function that implements the Fibonacci sequence using dynamic programming (memoization). Then write test cases to verify it works correctly for numbers 0-10. Include performance comparison between recursive and memoized approaches.',
    'status': 'created',
    'created_at': datetime.utcnow().isoformat()
}).execute()

run_id = run.data[0]['id']

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

print(f'\n✓ Coding task created and enqueued')
print(f'Run ID: {run_id}')
print(f'\nMonitor with: python3 check_run_results.py {run_id}')
print(f'Or watch logs: kubectl logs -f -n agents deployment/agent-worker')
