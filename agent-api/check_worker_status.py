#!/usr/bin/env python3
"""Check worker status via Redis debug messages"""

import os
from redis import Redis

REDIS_URL = os.getenv('REDIS_URL')

if not REDIS_URL:
    print("❌ REDIS_URL not set")
    print("Set it first:")
    print("  export REDIS_URL='your_redis_url'")
    exit(1)

# Fix SSL for Upstash
if REDIS_URL.startswith('redis://') and 'upstash.io' in REDIS_URL:
    REDIS_URL = REDIS_URL.replace('redis://', 'rediss://')

# Connect with proper SSL config
conn_kwargs = {'decode_responses': True}
if REDIS_URL.startswith('rediss://'):
    conn_kwargs['ssl_cert_reqs'] = 'none'

r = Redis.from_url(REDIS_URL, **conn_kwargs)

print("=== Worker Debug Messages (Last 20) ===\n")

# Get debug messages
debug_msgs = r.lrange('worker:debug', 0, 19)
if debug_msgs:
    for msg in debug_msgs:
        print(f"  {msg}")
else:
    print("  ❌ No debug messages found")
    print("  Worker may not be running or hasn't started yet")

print("\n=== Worker Last Start ===\n")
last_start = r.get('worker:last_start')
if last_start:
    print(f"  ✓ Last started: {last_start}")
else:
    print("  ❌ No start timestamp found")

print("\n=== Redis Queue Status ===\n")

# Check queue depths
queues = ['jobs:pending', 'jobs:high_priority', 'jobs:processing', 'jobs:failed', 'jobs:retry']
for queue in queues:
    count = r.llen(queue)
    print(f"  {queue}: {count} jobs")

print("\n=== Jobs Pending (Last 5) ===\n")
pending = r.lrange('jobs:pending', 0, 4)
if pending:
    import json
    for job in pending:
        try:
            job_data = json.loads(job)
            print(f"  - Run ID: {job_data.get('run_id', 'unknown')}")
            print(f"    Enqueued: {job_data.get('enqueued_at', 'unknown')}")
        except:
            print(f"  - {job[:80]}...")
else:
    print("  No pending jobs in Redis")
