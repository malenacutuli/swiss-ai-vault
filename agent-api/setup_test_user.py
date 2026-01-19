#!/usr/bin/env python3
"""Create a test user with credits and run a test job"""
import os
import sys
import json
import time
from datetime import datetime, timedelta
from redis import Redis
import ssl

# Get Supabase credentials
SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing Supabase credentials")
    print("Run these first:")
    print("  export SUPABASE_URL=$(kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_URL}' | base64 -d)")
    print("  export SUPABASE_SERVICE_ROLE_KEY=$(kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_SERVICE_ROLE_KEY}' | base64 -d)")
    sys.exit(1)

print("=== Phase 2B Complete Test ===")
print("")

# Connect to Supabase
try:
    from supabase import create_client
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✓ Connected to Supabase")
except Exception as e:
    print(f"✗ Failed to connect to Supabase: {e}")
    sys.exit(1)

# Check if we have any users in credit_balances
try:
    result = supabase.table("credit_balances").select("user_id, available_credits").limit(5).execute()
    if result.data:
        print(f"✓ Found {len(result.data)} existing users with credits:")
        for user in result.data:
            print(f"   - {user['user_id']}: {user.get('available_credits', 0)} credits")
        user_id = result.data[0]["user_id"]
    else:
        print("! No users found, creating test user...")
        # Create a test user
        import uuid
        test_user_id = str(uuid.uuid4())

        # First, check if users table exists and create user there
        try:
            print("  Creating user in users table...")
            user_data = {
                "id": test_user_id,
                "email": f"test-{test_user_id[:8]}@phase2b.test",
                "created_at": datetime.utcnow().isoformat()
            }
            # Try to insert into users table
            result = supabase.table("users").insert(user_data).execute()
            print(f"  ✓ Created user in users table")
        except Exception as e:
            # If users table doesn't exist or insert fails, try auth.users
            print(f"  ! Could not create in users table: {e}")
            print("  ! You may need to create a user manually or use an existing user")
            print("")
            print("  Quick fix - Run this in Supabase SQL Editor:")
            print(f"  INSERT INTO users (id, email) VALUES ('{test_user_id}', 'test@phase2b.local');")
            print(f"  -- OR use an existing user ID from: SELECT id FROM users LIMIT 1;")
            sys.exit(1)

        # Now insert into credit_balances
        now = datetime.utcnow()
        credit_data = {
            "user_id": test_user_id,
            "balance": 100,
            "available_credits": 100,
            "period_start": now.isoformat(),
            "period_end": (now + timedelta(days=30)).isoformat(),
            "period_credits_granted": 100,
            "period_credits_used": 0,
            "rollover_credits": 0,
            "bonus_credits": 0,
            "reserved_credits": 0
        }

        result = supabase.table("credit_balances").insert(credit_data).execute()
        if not result.data:
            print("✗ Failed to create test user credits")
            sys.exit(1)

        user_id = test_user_id
        print(f"✓ Created credit balance: {user_id} with 100 credits")
except Exception as e:
    print(f"✗ Error with credit_balances: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)

# Create a test run
try:
    run_data = {
        "user_id": user_id,
        "prompt": "Test Phase 2B worker - verify worker infrastructure is operational",
        "status": "queued"
    }
    result = supabase.table("agent_runs").insert(run_data).execute()
    if not result.data:
        print("✗ Failed to create run")
        sys.exit(1)
    run_id = result.data[0]["id"]
    print(f"✓ Created test run: {run_id}")
except Exception as e:
    print(f"✗ Failed to create run: {e}")
    import traceback
    traceback.print_exc()
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
    print(f"✓ Job enqueued to Redis queue")
except Exception as e:
    print(f"✗ Failed to enqueue job: {e}")
    sys.exit(1)

print("")
print("=== Monitoring worker (30 seconds) ===")
print("")

job_completed = False

for i in range(15):
    pending = r.llen("jobs:pending")
    processing = r.llen("jobs:processing")
    failed = r.llen("jobs:failed")

    status_line = f"[{i*2:2d}s] Queue - Pending: {pending}, Processing: {processing}, Failed: {failed}"

    # Check run status in database
    try:
        result = supabase.table("agent_runs").select("status, error").eq("id", run_id).single().execute()
        if result.data:
            status = result.data.get("status")
            error = result.data.get("error")

            status_line += f" | Run status: {status}"

            if status in ["completed", "failed"]:
                print(status_line)
                print("")
                print("="*80)

                if status == "completed":
                    print("🎉 SUCCESS! Job completed successfully!")
                    print("")
                    print("Phase 2B Infrastructure: FULLY OPERATIONAL ✅")
                    print("- Worker dequeued job from Redis")
                    print("- Planning phase completed")
                    print("- Execution phase completed")
                    print("- Job marked as completed")
                else:
                    print(f"❌ Job failed with status: {status}")
                    if error:
                        print(f"Error: {error}")

                    # Check failed queue
                    if failed > 0:
                        print("")
                        print("Failed queue details:")
                        failed_jobs = r.lrange("jobs:failed", 0, 5)
                        for fj in failed_jobs:
                            job_data = json.loads(fj)
                            if job_data.get("run_id") == run_id:
                                print(f"  Queue error: {job_data.get('error')}")

                print("="*80)
                job_completed = True
                break
    except Exception as e:
        status_line += f" | (Status check error: {e})"

    print(status_line)
    time.sleep(2)

if not job_completed:
    print("")
    print("⚠ Job did not complete within 30 seconds")
    print("Check the run status manually:")
    print(f"  Run ID: {run_id}")

print("")
print(f"Run ID: {run_id}")
print(f"User ID: {user_id}")
print("")
print("Check details:")
print(f"  Supabase: agent_runs table, id = '{run_id}'")
print(f"  Redis: python3 check_redis.py")
