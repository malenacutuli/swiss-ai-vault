#!/usr/bin/env python3
"""Check failed jobs in Redis"""
from redis import Redis
import ssl
import json

r = Redis.from_url(
    'rediss://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379',
    decode_responses=True,
    ssl_cert_reqs=ssl.CERT_NONE
)

count = r.llen('jobs:failed')
print(f'Failed jobs: {count}')

if count > 0:
    jobs = r.lrange('jobs:failed', 0, 5)
    for i, job_str in enumerate(jobs):
        print(f'\n{"="*80}')
        print(f'Job {i+1}')
        print("="*80)
        try:
            job = json.loads(job_str)
            print(json.dumps(job, indent=2))
        except:
            print(job_str)
