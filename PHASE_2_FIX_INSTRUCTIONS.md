# Phase 2 Deployment Fix - Missing Environment Variable

**Date**: 2026-01-13
**Status**: ⚠️ Fix Required - Missing ANTHROPIC_API_KEY
**Priority**: Critical - Blocks all Phase 2 functionality

---

## Root Cause

Functions crash during initialization because the `ANTHROPIC_API_KEY` environment variable is not set in the Supabase dashboard.

### Evidence

1. **Dashboard Log Entry**:
   ```json
   {
     "event_message": "shutdown",
     "metadata": [{
       "event_type": "Shutdown",
       "reason": "EarlyDrop",
       "cpu_time_used": 62,
       "function_id": "abc1586b-3690-4f92-a5c1-44cd446003c8"
     }]
   }
   ```
   - "EarlyDrop" means function crashed during initialization
   - Only 62ms CPU time = crashed before handling HTTP request

2. **Code Analysis**:
   ```typescript
   // File: supabase/functions/_shared/llm/index.ts
   export async function invokeLLM(options: LLMOptions): Promise<LLMResponse> {
     const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
     if (!apiKey) {
       throw new Error('ANTHROPIC_API_KEY environment variable not set'); // ← Crashes here
     }
     // ...
   }
   ```
   - This module is imported during function initialization
   - Error is thrown before HTTP handler can respond
   - Results in "404 NOT_FOUND" from routing layer

3. **Initial Misdiagnosis**:
   - Initially thought to be Supabase routing bug
   - Functions showed as ACTIVE in CLI but returned 404 via HTTP
   - Actually: Functions ARE invoked but crash immediately

---

## Fix Instructions

### Step 1: Access Supabase Dashboard

Navigate to the Edge Functions settings:

**URL**: https://supabase.com/dashboard/project/ghmmdochvlrnwbruyrqk/settings/functions

### Step 2: Add Environment Variable

1. Click "Add new secret" or "Environment variables" section
2. Add the following variable:

   | Variable Name | Variable Value |
   |--------------|----------------|
   | `ANTHROPIC_API_KEY` | `sk-ant-api03-...` (your Anthropic API key) |

3. Click "Save" to apply the changes

### Step 3: Wait for Propagation

- Environment variable changes take 30-60 seconds to propagate
- Edge functions need to restart with new environment

### Step 4: Verify Fix

Run the verification script:

```bash
bash /tmp/fix_and_verify.sh
```

**Expected output**:
```
✅ SUCCESS! Function returned Phase 2 format with run_id
   Run ID: 123e4567-e89b-12d3-a456-426614174000

✅ agent-status-phase2 working!
✅ agent-logs-phase2 working!

✅ All Phase 2 functions are now operational!
```

**If still getting 404**:
- Wait another 60 seconds for propagation
- Check that API key is entered correctly (no extra spaces)
- Verify API key is valid by testing with curl:
  ```bash
  curl -X POST https://api.anthropic.com/v1/messages \
    -H "x-api-key: $ANTHROPIC_API_KEY" \
    -H "anthropic-version: 2023-06-01" \
    -H "content-type: application/json" \
    -d '{"model":"claude-3-5-sonnet-20241022","messages":[{"role":"user","content":"hi"}],"max_tokens":10}'
  ```

---

## Manual Testing After Fix

### Test 1: Create Agent Run

```bash
# Get auth token
SIGNIN_RESPONSE=$(curl -s -X POST "https://rljnrgscmosgkcjdvlrq.supabase.co/auth/v1/token?grant_type=password" \
  -H "apikey: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJsam5yZ3NjbW9zZ2tjamR2bHJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQ4NDIxNzIsImV4cCI6MjA4MDQxODE3Mn0.C_Y5OyGaIH3QPX15QTfwafe-_y7YzHvO4z6HU55Y1-A" \
  -H "Content-Type: application/json" \
  -d '{"email":"test-1768321327@example.com","password":"TestPass123!"}'
)

TOKEN=$(echo "$SIGNIN_RESPONSE" | jq -r '.access_token')

# Create agent run
curl -X POST "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/agent-execute-phase2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"create","prompt":"Write a Python script to calculate fibonacci numbers"}'
```

**Expected Response**:
```json
{
  "run_id": "uuid-here",
  "status": "created",
  "message": "Agent run created successfully"
}
```

### Test 2: Get Agent Status

```bash
curl -X POST "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/agent-status-phase2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"run_id":"<RUN_ID_FROM_ABOVE>"}'
```

**Expected Response**:
```json
{
  "run": {
    "id": "uuid",
    "status": "created",
    "prompt": "Write a Python script...",
    "current_phase": 0,
    "total_credits_used": 0
  },
  "progress": {
    "percentage": 0,
    "current_phase": 0,
    "total_phases": 0
  }
}
```

### Test 3: Start Execution

```bash
curl -X POST "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/agent-execute-phase2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"start","run_id":"<RUN_ID>"}'
```

**Expected Response**:
```json
{
  "run_id": "uuid",
  "status": "executing",
  "plan": {
    "goal": "...",
    "phases": [...]
  },
  "message": "Agent execution started"
}
```

### Test 4: Stream Logs

```bash
curl -N "https://rljnrgscmosgkcjdvlrq.supabase.co/functions/v1/agent-logs-phase2?run_id=<RUN_ID>&mode=stream" \
  -H "Authorization: Bearer $TOKEN"
```

**Expected Response**:
```
data: {"type":"log","data":{"message":"Starting planning phase..."}}

data: {"type":"log","data":{"message":"Generated plan with 3 phases..."}}
```

---

## Cleanup After Fix

Once verified working, clean up test functions:

```bash
# Delete temporary test function
supabase functions delete agentexecute2

# Optional: Rename -phase2 functions to remove suffix
# This would require updating client code to use new names
```

---

## Why This Happened

1. **Environment variables are set per-project in Supabase dashboard**, not in code
2. The `ANTHROPIC_API_KEY` was never configured in dashboard settings
3. Automatic environment variables like `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set automatically, but third-party API keys must be manually added
4. The error manifested as 404 because the function crashed before the HTTP handler could respond with a proper error

---

## Prevention

Add to deployment checklist:

- [ ] Verify all required environment variables are set in Supabase dashboard
- [ ] Test functions with simple requests before complex integration tests
- [ ] Check function logs in dashboard immediately after deployment
- [ ] Document all required environment variables in README

---

## Related Files

- **Fix verification script**: `/tmp/fix_and_verify.sh`
- **Main implementation guide**: `/Users/malena/swiss-ai-vault/PROMPT_PHASE_2_IMPLEMENTATION_GUIDE.md`
- **Deployment issue report**: `/Users/malena/swiss-ai-vault/PHASE_2_DEPLOYMENT_ISSUE.md`
- **LLM module (requires API key)**: `/Users/malena/swiss-ai-vault/supabase/functions/_shared/llm/index.ts`

---

**Last Updated**: 2026-01-13 17:00 UTC
