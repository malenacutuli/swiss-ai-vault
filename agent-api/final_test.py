#!/usr/bin/env python3
"""Final end-to-end test after v7-enqueue-fix deployment"""
from supabase import create_client
import time
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print('=' * 60)
print('FINAL END-TO-END TEST - v7-enqueue-fix')
print('=' * 60)

# Step 1: Create a new run
print('\n1. Creating new run...')
run_data = {
    'user_id': 'ad7d2f6d-3292-47ea-b1ad-75388539e89e',
    'prompt': 'FINAL TEST: List files in current directory',
    'status': 'created'
}
result = supabase.table('agent_runs').insert(run_data).execute()
run_id = result.data[0]['id']
print(f'   ✓ Created run: {run_id}')

# Step 2: Insert initial message
print('\n2. Inserting initial message...')
supabase.table('agent_messages').insert({
    'run_id': run_id,
    'role': 'user',
    'content': run_data['prompt']
}).execute()
print('   ✓ Message inserted')

# Step 3: Call the API to trigger handle_create logic
# Since we can't call the API directly, we'll simulate it
print('\n3. Simulating handle_create (status → queued)...')
supabase.table('agent_runs').update({'status': 'queued'}).eq('id', run_id).execute()
print('   ✓ Status set to queued')

# Step 4: Try to enqueue to Redis
print('\n4. Attempting Redis enqueue...')
try:
    import redis
    import json
    from datetime import datetime

    r = redis.from_url('redis://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379',
                      decode_responses=True, socket_connect_timeout=10)

    job_data = {
        'run_id': run_id,
        'enqueued_at': datetime.utcnow().isoformat(),
        'priority': 0,
        'retry_count': 0
    }
    r.lpush('jobs:pending', json.dumps(job_data))
    print('   ✓ Enqueued to Redis')
except Exception as e:
    print(f'   ⚠️ Redis enqueue failed: {e}')
    print('   (Job is still queued in DB, worker should pick it up)')

# Step 5: Wait for processing
print('\n5. Waiting 30 seconds for worker to process...')
for i in range(30):
    time.sleep(1)
    if i % 5 == 0 and i > 0:
        run = supabase.table('agent_runs').select('status').eq('id', run_id).single().execute()
        status = run.data['status']
        print(f'   {i}s: status = {status}')
        if status not in ['created', 'queued']:
            print('   Worker picked up the job!')
            break

# Step 6: Check final results
print('\n6. Final Results:')
print('=' * 60)

run = supabase.table('agent_runs').select('*').eq('id', run_id).single().execute()
print(f'Run ID: {run_id}')
print(f'Status: {run.data["status"]}')

if run.data['status'] == 'queued':
    print('\n❌ STILL QUEUED - Worker not processing')
    print('Possible issues:')
    print('  - Worker pod crashed')
    print('  - Worker not polling Redis')
    print('  - Redis connection broken')

elif run.data['status'] == 'failed':
    error = run.data.get('error_message', '')
    if 'SyncQueryRequestBuilder' in error:
        print('\n❌ OLD ERROR - Wrong image deployed')
        print(f'Error: {error[:200]}')
    else:
        print('\n⚠️ FAILED - New error (old error is gone!)')
        print(f'Error: {error[:200]}')

elif run.data['status'] in ['planning', 'executing']:
    print('\n⏳ PROCESSING - Worker is active!')
    print('System is working, check back in a few seconds')

elif run.data['status'] == 'completed':
    print('\n🎉 SUCCESS! System is fully operational!')
    steps = supabase.table('agent_steps').select('*').eq('run_id', run_id).execute()
    print(f'Agent created {len(steps.data or [])} steps')

# Show database state
steps = supabase.table('agent_steps').select('*').eq('run_id', run_id).execute()
messages = supabase.table('agent_messages').select('*').eq('run_id', run_id).execute()
logs = supabase.table('agent_task_logs').select('*').eq('run_id', run_id).limit(5).execute()

print(f'\nDatabase state:')
print(f'  Messages: {len(messages.data or [])}')
print(f'  Steps: {len(steps.data or [])}')
print(f'  Logs: {len(logs.data or [])}')

if logs.data:
    print('\nRecent logs:')
    for log in logs.data[:3]:
        print(f'  [{log["log_type"]}] {log["message"][:60]}...')

print('=' * 60)
