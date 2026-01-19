#!/usr/bin/env python3
"""Quick test - create and enqueue a job directly"""
import os
import sys
import json
import time
from datetime import datetime
from redis import Redis
import ssl

# You need to provide Supabase credentials
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing Supabase credentials")
    print("Set environment variables:")
    print("  export SUPABASE_URL='https://...supabase.co'")
    print("  export SUPABASE_SERVICE_ROLE_KEY='eyJ...'")
    sys.exit(1)

print("=== Quick Job Test ===")
print("")

# Connect to Supabase
try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✓ Connected to Supabase")
except Exception as e:
    print(f"✗ Failed to connect to Supabase: {e}")
    sys.exit(1)

# Get a test user
try:
    result = supabase.table("credit_balances").select("user_id").limit(1).execute()
    if not result.data:
        print("✗ No users found in credit_balances table")
        sys.exit(1)
    user_id = result.data[0]["user_id"]
    print(f"✓ Using user_id: {user_id}")
except Exception as e:
    print(f"✗ Failed to get user: {e}")
    sys.exit(1)

# Create a test run
try:
    run_data = {
        "user_id": user_id,
        "prompt": "Test Phase 2B worker - list current directory",
        "status": "queued"
    }
    result = supabase.table("agent_runs").insert(run_data).execute()
    if not result.data:
        print("✗ Failed to create run")
        sys.exit(1)
    run_id = result.data[0]["id"]
    print(f"✓ Created run: {run_id}")
except Exception as e:
    print(f"✗ Failed to create run: {e}")
    sys.exit(1)

# Connect to Redis
try:
    redis_url = 'rediss://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379'
    r = Redis.from_url(redis_url, decode_responses=True, ssl_cert_reqs=ssl.CERT_NONE)
    r.ping()
    print("✓ Connected to Redis")
except Exception as e:
    print(f"✗ Failed to connect to Redis: {e}")
    sys.exit(1)

# Enqueue the job
try:
    job = {
        "run_id": run_id,
        "enqueued_at": datetime.utcnow().isoformat(),
        "priority": 0,
        "retry_count": 0
    }
    r.lpush("jobs:pending", json.dumps(job))
    print(f"✓ Enqueued job to Redis")
except Exception as e:
    print(f"✗ Failed to enqueue job: {e}")
    sys.exit(1)

print("")
print("=== Monitoring queue (30 seconds) ===")

for i in range(15):
    pending = r.llen("jobs:pending")
    processing = r.llen("jobs:processing")
    failed = r.llen("jobs:failed")

    print(f"[{i*2}s] Pending: {pending}, Processing: {processing}, Failed: {failed}")

    # Check run status in database
    try:
        result = supabase.table("agent_runs").select("status").eq("id", run_id).single().execute()
        if result.data:
            status = result.data.get("status")
            print(f"      Run status: {status}")

            if status in ["completed", "failed"]:
                print("")
                print(f"✓ Job finished with status: {status}")

                # Get full run details
                result = supabase.table("agent_runs").select("*").eq("id", run_id).single().execute()
                run = result.data
                print(f"   Prompt: {run.get('prompt')}")
                print(f"   Error: {run.get('error', 'None')}")

                if status == "failed" and failed > 0:
                    # Check failed queue
                    failed_jobs = r.lrange("jobs:failed", 0, 5)
                    for fj in failed_jobs:
                        job_data = json.loads(fj)
                        if job_data.get("run_id") == run_id:
                            print(f"   Queue error: {job_data.get('error')}")

                break
    except Exception as e:
        print(f"      (Could not check status: {e})")

    time.sleep(2)

print("")
print(f"Run ID: {run_id}")
print(f"Check in Supabase: agent_runs where id = '{run_id}'")
