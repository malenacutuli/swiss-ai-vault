#!/usr/bin/env python3
"""Check the job currently being processed"""
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# The job ID from Redis
run_id = '8aba3541-e5f1-4e72-bd09-f6f9ff5c9783'

print('=' * 70)
print(f'CHECKING PROCESSING JOB: {run_id[:8]}...')
print('=' * 70)

run = supabase.table('agent_runs').select('*').eq('id', run_id).single().execute()

if not run.data:
    print('Run not found!')
else:
    r = run.data
    print(f'\nRun ID: {run_id}')
    print(f'Status: {r["status"]}')
    print(f'Created: {r["created_at"]}')
    print(f'Prompt: {r["prompt"][:80] if r["prompt"] else "N/A"}...')

    # Check messages
    messages = supabase.table('agent_messages').select('*').eq('run_id', run_id).order('created_at').execute()
    print(f'\nMessages: {len(messages.data or [])}')
    for msg in (messages.data or [])[:5]:
        role = msg['role']
        content = msg['content'][:60] + '...' if len(msg['content']) > 60 else msg['content']
        print(f'  [{role}] {content}')

    # Check steps
    steps = supabase.table('agent_steps').select('*').eq('run_id', run_id).order('created_at').execute()
    print(f'\nSteps: {len(steps.data or [])}')
    for step in (steps.data or [])[:5]:
        status = step['status']
        tool = step['tool_name']
        created = step['created_at']
        print(f'  {tool}: {status} (created: {created})')

    # Check logs
    logs = supabase.table('agent_task_logs').select('*').eq('run_id', run_id).order('created_at').limit(10).execute()
    print(f'\nLogs: {len(logs.data or [])}')
    for log in (logs.data or [])[:10]:
        log_type = log['log_type']
        message = log['message'][:80] + '...' if len(log['message']) > 80 else log['message']
        created = log['created_at']
        print(f'  [{log_type}] {message}')

    # Check if plan exists
    if r.get('plan'):
        plan = r['plan']
        print(f'\nPlan exists: YES')
        print(f'Goal: {plan.get("goal", "N/A")[:80]}...')
        print(f'Phases: {len(plan.get("phases", []))}')
    else:
        print('\nPlan exists: NO')

print('=' * 70)
