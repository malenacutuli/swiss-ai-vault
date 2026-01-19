#!/usr/bin/env python3
"""Check Redis queue status"""
import redis
import json
import warnings
warnings.filterwarnings('ignore')

# Upstash Redis URL (convert to rediss:// for TLS)
REDIS_URL = 'rediss://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379'

try:
    r = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=10, ssl_cert_reqs='none')

    print('=' * 70)
    print('REDIS QUEUE STATUS')
    print('=' * 70)

    # Check queue lengths
    pending = r.llen('jobs:pending')
    processing = r.llen('jobs:processing')
    failed = r.llen('jobs:failed')

    print(f'\nQueue lengths:')
    print(f'  jobs:pending    : {pending}')
    print(f'  jobs:processing : {processing}')
    print(f'  jobs:failed     : {failed}')

    # Show pending jobs
    if pending > 0:
        print(f'\nPending jobs (showing first 10):')
        jobs = r.lrange('jobs:pending', 0, 9)
        for job_json in jobs:
            job = json.loads(job_json)
            run_id = job.get('run_id', 'N/A')[:8]
            enqueued = job.get('enqueued_at', 'N/A')
            retry = job.get('retry_count', 0)
            print(f'  {run_id}... enqueued={enqueued} retry={retry}')

    # Show processing jobs
    if processing > 0:
        print(f'\nProcessing jobs:')
        jobs = r.lrange('jobs:processing', 0, -1)
        for job_json in jobs:
            job = json.loads(job_json)
            run_id = job.get('run_id', 'N/A')[:8]
            enqueued = job.get('enqueued_at', 'N/A')
            print(f'  {run_id}... enqueued={enqueued}')

    # Check worker heartbeat
    heartbeat = r.get('worker:heartbeat')
    print(f'\nWorker heartbeat: {heartbeat or "NONE"}')

    # Check debug messages
    debug_count = r.llen('worker:debug')
    print(f'Worker debug messages: {debug_count}')
    if debug_count > 0:
        print(f'\nRecent worker debug (last 5):')
        debug_msgs = r.lrange('worker:debug', -5, -1)
        for msg in debug_msgs:
            print(f'  {msg}')

    print('=' * 70)

except Exception as e:
    print(f'Redis connection error: {e}')
    print('\nThis is expected if running locally (TLS/SSL issues)')
    print('Redis works fine from within the K8s cluster')
