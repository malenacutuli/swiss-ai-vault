#!/usr/bin/env python3
"""Gradual import test - import things one by one and log to Redis"""
import sys
import os
from datetime import datetime

def log_to_redis(step, message):
    """Write to Redis"""
    try:
        from redis import Redis
        redis_url = os.environ.get('REDIS_URL')
        redis = Redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=None)
        redis.lpush("gradual-import:log", f"{datetime.utcnow().isoformat()} - Step {step}: {message}")
        redis.set("gradual-import:heartbeat", datetime.utcnow().isoformat())
        redis.set(f"gradual-import:step", str(step))
        print(f"✓ Step {step}: {message}", flush=True)
    except Exception as e:
        print(f"✗ Failed to log step {step}: {e}", flush=True)

print("=" * 80, flush=True)
print("GRADUAL IMPORT TEST", flush=True)
print("=" * 80, flush=True)

log_to_redis(1, "Script started")

try:
    log_to_redis(2, "Attempting to import app.config")
    from app.config import get_settings
    log_to_redis(3, "app.config imported successfully")
except Exception as e:
    import traceback
    error_details = traceback.format_exc()
    log_to_redis(3, f"FAILED to import app.config: {type(e).__name__}: {str(e)}")
    log_to_redis(3.1, f"Traceback: {error_details[:500]}")
    print(error_details, flush=True)
    sys.exit(1)

try:
    log_to_redis(4, "Attempting to get settings")
    settings = get_settings()
    log_to_redis(5, f"Settings retrieved: redis_url={settings.redis_url[:30]}...")
except Exception as e:
    log_to_redis(5, f"FAILED to get settings: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    log_to_redis(6, "Attempting to import app.worker.job_queue")
    from app.worker.job_queue import JobQueue
    log_to_redis(7, "app.worker.job_queue imported successfully")
except Exception as e:
    log_to_redis(7, f"FAILED to import job_queue: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    log_to_redis(8, "Attempting to instantiate JobQueue")
    queue = JobQueue()
    log_to_redis(9, f"JobQueue instantiated: {queue}")
except Exception as e:
    log_to_redis(9, f"FAILED to instantiate JobQueue: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    log_to_redis(10, "Attempting to import app.worker.job_processor")
    from app.worker.job_processor import JobProcessor
    log_to_redis(11, "app.worker.job_processor imported successfully")
except Exception as e:
    log_to_redis(11, f"FAILED to import job_processor: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    log_to_redis(12, "Attempting to instantiate JobProcessor")
    processor = JobProcessor()
    log_to_redis(13, f"JobProcessor instantiated: {processor}")
except Exception as e:
    log_to_redis(13, f"FAILED to instantiate JobProcessor: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

log_to_redis(14, "All imports and instantiations successful!")
print("=" * 80, flush=True)
print("✓ ALL STEPS PASSED", flush=True)
print("=" * 80, flush=True)

# Sleep to keep pod alive
import time
while True:
    log_to_redis(15, "Still running...")
    time.sleep(60)
