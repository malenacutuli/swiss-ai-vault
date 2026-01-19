# Enable Real Shell and Code Tools - Instructions

## What Was Done

✅ **Fixed E2B Sandbox API calls** in `app/agent/tools/e2b_executor.py`
- Changed from `Sandbox(api_key=...)` to `Sandbox.create()` (5 locations)
- Fixed compatibility with E2B v2 API

✅ **Built new Docker image**
- Image: `docker.io/axessvideo/agent-api:tools-enabled`
- Includes all E2B fixes
- Ready to deploy

✅ **Updated K8s deployment**
- `k8s/worker-deployment.yaml` now uses `:tools-enabled` tag
- E2B_API_KEY already configured

## How Tools Are Wired

The tool router (`app/agent/tools/router.py`) has two execution methods:

### 1. Shell Tool (Lines 75-115)
```python
async def _execute_shell(self, input_data, context):
    command = input_data.get("command")
    timeout = input_data.get("timeout", 300)

    # Execute in E2B sandbox
    result = await self.e2b_executor.execute_shell(command, timeout)
    return ToolResult(output=result, success=result["exit_code"] == 0)
```

### 2. Code Tool (Lines 117-156)
```python
async def _execute_code(self, input_data, context):
    language = input_data.get("language", "python")
    code = input_data.get("code")
    timeout = input_data.get("timeout", 300)

    # Execute in E2B sandbox
    result = await self.e2b_executor.execute_code(code, language, timeout)
    return ToolResult(output=result, success=result["success"])
```

Both tools:
- ✅ Create fresh E2B sandbox per execution
- ✅ Execute commands/code with timeout
- ✅ Capture stdout/stderr
- ✅ Return exit code and results
- ✅ Clean up sandbox after execution

## Deployment Steps

### Step 1: Deploy Worker with Tools Enabled

```bash
chmod +x deploy_tools_enabled.sh
./deploy_tools_enabled.sh
```

Or manually:
```bash
kubectl apply -f k8s/worker-deployment.yaml
kubectl rollout status deployment/agent-worker -n agents
```

### Step 2: Test Shell and Code Execution

```bash
python3 test_tools.py
```

This creates two test jobs:

**Test 1: Shell Execution**
- Runs: `echo`, `date`, `uname -a`, `pwd`, `ls -la`
- Tests: Shell command execution in E2B

**Test 2: Python Code Execution**
- Calculates sum 1-100
- Generates first 10 primes
- Creates system info dict
- Tests: Python code execution in E2B

### Step 3: Monitor Results

```bash
# Shell test
python3 check_run_results.py <SHELL_RUN_ID>

# Code test
python3 check_run_results.py <CODE_RUN_ID>
```

Or watch worker logs:
```bash
kubectl logs -f -n agents deployment/agent-worker
```

## Current Architecture Note

⚠️ **Important:** The current E2B executor (`app/worker/e2b_agent_executor.py`) uses a **simplified loop**:
1. Planning phase - LLM creates plan
2. Execution phase - LLM "executes" plan (text only)

It does **NOT** yet use the full `AgentSupervisor` which calls tools.

### To Enable Full Tool Execution

The tools are ready, but to actually use them in agent runs, you need to:

1. Update `app/worker/e2b_agent_executor.py` to use `AgentSupervisor`
2. Install supervisor dependencies in E2B sandbox
3. Wire tool execution into the agent loop

**Current state:**
- ✅ Tools implemented and fixed
- ✅ E2B sandboxes work
- ✅ Tool router ready
- ❌ Agent loop doesn't call tools yet (uses simplified LLM-only execution)

**Next step options:**

**Option A: Quick Test (Recommended)**
Create a simple test script that directly calls the tool executor to verify E2B execution works:

```python
from app.agent.tools.e2b_executor import E2BSandboxExecutor
import asyncio

executor = E2BSandboxExecutor(api_key=os.environ['E2B_API_KEY'])

# Test shell
result = await executor.execute_shell("echo 'Hello from E2B!'", timeout=60)
print(result)

# Test code
result = await executor.execute_code("print(sum(range(1, 101)))", "python", 60)
print(result)
```

**Option B: Full Integration**
Update the E2B executor to use AgentSupervisor for real tool-calling agent behavior.

## Files Modified

1. `app/agent/tools/e2b_executor.py` - Fixed E2B Sandbox API calls
2. `k8s/worker-deployment.yaml` - Updated image tag to `:tools-enabled`
3. `Dockerfile` - Rebuilt with fixes

## Expected Behavior After Deployment

When tools are called:
1. ✅ E2B sandbox created (fresh Python environment)
2. ✅ Command/code executed with timeout
3. ✅ Results captured (stdout, stderr, exit code)
4. ✅ Sandbox cleaned up
5. ✅ Results returned to agent

## Troubleshooting

**If tools fail with "E2B not configured":**
- Check E2B_API_KEY is set: `kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.E2B_API_KEY}' | base64 -d`

**If Sandbox.create() fails:**
- Check worker logs: `kubectl logs -n agents deployment/agent-worker`
- Verify E2B API key is valid
- Check E2B service status

**If execution times out:**
- Default timeout: 300s (5 minutes)
- Adjust timeout parameter in tool call
- Check E2B sandbox resources
