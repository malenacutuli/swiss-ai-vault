#!/usr/bin/env python3
"""Minimal worker test - just write to Redis and sleep"""
import sys
import os
import time
from datetime import datetime

print("=" * 80, flush=True)
print("MINIMAL WORKER STARTING", flush=True)
print("=" * 80, flush=True)

try:
    from redis import Redis
    print("✓ Redis imported", flush=True)

    redis_url = os.environ.get('REDIS_URL')
    print(f"Redis URL: {redis_url[:30]}...", flush=True)

    redis = Redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=None)
    print("✓ Redis client created", flush=True)

    redis.ping()
    print("✓ Redis ping successful", flush=True)

    redis.set("minimal-worker:heartbeat", datetime.utcnow().isoformat())
    redis.lpush("minimal-worker:log", f"Started at {datetime.utcnow().isoformat()}")
    print("✓ Wrote to Redis", flush=True)

    # Sleep forever
    print("Sleeping forever...", flush=True)
    while True:
        redis.set("minimal-worker:heartbeat", datetime.utcnow().isoformat())
        print(f"Heartbeat at {datetime.utcnow().isoformat()}", flush=True)
        time.sleep(30)

except Exception as e:
    print(f"✗ Error: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)
