#!/usr/bin/env python3
"""
Direct test for v2 - bypasses API authentication
Creates test job directly in database and checks results
"""

import os
import sys
import json
import time
import uuid
from datetime import datetime
from supabase import create_client
from redis import Redis

# Read credentials from environment or .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')
REDIS_URL = os.getenv('REDIS_URL')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("ERROR: Missing environment variables")
    print("Please set:")
    print("  export SUPABASE_URL=your_supabase_url")
    print("  export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key")
    print("  export REDIS_URL=your_redis_url")
    sys.exit(1)

if not REDIS_URL:
    print("WARNING: REDIS_URL not set - job will be created but not enqueued")
    print("Worker won't pick it up without Redis enqueuing!")

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Setup Redis connection
redis_client = None
if REDIS_URL:
    # Fix SSL for Upstash
    redis_url = REDIS_URL
    if redis_url.startswith('redis://') and 'upstash.io' in redis_url:
        redis_url = redis_url.replace('redis://', 'rediss://')

    # Connect with proper SSL config
    conn_kwargs = {'decode_responses': True}
    if redis_url.startswith('rediss://'):
        conn_kwargs['ssl_cert_reqs'] = 'none'

    redis_client = Redis.from_url(redis_url, **conn_kwargs)

def create_test_job():
    """Create a test job directly in the database"""

    # Get a real user from existing agent_runs (foreign key constraint)
    try:
        runs = supabase.table("agent_runs").select("user_id").limit(1).execute()
        if runs.data and len(runs.data) > 0:
            user_id = runs.data[0]["user_id"]
            print(f"Using existing user: {user_id}")
        else:
            print("❌ ERROR: No agent runs found in database")
            print("Cannot determine user_id")
            sys.exit(1)
    except Exception as e:
        print(f"❌ ERROR: Could not get user from database: {e}")
        sys.exit(1)

    prompt = """Check the system information and create a report file.

Steps:
1. Run 'uname -a' to get system info
2. Run 'date' to get current date
3. Run 'echo "System Report" > /tmp/report.txt' to create a file
4. Verify the file was created with 'cat /tmp/report.txt'

Report all results to me."""

    print("=== Creating Test Job ===")

    # Insert into agent_runs
    run = supabase.table("agent_runs").insert({
        "user_id": user_id,
        "prompt": prompt,
        "status": "queued",
        "created_at": datetime.utcnow().isoformat()
    }).execute()

    run_id = run.data[0]["id"]
    print(f"✓ Created run: {run_id}")

    # Enqueue to Redis so worker picks it up
    if redis_client:
        job_data = {
            "run_id": run_id,
            "enqueued_at": datetime.utcnow().isoformat(),
            "priority": 0,
            "retry_count": 0
        }
        redis_client.lpush("jobs:pending", json.dumps(job_data))
        print(f"✓ Enqueued to Redis (jobs:pending)")
    else:
        print(f"❌ NOT enqueued to Redis (REDIS_URL missing)")
        print(f"   Worker won't process this job!")

    print(f"✓ Status: queued")
    print(f"\nRun ID: {run_id}")

    return run_id

def check_result(run_id):
    """Check the result of a test job"""

    print(f"\n=== Checking Result for {run_id} ===\n")

    # Get run status
    run = supabase.table("agent_runs").select("*").eq("id", run_id).single().execute()

    if not run.data:
        print("❌ Run not found")
        return

    data = run.data

    print(f"Status: {data['status']}")
    if data.get('error_message'):
        print(f"❌ Error: {data['error_message']}")

    # Get plan
    if data.get('plan'):
        plan = data['plan']
        print(f"\nPlan: {len(plan.get('phases', []))} phases")
        for phase in plan.get('phases', []):
            print(f"  - Phase {phase['phase_number']}: {phase['name']} ({phase['estimated_credits']} credits)")

    # Get conversation messages
    messages = supabase.table("agent_messages").select("*").eq("run_id", run_id).order("created_at").execute()

    if messages.data:
        print(f"\n✓ Conversation Messages: {len(messages.data)}")
        for msg in messages.data:
            role = msg['role'].upper()
            content = msg['content'][:100] + "..." if len(msg['content']) > 100 else msg['content']
            print(f"  {role}: {content}")
    else:
        print("\n❌ No conversation messages (this is the bug!)")

    # Get steps
    steps = supabase.table("agent_steps").select("*").eq("run_id", run_id).order("created_at").execute()

    if steps.data:
        print(f"\n✓ Agent Steps: {len(steps.data)}")
        for step in steps.data:
            print(f"  - {step['tool_name']}: {step['status']}")
            if step.get('tool_output'):
                output = json.dumps(step['tool_output'])[:100]
                print(f"    Output: {output}...")
    else:
        print("\n⚠️ No agent steps yet")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Check existing run
        run_id = sys.argv[1]
        check_result(run_id)
    else:
        # Create new test
        run_id = create_test_job()

        print("\n" + "="*60)
        print("✓ Test job created!")
        print("="*60)
        print("\nThe worker should pick this up automatically.")
        print("\nWait 90 seconds, then check result:")
        print(f"  python3 test_v2_direct.py {run_id}")

        # Ask if they want to wait
        try:
            response = input("\nWait and check now? (y/n): ").strip().lower()
            if response == 'y':
                print("\nWaiting 90 seconds...")
                time.sleep(90)
                check_result(run_id)
        except KeyboardInterrupt:
            print(f"\n\nCheck result later with:")
            print(f"  python3 test_v2_direct.py {run_id}")
