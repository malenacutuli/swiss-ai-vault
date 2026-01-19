#!/usr/bin/env python3
"""Comprehensive system diagnostic"""
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print('=' * 70)
print('SYSTEM DIAGNOSTIC')
print('=' * 70)

# Check all runs by status
print('\nRuns by status:')
for status in ['created', 'queued', 'planning', 'executing', 'completed', 'failed']:
    result = supabase.table('agent_runs').select('id').eq('status', status).execute()
    count = len(result.data or [])
    if count > 0:
        print(f'  {status:12s}: {count:3d} runs')

# Show recent runs
print('\nRecent 10 runs:')
runs = supabase.table('agent_runs').select('id, status, created_at, prompt').order('created_at', desc=True).limit(10).execute()
for run in runs.data:
    run_id_short = run['id'][:8]
    status = run['status']
    prompt_short = run['prompt'][:40] if run['prompt'] else 'No prompt'
    print(f'  {run_id_short}... {status:12s} {prompt_short}')

# Check if ANY job has moved beyond queued
print('\nSystem health:')
completed_runs = supabase.table('agent_runs').select('id').in_('status', ['planning', 'executing', 'completed']).execute()
if completed_runs.data:
    print(f'  ✅ Worker HAS processed {len(completed_runs.data)} jobs')
    print('     System is working!')
else:
    print('  ❌ Worker has NEVER processed any jobs')
    print('     System is broken - worker not running or cant connect')

# Check steps created
steps = supabase.table('agent_steps').select('id').execute()
print(f'\nTotal agent steps ever created: {len(steps.data or [])}')
if len(steps.data or []) == 0:
    print('  ❌ No steps created - supervisor never executed')

# Check if old known error still exists
print('\nChecking for old SyncQueryRequestBuilder error:')
failed_runs = supabase.table('agent_runs').select('id, error_message').eq('status', 'failed').limit(5).execute()
has_old_error = False
for run in (failed_runs.data or []):
    if run.get('error_message') and 'SyncQueryRequestBuilder' in run['error_message']:
        has_old_error = True
        print(f'  ❌ Found old error in {run["id"][:8]}...')
        break

if not has_old_error and failed_runs.data:
    print('  ✅ No SyncQueryRequestBuilder errors found')
elif not failed_runs.data:
    print('  ℹ️  No failed runs to check')

print('=' * 70)
