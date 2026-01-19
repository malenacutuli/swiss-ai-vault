#!/usr/bin/env python3
"""Minimal worker test - add a single import from app"""
import sys
import os
import time
from datetime import datetime

print("=== MINIMAL WITH IMPORT TEST ===", flush=True)

try:
    from redis import Redis
    print("✓ Redis imported", flush=True)

    redis_url = os.environ.get('REDIS_URL')
    print(f"Redis URL: {redis_url[:30]}...", flush=True)

    redis = Redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=None)
    print("✓ Redis client created", flush=True)

    redis.ping()
    print("✓ Redis ping successful", flush=True)

    redis.set("minimal-with-import:heartbeat", datetime.utcnow().isoformat())
    redis.lpush("minimal-with-import:log", f"Started at {datetime.utcnow().isoformat()}")
    print("✓ Wrote to Redis", flush=True)

    # Now try the import
    redis.lpush("minimal-with-import:log", "About to import from app.config")
    print("About to import from app.config...", flush=True)

    from app.config import get_settings

    redis.lpush("minimal-with-import:log", "✓ Import successful!")
    print("✓ Import successful!", flush=True)

except Exception as e:
    print(f"✗ Error: {e}", flush=True)
    try:
        redis.lpush("minimal-with-import:log", f"ERROR: {e}")
    except:
        pass
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Sleep forever
print("Sleeping forever...", flush=True)
while True:
    redis.set("minimal-with-import:heartbeat", datetime.utcnow().isoformat())
    print(f"Heartbeat at {datetime.utcnow().isoformat()}", flush=True)
    time.sleep(30)
