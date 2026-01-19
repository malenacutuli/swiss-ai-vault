#!/usr/bin/env python3
"""Check recent worker logs in Redis"""
from redis import Redis
import ssl
from datetime import datetime, timedelta

r = Redis.from_url(
    'rediss://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379',
    decode_responses=True,
    ssl_cert_reqs=ssl.CERT_NONE
)

logs = r.lrange('worker:debug', 0, 20)
print('Recent worker logs (last 20):')
for i, log in enumerate(logs):
    print(f'{i+1:2d}. {log}')

print()
print(f'Last start timestamp: {r.get("worker:last_start")}')

print()
print(f'Worker heartbeat: {r.get("worker:heartbeat")}')
