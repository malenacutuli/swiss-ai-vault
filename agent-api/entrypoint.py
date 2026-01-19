#!/usr/bin/env python3
"""Entrypoint for worker - explicitly calls main()"""
import sys
import os
from datetime import datetime

print("=== ENTRYPOINT.PY STARTING ===", flush=True)

# Write to Redis IMMEDIATELY before anything else
try:
    from redis import Redis
    redis_url = os.environ.get('REDIS_URL', '')
    if redis_url.startswith('redis://') and 'upstash.io' in redis_url:
        redis_url = redis_url.replace('redis://', 'rediss://')

    # Connect with proper SSL config
    conn_kwargs = {'decode_responses': True}
    if redis_url.startswith('rediss://'):
        conn_kwargs['ssl_cert_reqs'] = 'none'
    r = Redis.from_url(redis_url, **conn_kwargs)
    timestamp = datetime.utcnow().isoformat()
    r.lpush('worker:debug', f"{timestamp} - ENTRYPOINT.PY: Starting execution")
    r.set('worker:last_start', timestamp)
    print(f"✓ Wrote to Redis: ENTRYPOINT.PY starting at {timestamp}", flush=True)
except Exception as e:
    print(f"✗ Failed to write to Redis: {e}", flush=True)
    print(f"   Redis URL: {os.environ.get('REDIS_URL', 'NOT SET')[:30]}...", flush=True)

print("=== ENTRYPOINT.PY: About to import main ===", flush=True)

try:
    from app.worker.main import main
    print("=== ENTRYPOINT.PY: main imported successfully ===", flush=True)
    try:
        r.lpush('worker:debug', f"{datetime.utcnow().isoformat()} - ENTRYPOINT.PY: main() imported")
    except:
        pass
except Exception as e:
    print(f"✗ Failed to import main: {e}", flush=True)
    try:
        r.lpush('worker:debug', f"{datetime.utcnow().isoformat()} - ENTRYPOINT.PY: Import failed - {e}")
    except:
        pass
    sys.exit(1)

print("=== ENTRYPOINT.PY: Calling main() ===", flush=True)

try:
    r.lpush('worker:debug', f"{datetime.utcnow().isoformat()} - ENTRYPOINT.PY: About to call main()")
except:
    pass

if __name__ == "__main__":
    main()
