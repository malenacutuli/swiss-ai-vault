#!/usr/bin/env python3
"""Clean up orphaned jobs in Redis processing queue"""
import redis
import json
from supabase import create_client
import warnings
warnings.filterwarnings('ignore')

REDIS_URL = 'rediss://default:AXLwAAIncDJiYzg4MzcwNjQ1MjE0YjEyYmU1N2RjMTY1YjQ2MzAzOHAyMjk0MjQ@trusting-porpoise-29424.upstash.io:6379'
SUPABASE_URL = 'https://ghmmdochvlrnwbruyrqk.supabase.co'
SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0'

print('=' * 70)
print('CLEANING UP REDIS PROCESSING QUEUE')
print('=' * 70)

try:
    r = redis.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=10, ssl_cert_reqs='none')
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

    # Get all jobs from processing queue
    processing_jobs = r.lrange('jobs:processing', 0, -1)
    print(f'\nFound {len(processing_jobs)} jobs in processing queue')

    removed = 0
    for job_json in processing_jobs:
        job = json.loads(job_json)
        run_id = job.get('run_id')

        # Check status in database
        run = supabase.table('agent_runs').select('status').eq('id', run_id).execute()

        if not run.data:
            print(f'  {run_id[:8]}... NOT FOUND IN DB - removing from Redis')
            r.lrem('jobs:processing', 1, job_json)
            removed += 1
        else:
            status = run.data[0]['status']
            if status in ['completed', 'failed']:
                print(f'  {run_id[:8]}... already {status} - removing from Redis')
                r.lrem('jobs:processing', 1, job_json)
                removed += 1
            elif status == 'executing':
                print(f'  {run_id[:8]}... still executing - keeping in Redis')
            else:
                print(f'  {run_id[:8]}... status={status} - keeping in Redis')

    print(f'\nRemoved {removed} orphaned jobs from processing queue')

    # Show updated stats
    pending = r.llen('jobs:pending')
    processing = r.llen('jobs:processing')
    failed = r.llen('jobs:failed')

    print(f'\nUpdated queue lengths:')
    print(f'  jobs:pending    : {pending}')
    print(f'  jobs:processing : {processing}')
    print(f'  jobs:failed     : {failed}')

    print('=' * 70)

except Exception as e:
    print(f'Error: {e}')
