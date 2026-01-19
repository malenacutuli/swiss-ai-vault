# V2 Fixes - Conversation History & JSON Extraction

## Problem Identified

The "Failed to determine next action" error was caused by **empty conversation history** when AgentSupervisor started.

### Root Cause

1. JobProcessor created the plan but never inserted the user's initial prompt into `agent_messages` table
2. When AgentSupervisor called `_load_conversation_history()`, it got an empty array
3. AgentSupervisor then called Anthropic API with empty messages, causing invalid/unparseable responses
4. The JSON extraction also had limited pattern matching

## Fixes Applied

### Fix 1: Insert Initial User Prompt

**File**: `app/worker/job_processor.py`

**Location**: Lines 154-160

**What Changed**:
```python
# Insert initial user prompt into conversation history
self.supabase.table("agent_messages").insert({
    "run_id": run_id,
    "role": "user",
    "content": prompt
}).execute()
logger.info(f"Inserted initial user prompt into conversation history")
```

**Why**: Now when AgentSupervisor loads conversation history, it will have the user's original prompt, giving the LLM proper context to decide the first action.

### Fix 2: Improved JSON Extraction

**File**: `app/agent/supervisor.py`

**Location**: Lines 495-529

**What Changed**:
- Added multiple pattern matching strategies:
  1. Direct JSON parsing (as before)
  2. Extract from `\`\`\`json ... \`\`\`` (improved regex with \s* for whitespace)
  3. Extract from `\`\`\` ... \`\`\`` (no language specifier)
  4. Find any JSON object `{ ... }` in the text

**Why**: Claude might return JSON in various formats. This makes parsing more robust.

## Deployment

### Image Built & Pushed

```bash
docker build --platform linux/amd64 -t docker.io/axessvideo/agent-api:v2 .
docker push docker.io/axessvideo/agent-api:v2
```

✅ **Image**: `docker.io/axessvideo/agent-api:v2`

### K8s Deployment Updated

**File**: `k8s/worker-deployment.yaml`

Changed image tag from `v1` to `v2` (line 38).

### Deployment Status

⚠️ **kubectl connectivity issue** - deployment file was updated but kubectl apply failed with:
```
error: error validating "k8s/worker-deployment.yaml": error validating data:
failed to download openapi: Get "http://localhost:8080/openapi/v2?timeout=32s":
dial tcp [::1]:8080: connect: connection refused
```

## Manual Steps to Complete Deployment

### Option 1: Force Pod Restart (Recommended)

If the deployment auto-updates or kubectl is working:

```bash
# Check current image
kubectl get deployment agent-worker -n agents -o jsonpath='{.spec.template.spec.containers[0].image}'

# If it shows v1, force restart to pull v2
kubectl delete pod -n agents -l app=agent-worker

# Wait for new pod
kubectl get pods -n agents -w
```

### Option 2: Direct Apply (If kubectl working)

```bash
kubectl apply -f k8s/worker-deployment.yaml
kubectl rollout status deployment/agent-worker -n agents
```

## Testing

### Create Test Job

Use the production API to create a test job:

```bash
python3 QUICK_TEST.py
```

This will:
1. Create a test run via API
2. Start the run (enqueues to Redis)
3. Worker picks it up and processes
4. AgentSupervisor now has user prompt in conversation history
5. Can decide first action and call tools

### Check Results

After 90 seconds:

```bash
python3 check_test_result.py <RUN_ID>
```

Look for:
- ✅ Status: `completed` or `executing`
- ✅ Plan created with 4 phases
- ✅ Conversation messages with user prompt
- ✅ Agent steps showing tool executions
- ✅ Tool outputs from E2B sandbox

## Expected Behavior

### Before (v1)
- Plan created ✓
- Supervisor started ✓
- Conversation history empty ✗
- `_decide_next_action()` returned None ✗
- Error: "Failed to determine next action" ✗

### After (v2)
- Plan created ✓
- Initial user prompt inserted to agent_messages ✓
- Supervisor loads conversation history ✓
- Conversation history contains user prompt ✓
- `_decide_next_action()` gets valid LLM response ✓
- JSON extracted from response ✓
- AgentAction created ✓
- Tool executed via E2B ✓
- Task completes ✓

## Files Changed

1. ✅ `app/worker/job_processor.py` - Insert user prompt to conversation
2. ✅ `app/agent/supervisor.py` - Improved JSON extraction
3. ✅ `k8s/worker-deployment.yaml` - Image tag v1 → v2
4. ✅ Docker image built and pushed as v2

## Next Step

**Verify deployment picked up v2 image**, then test with QUICK_TEST.py or via the API.

If still seeing "Failed to determine next action" after v2 deployment:
- Check worker logs for LLM response content
- Verify agent_messages table has the user prompt
- Check JSON extraction is finding valid action data
