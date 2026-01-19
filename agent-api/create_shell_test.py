#!/usr/bin/env python3
import os, sys, json
from datetime import datetime
from supabase import create_client
from redis import Redis

# Use the same pattern as run_coding_test.py which worked before
supabase = create_client(os.environ['SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY'])

user_id = 'ad7d2f6d-3292-47ea-b1ad-75388539e89e'

# Shell execution test
shell_prompt = """Execute these shell commands in E2B and report the results:
1. echo "Hello from E2B shell!"
2. date
3. uname -a
4. pwd
5. ls -la"""

print("Creating shell execution test...")
run = supabase.table('agent_runs').insert({
    'user_id': user_id,
    'prompt': shell_prompt,
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

print(f'\n✓ Shell test created and enqueued')
print(f'Run ID: {run_id}')
print(f'\nWait 60 seconds, then check with:')
print(f'python3 check_run_results.py {run_id}')
