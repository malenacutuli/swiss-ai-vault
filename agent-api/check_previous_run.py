#!/usr/bin/env python3
"""
Check the previous run (051d425a-f4af-4e74-9489-0aaa724aa5fe)
to see if conversation history was missing (the bug we fixed)
"""

import os
import sys
from supabase import create_client

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_ROLE_KEY = os.getenv('SUPABASE_SERVICE_ROLE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
    print("Please set environment variables:")
    print("")
    print("export SUPABASE_URL='your_url'")
    print("export SUPABASE_SERVICE_ROLE_KEY='your_key'")
    print("")
    print("Or get them from K8s:")
    print("export SUPABASE_URL=$(kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_URL}' | base64 -d)")
    print("export SUPABASE_SERVICE_ROLE_KEY=$(kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_SERVICE_ROLE_KEY}' | base64 -d)")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# The failed run from before
run_id = "051d425a-f4af-4e74-9489-0aaa724aa5fe"

print(f"=== Analyzing Previous Run {run_id} ===\n")

# Get run
run = supabase.table("agent_runs").select("*").eq("id", run_id).single().execute()

if not run.data:
    print("❌ Run not found")
    sys.exit(1)

print(f"Status: {run.data['status']}")
print(f"Error: {run.data.get('error_message', 'None')}")

# Check conversation messages
messages = supabase.table("agent_messages").select("*").eq("run_id", run_id).order("created_at").execute()

print(f"\nConversation Messages: {len(messages.data) if messages.data else 0}")

if messages.data:
    print("✓ Has conversation history")
    for msg in messages.data:
        print(f"  - {msg['role']}: {msg['content'][:80]}...")
else:
    print("❌ NO CONVERSATION HISTORY - This is the bug!")
    print("\nThis confirms the bug:")
    print("- AgentSupervisor started with empty conversation")
    print("- LLM had no context to make decisions")
    print("- Result: 'Failed to determine next action'")
    print("\n✓ v2 fixes this by inserting user prompt before supervisor starts")

print("\n" + "="*60)
print("To test if v2 is working, we need to:")
print("1. Get credentials set up")
print("2. Create a NEW test run")
print("3. Verify it has conversation history from the start")
print("="*60)
