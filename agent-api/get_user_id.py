#!/usr/bin/env python3
"""Get a valid user ID from existing agent runs"""

import os
import sys
from supabase import create_client

SUPABASE_URL = "https://ghmmdochvlrnwbruyrqk.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdobW1kb2NodmxybndicnV5cnFrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NDg1NzEzMywiZXhwIjoyMDgwNDMzMTMzfQ.PCvIC8oemKruS0fBOAkfL7wAIOxOuhASxUyrn4HnWg0"

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

# Get user_id from existing agent_runs
runs = supabase.table("agent_runs").select("user_id").limit(1).execute()

if runs.data and len(runs.data) > 0:
    user_id = runs.data[0]["user_id"]
    print(user_id)
else:
    print("ERROR: No agent runs found", file=sys.stderr)
    sys.exit(1)
