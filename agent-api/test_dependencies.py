#!/usr/bin/env python3
"""Test each dependency to isolate the crash cause"""
import sys
import os
from datetime import datetime

print("=" * 80, flush=True)
print("DEPENDENCY TEST - Finding the crash cause", flush=True)
print("=" * 80, flush=True)

# Test Redis FIRST (so we can log results)
try:
    print("Step 1: Testing Redis...", flush=True)
    from redis import Redis
    redis_url = os.environ.get('REDIS_URL', '')
    r = Redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=None)
    r.ping()
    r.set('dep_test:redis', 'ok')
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - Step 1: Redis OK")
    print("✓ Step 1: Redis OK", flush=True)
except Exception as e:
    print(f"✗ FAILED: Redis - {e}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test Supabase client
try:
    print("Step 2: Testing Supabase import...", flush=True)
    from supabase import create_client
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - Step 2: Supabase import OK")
    print("✓ Step 2: Supabase import OK", flush=True)
except Exception as e:
    error_msg = f"Step 2 FAILED: Supabase import - {type(e).__name__}: {str(e)}"
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - {error_msg}")
    print(f"✗ {error_msg}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test Supabase initialization
try:
    print("Step 3: Testing Supabase client creation...", flush=True)
    supabase_url = os.environ.get('SUPABASE_URL', '')
    supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')
    client = create_client(supabase_url, supabase_key)
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - Step 3: Supabase client OK")
    print("✓ Step 3: Supabase client created OK", flush=True)
except Exception as e:
    error_msg = f"Step 3 FAILED: Supabase client - {type(e).__name__}: {str(e)}"
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - {error_msg}")
    print(f"✗ {error_msg}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test Anthropic
try:
    print("Step 4: Testing Anthropic import...", flush=True)
    from anthropic import Anthropic
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - Step 4: Anthropic import OK")
    print("✓ Step 4: Anthropic import OK", flush=True)
except Exception as e:
    error_msg = f"Step 4 FAILED: Anthropic import - {type(e).__name__}: {str(e)}"
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - {error_msg}")
    print(f"✗ {error_msg}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test Anthropic client
try:
    print("Step 5: Testing Anthropic client creation...", flush=True)
    anthropic_key = os.environ.get('ANTHROPIC_API_KEY', '')
    anthropic_client = Anthropic(api_key=anthropic_key)
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - Step 5: Anthropic client OK")
    print("✓ Step 5: Anthropic client created OK", flush=True)
except Exception as e:
    error_msg = f"Step 5 FAILED: Anthropic client - {type(e).__name__}: {str(e)}"
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - {error_msg}")
    print(f"✗ {error_msg}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test app imports
try:
    print("Step 6: Testing app.config import...", flush=True)
    from app.config import get_settings
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - Step 6: app.config OK")
    print("✓ Step 6: app.config import OK", flush=True)
except Exception as e:
    error_msg = f"Step 6 FAILED: app.config - {type(e).__name__}: {str(e)}"
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - {error_msg}")
    print(f"✗ {error_msg}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test worker imports
try:
    print("Step 7: Testing app.worker imports...", flush=True)
    from app.worker.job_queue import JobQueue
    from app.worker.job_processor import JobProcessor
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - Step 7: Worker imports OK")
    print("✓ Step 7: Worker imports OK", flush=True)
except Exception as e:
    error_msg = f"Step 7 FAILED: Worker imports - {type(e).__name__}: {str(e)}"
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - {error_msg}")
    print(f"✗ {error_msg}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Test worker initialization
try:
    print("Step 8: Testing JobQueue initialization...", flush=True)
    queue = JobQueue()
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - Step 8: JobQueue init OK")
    print("✓ Step 8: JobQueue initialized OK", flush=True)
except Exception as e:
    error_msg = f"Step 8 FAILED: JobQueue init - {type(e).__name__}: {str(e)}"
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - {error_msg}")
    print(f"✗ {error_msg}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

try:
    print("Step 9: Testing JobProcessor initialization...", flush=True)
    processor = JobProcessor()
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - Step 9: JobProcessor init OK")
    print("✓ Step 9: JobProcessor initialized OK", flush=True)
except Exception as e:
    error_msg = f"Step 9 FAILED: JobProcessor init - {type(e).__name__}: {str(e)}"
    r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - {error_msg}")
    print(f"✗ {error_msg}", flush=True)
    import traceback
    traceback.print_exc()
    sys.exit(1)

# All tests passed!
r.set('dep_test:complete', 'all_passed')
r.set('dep_test:heartbeat', datetime.utcnow().isoformat())
r.lpush('dep_test:log', f"{datetime.utcnow().isoformat()} - ALL TESTS PASSED!")
print("=" * 80, flush=True)
print("✓✓✓ ALL DEPENDENCY TESTS PASSED! ✓✓✓", flush=True)
print("=" * 80, flush=True)

# Sleep to keep pod alive
import time
while True:
    r.set('dep_test:heartbeat', datetime.utcnow().isoformat())
    print(f"Heartbeat: {datetime.utcnow().isoformat()}", flush=True)
    time.sleep(30)
