# Hybrid Architecture: Swiss K8s + E2B Sandboxes

## Overview

The Swiss Agent API uses a **hybrid architecture** combining the best of both worlds:

- **Swiss K8s Cluster**: Orchestration, data residency, control
- **E2B Sandboxes**: Tool execution, reliable networking, proven infrastructure

This architecture solves the DNS/networking issues while maintaining full control over the orchestration layer.

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Swiss K8s Cluster (Geneva)                    │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Phase 2B Worker Infrastructure               │  │
│  │                                                            │  │
│  │  ┌──────────┐    ┌──────────┐    ┌─────────────────┐   │  │
│  │  │  Redis   │───>│  Worker  │───>│  JobProcessor   │   │  │
│  │  │  Queue   │    │ Process  │    │   AgentPlanner  │   │  │
│  │  └──────────┘    └──────────┘    │ AgentSupervisor │   │  │
│  │       ▲               │            │   ToolRouter    │   │  │
│  │       │               │            └─────────────────┘   │  │
│  │       │               │                      │            │  │
│  │  ┌────┴────┐          │                      │            │  │
│  │  │   API   │          │                      │            │  │
│  │  │FastAPI  │          │                      │            │  │
│  │  └─────────┘          │                      │            │  │
│  └────────────────────────┼──────────────────────┼───────────┘  │
└─────────────────────────────┼──────────────────────┼──────────────┘
                              │                      │
                              │   Tool Execution     │
                              │   Requests (HTTPS)   │
                              │                      │
                              ▼                      ▼
                   ┌──────────────────────────────────────┐
                   │          E2B Cloud (Global)          │
                   │                                      │
                   │  ┌───────────┐  ┌───────────┐      │
                   │  │  Sandbox  │  │  Sandbox  │      │
                   │  │  shell    │  │   code    │ ...  │
                   │  │ execution │  │ execution │      │
                   │  └───────────┘  └───────────┘      │
                   │                                      │
                   │  ✓ Reliable networking               │
                   │  ✓ Proven infrastructure            │
                   │  ✓ Automatic scaling                │
                   │  ✓ Built-in isolation               │
                   └──────────────────────────────────────┘
```

## Benefits

### Swiss K8s (Orchestration Layer)
✅ **Data Residency**: All orchestration happens in Switzerland
✅ **Full Control**: Complete control over worker infrastructure
✅ **Security**: Sensitive data never leaves Swiss infrastructure
✅ **Phase 2B Infrastructure**: Proven Redis queue + worker process

### E2B Sandboxes (Execution Layer)
✅ **Reliable Networking**: No DNS issues, proven cloud infrastructure
✅ **Battle-Tested**: Used by production AI agents (SwissBrain, etc.)
✅ **Auto-Scaling**: Handles any load without K8s resource limits
✅ **Isolation**: Each tool execution in isolated sandbox
✅ **Simplicity**: No K8s job management overhead

## Components

### 1. E2B Sandbox Executor (`app/agent/tools/e2b_executor.py`)

Handles all tool execution in E2B sandboxes:

```python
class E2BSandboxExecutor:
    """Execute tools in E2B sandboxes"""

    async def execute_shell(command: str) -> dict:
        """Execute shell command in E2B sandbox"""
        sandbox = Sandbox(api_key=self.api_key)
        result = sandbox.run_code(...)
        sandbox.close()
        return result

    async def execute_code(code: str, language: str) -> dict:
        """Execute code in E2B sandbox"""
        ...
```

### 2. Tool Router (`app/agent/tools/router.py`)

Routes tools to E2B executor:

```python
class ToolRouter:
    """Hybrid architecture: K8s orchestration + E2B execution"""

    def __init__(self, supabase: Client):
        settings = get_settings()
        if settings.e2b_api_key:
            self.e2b_executor = E2BSandboxExecutor(settings.e2b_api_key)
            logger.info("✓ E2B sandbox executor enabled")
        else:
            self.e2b_executor = None
            logger.warning("! E2B API key not configured - tools will run as mocks")

    async def _execute_shell(self, input_data: dict, context: ToolContext):
        """Execute shell command in E2B"""
        if not self.e2b_executor:
            return mock_response()

        result = await self.e2b_executor.execute_shell(command, timeout)
        return ToolResult(output=result, success=True)
```

### 3. Worker Infrastructure (Phase 2B)

Unchanged - continues to orchestrate jobs:

- `JobQueue`: Redis LPUSH/BRPOP
- `JobProcessor`: Process jobs, call planner/supervisor
- `AgentSupervisor`: Execute plan steps using ToolRouter
- `ToolRouter`: Now delegates to E2B for tool execution

## Configuration

### Environment Variables

Add E2B API key to your deployment:

```bash
# Get E2B API key from https://e2b.dev
export E2B_API_KEY="e2b_..."

# Add to K8s secret
kubectl create secret generic agent-api-secrets \
  --from-literal=E2B_API_KEY=$E2B_API_KEY \
  --namespace=agents \
  --dry-run=client -o yaml | kubectl apply -f -
```

### K8s Deployment

Update `k8s/worker-deployment.yaml`:

```yaml
env:
  - name: E2B_API_KEY
    valueFrom:
      secretKeyRef:
        name: agent-api-secrets
        key: E2B_API_KEY
```

## Deployment

### 1. Get E2B API Key

Sign up at https://e2b.dev and get your API key.

### 2. Add to K8s Secrets

```bash
kubectl create secret generic agent-api-secrets \
  --from-literal=E2B_API_KEY="e2b_..." \
  --namespace=agents \
  --dry-run=client -o yaml | kubectl apply -f -
```

### 3. Build and Deploy

```bash
# Build with E2B support
docker build --platform linux/amd64 -t docker.io/axessvideo/agent-api:e2b .
docker push docker.io/axessvideo/agent-api:e2b

# Deploy
kubectl set image deployment/agent-worker worker=docker.io/axessvideo/agent-api:e2b -n agents
kubectl rollout status deployment/agent-worker -n agents
```

### 4. Verify

```bash
# Check worker logs for E2B initialization
kubectl logs -n agents deployment/agent-worker | grep "E2B"
# Should see: "✓ E2B sandbox executor enabled"

# Test with a job
python3 setup_test_user.py
```

## Testing

### Test Shell Execution

```python
from app.agent.tools.e2b_executor import E2BSandboxExecutor

executor = E2BSandboxExecutor(api_key="e2b_...")
result = await executor.execute_shell("ls -la")
print(result)
# {'stdout': '...', 'stderr': '', 'exit_code': 0}
```

### Test Code Execution

```python
result = await executor.execute_code("""
print("Hello from E2B!")
import platform
print(f"Running on: {platform.system()}")
""", language="python")
print(result)
# {'success': True, 'output': 'Hello from E2B!\nRunning on: Linux\n'}
```

### End-to-End Test

```bash
# Create and run a test job
python3 setup_test_user.py

# Monitor execution
python3 check_redis.py

# Should complete successfully without DNS errors
```

## Comparison: K8s Jobs vs E2B

| Aspect | K8s Jobs | E2B Sandboxes | Winner |
|--------|----------|---------------|--------|
| Networking | DNS issues | Reliable | ✅ E2B |
| Setup Complexity | High (manifests, RBAC) | Low (API key) | ✅ E2B |
| Resource Management | Manual quotas/limits | Auto-scaling | ✅ E2B |
| Cold Start Time | 10-30s | 2-5s | ✅ E2B |
| Data Residency | ✅ Swiss cluster | ❌ E2B cloud | ✅ K8s |
| Cost | Cluster resources | Per-execution | Depends |
| Maintenance | High (K8s admin) | Low (managed) | ✅ E2B |

**Hybrid Solution**: Use both where they excel!
- K8s: Orchestration, data residency
- E2B: Tool execution, reliability

## Troubleshooting

### "E2B not configured" Warning

```bash
# Check if E2B_API_KEY is set
kubectl get secret agent-api-secrets -n agents -o jsonpath='{.data.E2B_API_KEY}' | base64 -d

# If empty, add it:
kubectl create secret generic agent-api-secrets \
  --from-literal=E2B_API_KEY="e2b_..." \
  --namespace=agents \
  --dry-run=client -o yaml | kubectl apply -f -

# Restart worker
kubectl rollout restart deployment/agent-worker -n agents
```

### Sandbox Creation Fails

```bash
# Test E2B connection locally
python3 -c "
from e2b_code_interpreter import Sandbox
import os
sandbox = Sandbox(api_key=os.environ['E2B_API_KEY'])
print('✓ E2B sandbox created successfully')
sandbox.close()
"
```

### Jobs Still Failing

```bash
# Check failed job details
python3 check_failed_jobs.py

# Check worker logs
kubectl logs -n agents deployment/agent-worker --tail=100 | grep -i "e2b\|tool\|error"
```

## Next Steps

1. ✅ **Deploy E2B integration** (this guide)
2. ⬜ Add browser automation (Playwright in E2B)
3. ⬜ Add workspace persistence (E2B filesystem API)
4. ⬜ Add memory/timeout limits per tool
5. ⬜ Add execution cost tracking

## References

- E2B Documentation: https://e2b.dev/docs
- E2B Code Interpreter: https://github.com/e2b-dev/code-interpreter
- SwissBrain Architecture: Similar hybrid approach
- Phase 2B Infrastructure: `PHASE2B_SUCCESS.md`
