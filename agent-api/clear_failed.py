#!/usr/bin/env python3
"""Clear failed jobs queue"""
import os
import ssl
from redis import Redis

redis_url = os.environ.get('REDIS_URL')
if not redis_url:
    print("❌ REDIS_URL environment variable not set")
    exit(1)

# Convert redis:// to rediss:// for Upstash TLS
if 'upstash.io' in redis_url and redis_url.startswith('redis://'):
    redis_url = redis_url.replace('redis://', 'rediss://')

# Connect with TLS
r = Redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=ssl.CERT_NONE)
result = r.delete('jobs:failed')
print(f'✓ Cleared failed jobs queue (had {result} entries)')
