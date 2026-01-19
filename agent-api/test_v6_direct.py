#!/usr/bin/env python3
"""
Test AgentSupervisor end-to-end with v6-working deployment
Creates a run, enqueues to Redis, waits for completion
"""
from supabase import create_client
import os
import time
import json
from datetime import datetime
import redis

# Configuration
SUPABASE_URL = "https://ghmmdochvlrnwbruyrqk.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0"
REDIS_URL = "redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379"

# Initialize clients
print("=== v6-working Test ===")
print("Initializing clients...")
supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Connect to Redis
redis_client = None
try:
    redis_client = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=5)
    redis_client.ping()
    print("✓ Redis connected")
except Exception as e:
    print(f"⚠️ Redis connection failed: {e}")

# Test user (from existing runs)
user_id = "ad7d2f6d-3292-47ea-b1ad-75388539e89e"
print(f"Using test user: {user_id}")

# 1. Create run
print("\n1. Creating agent run...")
run_data = {
    "user_id": user_id,
    "prompt": "List files in the current directory",
    "status": "created",
    "created_at": datetime.utcnow().isoformat()
}

result = supabase.table("agent_runs").insert(run_data).execute()
run_id = result.data[0]["id"]
print(f"✓ Created run: {run_id}")

# 2. Initialize conversation history (v2 fix)
print("\n2. Initializing conversation history...")
conversation_msg = {
    "run_id": run_id,
    "role": "user",
    "content": run_data["prompt"],
    "created_at": datetime.utcnow().isoformat()
}
supabase.table("agent_messages").insert(conversation_msg).execute()
print("✓ Conversation initialized")

# 3. Update to queued (Redis enqueue will be done manually via kubectl)
print("\n3. Setting status to queued...")
supabase.table("agent_runs").update({"status": "queued"}).eq("id", run_id).execute()
print(f"✓ Status set to queued")

print("\n⚠️ Redis enqueue needed - run this command:")
job_data = {
    "run_id": run_id,
    "enqueued_at": datetime.utcnow().isoformat(),
    "priority": 0,
    "retry_count": 0
}
print(f"kubectl exec -n agents deployment/agent-worker -- python3 -c \"import redis; import json; r = redis.from_url('{REDIS_URL}'); r.lpush('jobs:pending', '{json.dumps(job_data)}')\"")

# 4. Wait for completion
print("\n4. Waiting for worker to process...")
max_wait = 60  # 60 seconds
start_time = time.time()
last_status = None

while time.time() - start_time < max_wait:
    run = supabase.table("agent_runs").select("*").eq("id", run_id).single().execute()
    status = run.data["status"]

    if status != last_status:
        print(f"  Status: {status}")
        last_status = status

    if status in ["completed", "failed"]:
        break

    time.sleep(2)

# 5. Fetch final results
print("\n=== RESULTS ===")
run = supabase.table("agent_runs").select("*").eq("id", run_id).single().execute()
print(f"Run ID: {run_id}")
print(f"Status: {run.data['status']}")

if run.data.get("error"):
    print(f"❌ Error: {run.data['error']}")
else:
    print("✓ No errors")

# Check plan
if run.data.get("plan"):
    print(f"✓ Plan created: {len(str(run.data['plan']))} chars")
else:
    print("⚠️ No plan found")

# Check steps
steps = supabase.table("agent_steps").select("*").eq("run_id", run_id).execute()
print(f"✓ Agent Steps: {len(steps.data or [])}")
for step in (steps.data or []):
    print(f"  - {step['step_type']}: {step['status']}")

# Check agent messages
messages = supabase.table("agent_messages").select("*").eq("run_id", run_id).execute()
print(f"✓ Agent Messages: {len(messages.data or [])}")
for msg in (messages.data or []):
    print(f"  - {msg['role']}: {msg['content'][:50]}...")

# Check task logs
logs = supabase.table("agent_task_logs").select("*").eq("run_id", run_id).limit(10).execute()
print(f"✓ Task Logs: {len(logs.data or [])}")
for log in (logs.data or [])[:5]:
    print(f"  - [{log['log_type']}] {log['message'][:60]}...")

if run.data['status'] == 'completed':
    print("\n✅ TEST PASSED - AgentSupervisor working end-to-end!")
else:
    print(f"\n❌ TEST FAILED - Status: {run.data['status']}")
