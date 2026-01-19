#!/usr/bin/env python3
"""Check a failed run to diagnose the issue"""
from supabase import create_client
import json
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

print('=' * 70)
print('ANALYZING FAILED RUN')
print('=' * 70)

# Get most recent failed run
failed_runs = supabase.table('agent_runs').select('*').eq('status', 'failed').order('created_at', desc=True).limit(1).execute()

if not failed_runs.data:
    print('No failed runs found')
    exit(0)

run = failed_runs.data[0]
run_id = run['id']

print(f'\nRun ID: {run_id}')
print(f'Status: {run["status"]}')
print(f'Error: {run.get("error_message", "N/A")}')
print(f'Created: {run["created_at"]}')
print(f'Prompt: {run["prompt"][:80]}...' if run["prompt"] else 'No prompt')

# Check if plan exists
if run.get('plan'):
    plan = run['plan']
    print(f'\nPlan exists: YES')
    print(f'Goal: {plan.get("goal", "N/A")}')
    print(f'Phases: {len(plan.get("phases", []))}')
else:
    print('\nPlan exists: NO')

# Check messages
messages = supabase.table('agent_messages').select('*').eq('run_id', run_id).order('created_at').execute()
print(f'\nMessages: {len(messages.data or [])}')
for msg in (messages.data or []):
    role = msg['role']
    content = msg['content'][:60] + '...' if len(msg['content']) > 60 else msg['content']
    print(f'  [{role}] {content}')

# Check steps
steps = supabase.table('agent_steps').select('*').eq('run_id', run_id).order('created_at').execute()
print(f'\nSteps: {len(steps.data or [])}')
for step in (steps.data or []):
    print(f'  {step["tool_name"]}: {step["status"]}')

# Check logs
logs = supabase.table('agent_task_logs').select('*').eq('run_id', run_id).order('created_at').limit(10).execute()
print(f'\nLogs: {len(logs.data or [])}')
for log in (logs.data or [])[:5]:
    log_type = log['log_type']
    message = log['message'][:80] + '...' if len(log['message']) > 80 else log['message']
    print(f'  [{log_type}] {message}')

# Check credit balance
if run.get('user_id'):
    credits = supabase.table('credit_balances').select('*').eq('user_id', run['user_id']).single().execute()
    if credits.data:
        print(f'\nUser credits: {credits.data.get("available_credits", 0)}')
    else:
        print('\nUser credits: NO RECORD FOUND')

print('=' * 70)
