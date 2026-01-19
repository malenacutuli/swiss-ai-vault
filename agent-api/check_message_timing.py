#!/usr/bin/env python3
"""Check message timing for the failed run"""
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

run_id = 'b06bd84b-d374-4611-9268-a828c58916d3'

print(f'Checking run {run_id}...\n')

# Check run details
run = supabase.table('agent_runs').select('*').eq('id', run_id).single().execute()
if run.data:
    print(f'Run status: {run.data["status"]}')
    print(f'Created at: {run.data["created_at"]}')
    print(f'Error: {run.data.get("error_message", "N/A")}')
    print(f'Prompt: {run.data["prompt"][:80]}')

# Check messages
messages = supabase.table('agent_messages').select('*').eq('run_id', run_id).order('created_at').execute()
print(f'\nMessages found: {len(messages.data or [])}')
for msg in (messages.data or []):
    print(f'  Created: {msg["created_at"]}')
    print(f'  Role: {msg["role"]}')
    print(f'  Content: {msg["content"][:60]}...')

# Check all runs from same timeframe
print('\n' + '='*70)
print('Checking all recent runs (last 20)...')
print('='*70)

recent = supabase.table('agent_runs').select('id, status, created_at').order('created_at', desc=True).limit(20).execute()

for r in (recent.data or []):
    run_id_check = r['id']
    status = r['status']
    created = r['created_at']

    # Count messages for this run
    msg_count = supabase.table('agent_messages').select('id', count='exact').eq('run_id', run_id_check).execute()
    count = msg_count.count if hasattr(msg_count, 'count') else len(msg_count.data or [])

    # Mark runs with 0 messages
    marker = ' ⚠️ NO MESSAGES' if count == 0 else ''
    print(f'{run_id_check[:8]}... {status:12s} {created} msgs={count}{marker}')

print('='*70)
