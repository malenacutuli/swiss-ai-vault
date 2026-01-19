#!/usr/bin/env python3
"""Check if the deployment fix worked by querying database directly"""
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

print('=' * 50)
print('DEPLOYMENT FIX VERIFICATION')
print('=' * 50)

# Check the old job that was enqueued
run_id = '26c5a929-edd7-43f8-ae12-b6588f1124f1'
print(f'\nChecking old test job: {run_id}')

run = supabase.table('agent_runs').select('*').eq('id', run_id).single().execute()

print(f'Status: {run.data["status"]}')

if run.data['status'] == 'queued':
    print('❌ WORKER IS NOT PROCESSING JOBS')
    print('   Job is still queued after pod restart')
    print('   Worker process may have crashed or stuck')

elif run.data['status'] == 'failed':
    error = run.data.get('error_message', '')
    if 'SyncQueryRequestBuilder' in error:
        print('❌ OLD ERROR STILL PRESENT')
        print('   Pod is running old code despite v6-working tag')
        print(f'   Error: {error[:200]}')
    else:
        print('✅ NEW ERROR (Progress!)')
        print('   Old SyncQueryRequestBuilder error is GONE')
        print(f'   New error: {error[:200]}')

elif run.data['status'] in ['planning', 'executing']:
    print('⏳ WORKER IS PROCESSING')
    print(f'   Status: {run.data["status"]}')

elif run.data['status'] == 'completed':
    print('🎉 SUCCESS!')
    print('   Worker processed the job successfully')
    steps = supabase.table('agent_steps').select('*').eq('run_id', run_id).execute()
    print(f'   Agent steps: {len(steps.data or [])}')

else:
    print(f'⚠️ Unexpected status: {run.data["status"]}')

if run.data.get('plan'):
    print('✅ Plan was created')

steps = supabase.table('agent_steps').select('*').eq('run_id', run_id).execute()
messages = supabase.table('agent_messages').select('*').eq('run_id', run_id).execute()

print(f'\nDatabase state:')
print(f'  Messages: {len(messages.data or [])}')
print(f'  Steps: {len(steps.data or [])}')

print('=' * 50)
