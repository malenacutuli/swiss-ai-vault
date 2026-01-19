#!/usr/bin/env python3
"""Clear all failed jobs from Redis"""
from redis import Redis
import ssl

r = Redis.from_url(
    'rediss://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379',
    decode_responses=True,
    ssl_cert_reqs=ssl.CERT_NONE
)

count = r.llen('jobs:failed')
if count > 0:
    for i in range(count):
        r.rpop('jobs:failed')
    print(f'✓ Cleared {count} failed job(s)')
else:
    print('✓ No failed jobs to clear')
