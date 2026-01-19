#!/usr/bin/env python3
"""Check the latest failed run"""
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print('=' * 70)
print('LATEST FAILED RUNS')
print('=' * 70)

# Get 5 most recent failed runs
failed_runs = supabase.table('agent_runs').select('*').eq('status', 'failed').order('created_at', desc=True).limit(5).execute()

for run in (failed_runs.data or []):
    run_id = run['id']
    print(f'\nRun ID: {run_id[:8]}...')
    print(f'Created: {run["created_at"]}')
    print(f'Prompt: {run["prompt"][:60] if run["prompt"] else "N/A"}...')
    print(f'Error: {run.get("error_message", "N/A")}')

    # Check messages
    messages = supabase.table('agent_messages').select('id', count='exact').eq('run_id', run_id).execute()
    msg_count = len(messages.data or [])
    print(f'Messages: {msg_count}')

    # Check if plan exists
    has_plan = 'YES' if run.get('plan') else 'NO'
    print(f'Plan: {has_plan}')

    print('-' * 70)

print('=' * 70)
