#!/usr/bin/env python3
"""Find runs by ID prefix"""
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

prefix = '8aba3541'

print(f'Searching for runs with ID starting with {prefix}...\n')

# Get all runs and filter by prefix
all_runs = supabase.table('agent_runs').select('id, status, created_at, prompt').order('created_at', desc=True).limit(100).execute()

matching = [r for r in all_runs.data if r['id'].startswith(prefix)]

if matching:
    print(f'Found {len(matching)} matching run(s):')
    for r in matching:
        print(f'\nFull ID: {r["id"]}')
        print(f'Status: {r["status"]}')
        print(f'Created: {r["created_at"]}')
        print(f'Prompt: {r["prompt"][:60] if r["prompt"] else "N/A"}...')
else:
    print(f'No runs found starting with {prefix}')
    print('\nMost recent runs:')
    for r in all_runs.data[:10]:
        run_id_short = r['id'][:8]
        print(f'{run_id_short}... {r["status"]:12s} {r["created_at"]}')
