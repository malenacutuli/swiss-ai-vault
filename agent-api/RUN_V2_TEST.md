# How to Test V2

## Simple Method (Direct Database Access)

The `test_v2_direct.py` script creates test jobs directly in the database, bypassing API authentication.

### Step 1: Set Environment Variables

```bash
export SUPABASE_URL="your_supabase_url_here"
export SUPABASE_SERVICE_ROLE_KEY="your_service_role_key_here"
```

**Get these from:**
- K8s secrets: `kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data}' | jq`
- Or from your Supabase dashboard

### Step 2: Run the Test

```bash
python3 test_v2_direct.py
```

This will:
1. Create a test run directly in the database
2. Set status to "queued"
3. Worker picks it up automatically
4. Print the Run ID

### Step 3: Wait and Check

Wait 90 seconds (or press 'y' when prompted), then the script will automatically check:
- ✓ Run status
- ✓ Conversation messages (should now include user prompt!)
- ✓ Agent steps (tool executions)
- ✓ Results

### Step 4: Verify the Fix

**Before v2** (BROKEN):
```
Status: failed
Error: Failed to determine next action
❌ No conversation messages (this is the bug!)
```

**After v2** (FIXED):
```
Status: completed (or executing)
✓ Conversation Messages: 1+
  USER: Check the system information and create a report file...
  ASSISTANT: {"type": "tool_call", "tool_name": "shell_execute"...}
✓ Agent Steps: 4+
  - shell_execute: completed
  - shell_execute: completed
```

## Alternative: Copy Credentials from K8s

If you don't have the credentials handy:

```bash
# Get Supabase URL
kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_URL}' | base64 -d
echo ""

# Get Service Role Key
kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.SUPABASE_SERVICE_ROLE_KEY}' | base64 -d
echo ""
```

Then:
```bash
export SUPABASE_URL="<paste_url>"
export SUPABASE_SERVICE_ROLE_KEY="<paste_key>"

python3 test_v2_direct.py
```

## Check Existing Run

If you already have a run ID:

```bash
python3 test_v2_direct.py <RUN_ID>
```

For example:
```bash
python3 test_v2_direct.py 051d425a-f4af-4e74-9489-0aaa724aa5fe
```

## What to Look For

The key indicator that v2 is working:

✅ **Conversation messages table has the user prompt**
- Before: Empty or missing
- After: First message is role="user" with the prompt

✅ **Agent can decide actions**
- Before: "Failed to determine next action"
- After: Creates valid action JSON

✅ **Tools execute**
- Before: No steps created
- After: Multiple steps with tool executions

✅ **Task completes**
- Before: Status = "failed"
- After: Status = "completed" or "executing"
