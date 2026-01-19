#!/usr/bin/env python3
"""Simple test - try importing app.config using minimal worker pattern"""
import sys
import os
from datetime import datetime

print("=" * 80, flush=True)
print("SIMPLE APP IMPORT TEST", flush=True)
print("=" * 80, flush=True)

#Step 1: Connect to Redis (we know this works)
try:
    from redis import Redis
    print("✓ Redis imported", flush=True)

    redis_url = os.environ.get('REDIS_URL')
    print(f"Redis URL: {redis_url[:30]}...", flush=True)

    redis = Redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=None)
    print("✓ Redis client created", flush=True)

    redis.ping()
    print("✓ Redis ping successful", flush=True)

    redis.set("simple-import:heartbeat", datetime.utcnow().isoformat())
    redis.lpush("simple-import:log", f"Step 1: Redis connected at {datetime.utcnow().isoformat()}")
    print("✓ Wrote to Redis", flush=True)
except Exception as e:
    print(f"✗ Redis Error: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Step 2: Try importing app.config
try:
    redis.lpush("simple-import:log", f"Step 2: Attempting to import app.config")
    print("Attempting to import app.config...", flush=True)

    from app.config import get_settings

    redis.lpush("simple-import:log", f"Step 3: app.config imported successfully!")
    print("✓ app.config imported successfully", flush=True)
except Exception as e:
    error_msg = f"Step 3: FAILED - {type(e).__name__}: {str(e)}"
    redis.lpush("simple-import:log", error_msg)
    print(f"✗ {error_msg}", flush=True)

    import traceback
    full_trace = traceback.format_exc()
    # Write traceback in chunks to Redis
    lines = full_trace.split('\n')
    for i, line in enumerate(lines):
        redis.lpush("simple-import:log", f"TB{i}: {line}")

    print(full_trace, flush=True)
    sys.exit(1)

# Step 4: Try getting settings
try:
    redis.lpush("simple-import:log", f"Step 4: Attempting to get settings")
    print("Attempting to get settings...", flush=True)

    settings = get_settings()

    redis.lpush("simple-import:log", f"Step 5: Settings retrieved successfully")
    print("✓ Settings retrieved successfully", flush=True)
    print(f"  Redis URL: {settings.redis_url[:30]}...", flush=True)
except Exception as e:
    error_msg = f"Step 5: FAILED - {type(e).__name__}: {str(e)}"
    redis.lpush("simple-import:log", error_msg)
    print(f"✗ {error_msg}", flush=True)

    import traceback
    print(traceback.format_exc(), flush=True)
    sys.exit(1)

redis.lpush("simple-import:log", f"Step 6: ALL TESTS PASSED!")
print("=" * 80, flush=True)
print("✓ ALL TESTS PASSED", flush=True)
print("=" * 80, flush=True)

# Sleep to keep pod alive
import time
while True:
    redis.set("simple-import:heartbeat", datetime.utcnow().isoformat())
    print(f"Heartbeat: {datetime.utcnow().isoformat()}", flush=True)
    time.sleep(30)
