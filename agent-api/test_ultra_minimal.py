#!/usr/bin/env python3
"""Ultra minimal test - just write to Redis"""
import sys
import os
from datetime import datetime

print("ULTRA MINIMAL TEST STARTING", flush=True)

try:
    redis_url = os.environ.get('REDIS_URL')
    print(f"Redis URL: {redis_url[:30]}...", flush=True)

    from redis import Redis
    print("Redis imported", flush=True)

    redis = Redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=None)
    print("Redis client created", flush=True)

    redis.ping()
    print("Redis ping successful", flush=True)

    timestamp = datetime.utcnow().isoformat()
    redis.set("ultra-minimal:heartbeat", timestamp)
    redis.lpush("ultra-minimal:log", f"Ultra minimal test at {timestamp}")
    print(f"Wrote to Redis at {timestamp}", flush=True)

    # Sleep forever
    print("Sleeping forever...", flush=True)
    import time
    while True:
        timestamp = datetime.utcnow().isoformat()
        redis.set("ultra-minimal:heartbeat", timestamp)
        print(f"Heartbeat: {timestamp}", flush=True)
        time.sleep(30)

except Exception as e:
    print(f"ERROR: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)
