#!/usr/bin/env python3
"""Find an existing user or show how to create one"""
import os
import sys

SUPABASE_URL = os.environ.get('SUPABASE_URL', '')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_ROLE_KEY', '')

if not SUPABASE_URL or not SUPABASE_KEY:
    print("Error: Missing Supabase credentials")
    sys.exit(1)

from supabase import create_client
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print("=== Finding Users ===")
print("")

# Try different possible locations
tables_to_check = [
    ("agent_runs", "user_id"),
    ("user_credits", "user_id"),
    ("credit_balances", "user_id"),
]

found_users = set()

for table, column in tables_to_check:
    try:
        print(f"Checking {table}.{column}...")
        result = supabase.table(table).select(column).limit(5).execute()
        if result.data:
            for row in result.data:
                if row.get(column):
                    found_users.add(row[column])
            print(f"  ✓ Found {len(result.data)} rows")
    except Exception as e:
        print(f"  ✗ Error: {e}")

print("")
if found_users:
    print(f"✓ Found {len(found_users)} unique user IDs:")
    for user_id in list(found_users)[:5]:
        print(f"  - {user_id}")

    print("")
    print("To create credits for one of these users, run this SQL:")
    user_id = list(found_users)[0]
    print("")
    print(f"INSERT INTO credit_balances (user_id, balance, available_credits, period_credits_granted, period_credits_used, rollover_credits, bonus_credits, reserved_credits)")
    print(f"VALUES ('{user_id}', 100, 100, 100, 0, 0, 0, 0)")
    print(f"ON CONFLICT (user_id) DO UPDATE SET available_credits = 100;")
else:
    print("! No users found in any table")
    print("")
    print("To create a test setup, run this in Supabase SQL Editor:")
    print("")
    print("-- Create test user and credits")
    print("DO $$")
    print("DECLARE")
    print("    test_user_id uuid := gen_random_uuid();")
    print("BEGIN")
    print("    -- Insert test run")
    print("    INSERT INTO agent_runs (id, user_id, prompt, status)")
    print("    VALUES (gen_random_uuid(), test_user_id, 'Test Phase 2B', 'queued');")
    print("")
    print("    -- Insert credits")
    print("    INSERT INTO credit_balances (user_id, balance, available_credits, period_credits_granted, period_credits_used, rollover_credits, bonus_credits, reserved_credits)")
    print("    VALUES (test_user_id, 100, 100, 100, 0, 0, 0, 0);")
    print("")
    print("    RAISE NOTICE 'Created test user: %', test_user_id;")
    print("END $$;")
    print("")
    print("-- Then get the run_id:")
    print("SELECT id as run_id, user_id FROM agent_runs ORDER BY created_at DESC LIMIT 1;")
