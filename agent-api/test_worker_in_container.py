#!/usr/bin/env python3
"""Test script to run inside container - verify each component step-by-step"""
import sys

print("=" * 80, flush=True)
print("CONTAINER WORKER TEST - Step-by-step verification", flush=True)
print("=" * 80, flush=True)

print("Step 1: Basic imports", flush=True)

try:
    from app.worker.job_queue import JobQueue
    print("✓ Step 2: JobQueue imported successfully", flush=True)
except Exception as e:
    print(f"✗ FAILED at JobQueue import: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    from app.worker.job_processor import JobProcessor
    print("✓ Step 3: JobProcessor imported successfully", flush=True)
except Exception as e:
    print(f"✗ FAILED at JobProcessor import: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("Step 4: Initializing JobQueue...", flush=True)
    queue = JobQueue()
    print(f"✓ Step 4: JobQueue initialized, redis={queue.redis}", flush=True)
except Exception as e:
    print(f"✗ FAILED at JobQueue initialization: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("Step 5: Testing Redis connection...", flush=True)
    queue.redis.ping()
    print("✓ Step 5: Redis ping successful", flush=True)
except Exception as e:
    print(f"✗ FAILED at Redis ping: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    from datetime import datetime
    print("Step 6: Writing test heartbeat to Redis...", flush=True)
    queue.redis.set("test-worker:heartbeat", datetime.utcnow().isoformat())
    queue.redis.lpush("test-worker:log", f"Test started at {datetime.utcnow().isoformat()}")
    print("✓ Step 6: Redis write successful", flush=True)
except Exception as e:
    print(f"✗ FAILED at Redis write: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("Step 7: Reading from Redis...", flush=True)
    heartbeat = queue.redis.get("test-worker:heartbeat")
    print(f"✓ Step 7: Redis read successful, heartbeat={heartbeat}", flush=True)
except Exception as e:
    print(f"✗ FAILED at Redis read: {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

print("=" * 80, flush=True)
print("✓ ALL STEPS PASSED - Container environment is working correctly", flush=True)
print("=" * 80, flush=True)
