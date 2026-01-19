#!/usr/bin/env python3
"""Create and enqueue a real coding task"""
import os
import sys
import json
from datetime import datetime
from supabase import create_client
from redis import Redis

# Get credentials from environment
supabase_url = os.environ.get('SUPABASE_URL')
supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
redis_url = os.environ.get('REDIS_URL')

if not all([supabase_url, supabase_key, redis_url]):
    print("❌ Missing environment variables")
    sys.exit(1)

supabase = create_client(supabase_url, supabase_key)

# Create a real coding task
user_id = 'ad7d2f6d-3292-47ea-b1ad-75388539e89e'
prompt = '''Create a Python function that implements the Fibonacci sequence using dynamic programming (memoization).
Then write test cases to verify it works correctly for numbers 0-10.
Include performance comparison between recursive and memoized approaches.'''

print("Creating agent run...")
run = supabase.table('agent_runs').insert({
    'user_id': user_id,
    'prompt': prompt,
    'status': 'created',
    'created_at': datetime.utcnow().isoformat()
}).execute()

run_id = run.data[0]['id']
print(f"✓ Created run: {run_id}")

# Enqueue to Redis
if redis_url.startswith('redis://') and 'upstash.io' in redis_url:
    redis_url = redis_url.replace('redis://', 'rediss://')

conn_kwargs = {'decode_responses': True}
if redis_url.startswith('rediss://'):
    conn_kwargs['ssl_cert_reqs'] = 'none'

r = Redis.from_url(redis_url, **conn_kwargs)

job_data = {
    'run_id': run_id,
    'enqueued_at': datetime.utcnow().isoformat(),
    'priority': 0,
    'retry_count': 0
}
r.lpush('jobs:pending', json.dumps(job_data))

print(f"✓ Enqueued job to Redis")
print(f"\nRun ID: {run_id}")
print(f"Task: Create Fibonacci function with memoization and performance tests")
print(f"\nMonitor with: python3 check_run_results.py {run_id}")
