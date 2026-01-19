#!/usr/bin/env python3
"""Simplified worker - write to Redis FIRST, then initialize"""
import sys
import os
from datetime import datetime

# Write to Redis IMMEDIATELY before any other imports
try:
    from redis import Redis
    redis_url = os.environ.get('REDIS_URL')
    redis = Redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=None)
    redis.set("worker-simple:heartbeat", datetime.utcnow().isoformat())
    redis.lpush("worker-simple:log", f"Step 1: Worker script started at {datetime.utcnow().isoformat()}")
    print("✓ Wrote initial heartbeat to Redis", flush=True)
except Exception as e:
    print(f"✗ Failed to write initial heartbeat: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Now try importing the worker modules
try:
    redis.lpush("worker-simple:log", "Step 2: Importing worker modules")
    from app.worker.job_queue import JobQueue
    from app.worker.job_processor import JobProcessor
    redis.lpush("worker-simple:log", "Step 3: Worker modules imported")
except Exception as e:
    error_msg = f"Step 3 FAILED: {type(e).__name__}: {str(e)}"
    redis.lpush("worker-simple:log", error_msg)
    print(f"✗ {error_msg}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Try initializing
try:
    redis.lpush("worker-simple:log", "Step 4: Initializing JobQueue")
    queue = JobQueue()
    redis.lpush("worker-simple:log", "Step 5: JobQueue initialized")
except Exception as e:
    error_msg = f"Step 5 FAILED: {type(e).__name__}: {str(e)}"
    redis.lpush("worker-simple:log", error_msg)
    print(f"✗ {error_msg}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    redis.lpush("worker-simple:log", "Step 6: Initializing JobProcessor")
    processor = JobProcessor()
    redis.lpush("worker-simple:log", "Step 7: JobProcessor initialized")
except Exception as e:
    error_msg = f"Step 7 FAILED: {type(e).__name__}: {str(e)}"
    redis.lpush("worker-simple:log", error_msg)
    print(f"✗ {error_msg}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

redis.lpush("worker-simple:log", "Step 8: All initialization successful!")
print("✓ Worker initialized successfully", flush=True)

# Sleep forever
import time
while True:
    redis.set("worker-simple:heartbeat", datetime.utcnow().isoformat())
    print(f"Heartbeat: {datetime.utcnow().isoformat()}", flush=True)
    time.sleep(30)
