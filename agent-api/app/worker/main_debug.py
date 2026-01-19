#!/usr/bin/env python3
"""Debug version of worker - writes to Redis at every step"""
import sys
import os
from datetime import datetime

def log_to_redis(message):
    """Write debug message to Redis"""
    try:
        from redis import Redis
        redis_url = os.environ.get('REDIS_URL')
        redis = Redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=None)
        redis.lpush("worker-debug:log", f"{datetime.utcnow().isoformat()} - {message}")
        redis.set("worker-debug:heartbeat", datetime.utcnow().isoformat())
        print(f"✓ {message}", flush=True)
    except Exception as e:
        print(f"✗ Failed to log to Redis: {e}", flush=True)

print("=" * 80, flush=True)
print("DEBUG WORKER STARTING", flush=True)
print("=" * 80, flush=True)

log_to_redis("Step 1: Worker script started")

try:
    import asyncio
    log_to_redis("Step 2: asyncio imported")
except Exception as e:
    log_to_redis(f"Step 2 FAILED: {e}")
    sys.exit(1)

try:
    import signal
    log_to_redis("Step 3: signal imported")
except Exception as e:
    log_to_redis(f"Step 3 FAILED: {e}")
    sys.exit(1)

try:
    import logging
    log_to_redis("Step 4: logging imported")
except Exception as e:
    log_to_redis(f"Step 4 FAILED: {e}")
    sys.exit(1)

try:
    logging.basicConfig(
        level=logging.INFO,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
        handlers=[logging.StreamHandler(sys.stdout)]
    )
    logger = logging.getLogger(__name__)
    log_to_redis("Step 5: logging configured")
except Exception as e:
    log_to_redis(f"Step 5 FAILED: {e}")
    sys.exit(1)

try:
    from app.worker.job_queue import JobQueue
    log_to_redis("Step 6: JobQueue imported")
except Exception as e:
    log_to_redis(f"Step 6 FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    from app.worker.job_processor import JobProcessor
    log_to_redis("Step 7: JobProcessor imported")
except Exception as e:
    log_to_redis(f"Step 7 FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    queue = JobQueue()
    log_to_redis(f"Step 8: JobQueue initialized")
except Exception as e:
    log_to_redis(f"Step 8 FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    processor = JobProcessor()
    log_to_redis(f"Step 9: JobProcessor initialized")
except Exception as e:
    log_to_redis(f"Step 9 FAILED: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

log_to_redis("Step 10: All initialization successful - entering main loop")

# Main loop
running = True
counter = 0

def shutdown(signum, frame):
    global running
    log_to_redis(f"Shutdown signal received: {signum}")
    running = False

signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT, shutdown)

async def main_loop():
    global counter, running
    log_to_redis("Main loop started")

    while running:
        try:
            counter += 1
            if counter % 10 == 0:
                log_to_redis(f"Main loop iteration {counter}")

            # Dequeue job
            job = queue.dequeue(timeout=5)

            if job:
                run_id = job.get("run_id")
                log_to_redis(f"Processing job: {run_id}")

                # Process job
                success, error = await processor.process(job)

                if success:
                    queue.mark_complete(run_id)
                    log_to_redis(f"Job {run_id} completed")
                else:
                    queue.mark_failed(run_id, error or "Unknown error", job.get("retry_count", 0))
                    log_to_redis(f"Job {run_id} failed: {error}")
            else:
                await asyncio.sleep(0.1)

        except Exception as e:
            log_to_redis(f"Error in main loop: {e}")
            import traceback
            traceback.print_exc()
            await asyncio.sleep(1)

    log_to_redis("Main loop exited")

try:
    asyncio.run(main_loop())
except Exception as e:
    log_to_redis(f"Main loop failed: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

log_to_redis("Worker shutdown complete")
print("Worker shutdown complete", flush=True)
