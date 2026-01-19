#!/usr/bin/env python3
"""Check Redis for worker diagnostic output and status"""
import os
import sys
from datetime import datetime

try:
    from redis import Redis
except ImportError:
    print("❌ redis package not installed. Install with: pip install redis")
    sys.exit(1)

def main():
    redis_url = os.environ.get('REDIS_URL')
    if not redis_url:
        print("❌ REDIS_URL environment variable not set")
        print("Export it with: export REDIS_URL='your-redis-url'")
        sys.exit(1)

    # Convert redis:// to rediss:// for Upstash TLS
    if 'upstash.io' in redis_url and redis_url.startswith('redis://'):
        redis_url = redis_url.replace('redis://', 'rediss://')
        print(f"Connecting to Upstash Redis (TLS): {redis_url[:25]}...")
    else:
        print(f"Connecting to Redis: {redis_url[:20]}...")

    try:
        import ssl
        # For TLS connections (rediss://), use ssl_cert_reqs
        if redis_url.startswith('rediss://'):
            r = Redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=ssl.CERT_NONE)
        else:
            r = Redis.from_url(redis_url, decode_responses=True)
        r.ping()
        print("✓ Connected to Redis\n")
    except Exception as e:
        print(f"❌ Failed to connect to Redis: {e}")
        sys.exit(1)

    # Check worker debug log
    print("=" * 80)
    print("=== Worker Debug Log (last 50 entries) ===")
    print("=" * 80)
    debug_logs = r.lrange("worker:debug", 0, 50)
    if debug_logs:
        for i, log in enumerate(debug_logs):
            print(f"{i+1:3d}. {log}")
    else:
        print("(no debug logs found)")

    print("\n" + "=" * 80)
    print("=== Worker Heartbeat ===")
    print("=" * 80)
    heartbeat = r.get("worker:heartbeat")
    if heartbeat:
        print(f"Last heartbeat: {heartbeat}")
        try:
            hb_time = datetime.fromisoformat(heartbeat.replace('Z', '+00:00'))
            age = (datetime.utcnow() - hb_time.replace(tzinfo=None)).total_seconds()
            print(f"Age: {age:.1f} seconds ago")
            if age < 300:
                print("✓ Worker is alive (heartbeat fresh)")
            else:
                print("⚠ Worker may be stale (heartbeat old)")
        except:
            pass
    else:
        print("(no heartbeat found)")

    print("\n" + "=" * 80)
    print("=== Diagnostic Markers ===")
    print("=" * 80)

    markers = {
        "ENTRYPOINT.PY STARTING": "entrypoint.py started",
        "main.py MODULE LOADED": "main.py module loaded",
        "main imported, calling main()": "About to call main()",
        "main() FUNCTION CALLED": "main() function was called",
        "Worker __init__ started": "AgentWorker initializing",
        "Initial heartbeat written": "Heartbeat written",
        "Main loop entered": "Worker processing loop started",
    }

    debug_text = " ".join(debug_logs) if debug_logs else ""

    for marker, description in markers.items():
        if marker in debug_text:
            print(f"✓ {description}")
        else:
            print(f"✗ {description}")

    print("\n" + "=" * 80)
    print("=== Queue Status ===")
    print("=" * 80)
    pending = r.llen("jobs:pending")
    processing = r.llen("jobs:processing")
    failed = r.llen("jobs:failed")
    retry = r.llen("jobs:retry")

    print(f"Pending jobs:    {pending:3d}")
    print(f"Processing jobs: {processing:3d}")
    print(f"Retry queue:     {retry:3d}")
    print(f"Failed jobs:     {failed:3d}")

    if pending > 0:
        print(f"\n⚠ {pending} jobs waiting to be processed")

    if processing > 0:
        print(f"\n✓ Worker is processing {processing} job(s)")

    print("\n" + "=" * 80)
    print("=== Import Test Log ===")
    print("=" * 80)
    import_logs = r.lrange("import-test:log", 0, 20)
    if import_logs:
        print("(from previous test_import_by_import.py run)")
        for log in import_logs[:5]:
            print(f"  {log}")
    else:
        print("(no import test logs)")

    print("\n" + "=" * 80)
    print("=== Dependency Test Log ===")
    print("=" * 80)
    dep_logs = r.lrange("dep_test:log", 0, 20)
    if dep_logs:
        print("(from previous test_dependencies.py run)")
        for log in dep_logs[:5]:
            print(f"  {log}")
    else:
        print("(no dependency test logs)")

    print("\n" + "=" * 80)
    print("=== Summary ===")
    print("=" * 80)

    if not debug_logs:
        print("❌ ISSUE: No debug logs found - worker not writing to Redis")
        print("   Check: kubectl logs -n agents deployment/agent-worker")
        print("   Check: kubectl describe pod -n agents -l app=agent-worker")
        return

    if "main() FUNCTION CALLED" in debug_text:
        print("✓✓✓ SUCCESS: Worker main() is being called!")
        print("    Worker should now be processing jobs.")
        if pending > 0:
            print(f"    Monitor: watch 'python3 check_redis.py' to see jobs:pending count decrease")
    elif "main.py MODULE LOADED" in debug_text:
        print("⚠ PARTIAL: Module loaded but main() not called")
        print("   This shouldn't happen with entrypoint.py - check logs")
    elif "ENTRYPOINT.PY STARTING" in debug_text:
        print("⚠ PARTIAL: entrypoint.py started but import failed")
        print("   Check pod logs for Python traceback")
    else:
        print("❌ ISSUE: No diagnostic markers found")
        print("   Worker started but diagnostic prints not appearing")
        print("   Check pod logs: kubectl logs -n agents deployment/agent-worker")

if __name__ == "__main__":
    main()
