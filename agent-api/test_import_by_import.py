#!/usr/bin/env python3
"""Test each import one by one to find the exact failure"""
import sys
import os
from datetime import datetime

# Write to Redis immediately
from redis import Redis
redis_url = os.environ.get('REDIS_URL')
r = Redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=None)
r.set("import-test:heartbeat", datetime.utcnow().isoformat())

def test_import(step, description, import_func):
    """Test a single import and log result"""
    try:
        r.lpush("import-test:log", f"Step {step}: Trying {description}...")
        print(f"Step {step}: Trying {description}...", flush=True)
        import_func()
        r.lpush("import-test:log", f"Step {step}: ✓ {description} OK")
        print(f"✓ Step {step}: {description} OK", flush=True)
        return True
    except Exception as e:
        error_msg = f"Step {step}: ✗ FAILED - {type(e).__name__}: {str(e)}"
        r.lpush("import-test:log", error_msg)
        print(f"✗ {error_msg}", flush=True)
        import traceback
        trace = traceback.format_exc()
        for i, line in enumerate(trace.split('\n')[:10]):  # First 10 lines
            r.lpush("import-test:log", f"  Trace{i}: {line}")
        return False

# Test imports one by one
if not test_import(1, "app package", lambda: __import__('app')):
    sys.exit(1)

if not test_import(2, "app.config", lambda: __import__('app.config', fromlist=['get_settings'])):
    sys.exit(1)

if not test_import(3, "app.config.get_settings", lambda: __import__('app.config', fromlist=['get_settings']).get_settings()):
    sys.exit(1)

if not test_import(4, "app.worker package", lambda: __import__('app.worker')):
    sys.exit(1)

if not test_import(5, "app.worker.job_queue", lambda: __import__('app.worker.job_queue', fromlist=['JobQueue'])):
    sys.exit(1)

if not test_import(6, "app.worker.job_queue.JobQueue class", lambda: __import__('app.worker.job_queue', fromlist=['JobQueue']).JobQueue):
    sys.exit(1)

if not test_import(7, "app.worker.job_processor", lambda: __import__('app.worker.job_processor', fromlist=['JobProcessor'])):
    sys.exit(1)

if not test_import(8, "app.worker.main", lambda: __import__('app.worker.main', fromlist=['AgentWorker'])):
    sys.exit(1)

r.set("import-test:complete", "all_passed")
r.lpush("import-test:log", "ALL IMPORTS PASSED!")
print("=" * 80, flush=True)
print("✓✓✓ ALL IMPORTS PASSED!", flush=True)
print("=" * 80, flush=True)

# Keep alive
import time
while True:
    r.set("import-test:heartbeat", datetime.utcnow().isoformat())
    time.sleep(30)
