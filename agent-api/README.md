# Swiss Agent API

FastAPI-based agent execution system running on Swiss K8s infrastructure (Exoscale ch-gva-2).

## Architecture

```
┌─────────────────────────────────────────────┐
│         api.swissbrain.ai (185.19.28.196)   │
├─────────────────────────────────────────────┤
│                                             │
│   Swiss K8s Cluster (Exoscale ch-gva-2)    │
│   ┌───────────────────────────────────┐    │
│   │       Agent API (FastAPI)         │    │
│   │  - agent/execute                  │    │
│   │  - agent/status                   │    │
│   │  - agent/logs                     │    │
│   └───────────────────────────────────┘    │
│                    ↓                        │
│   ┌───────────────────────────────────┐    │
│   │      K8s Job Spawner              │    │
│   │  - Code execution                 │    │
│   │  - Tool isolation                 │    │
│   └───────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
         ↓                            ↓
    Supabase                    Upstash Redis
   (Direct project)              (EU region)
```

## Features

- **Agent Execution**: Create, start, stop, retry, resume
- **Real-time Status**: Progress tracking with pagination
- **Log Streaming**: Polling and SSE modes
- **K8s Native**: Spawns isolated jobs for tool execution
- **Auth Integration**: Supabase JWT verification
- **Production Ready**: Health checks, structured logging, metrics

## API Endpoints

### Agent Execute
```http
POST /agent/execute
Authorization: Bearer <jwt_token>

{
  "action": "create",
  "prompt": "Write a Python hello world script"
}
```

### Agent Status
```http
POST /agent/status
Authorization: Bearer <jwt_token>

{
  "run_id": "uuid",
  "include_steps": true,
  "include_logs": true
}
```

### Agent Logs
```http
GET /agent/logs?run_id=uuid&mode=streaming
Authorization: Bearer <jwt_token>
```

## Local Development

### Prerequisites

- Python 3.11+
- Docker
- kubectl configured for Swiss K8s cluster

### Setup

1. **Clone and install dependencies:**
```bash
cd agent-api
python -m venv venv
source venv/bin/activate  # or `venv\Scripts\activate` on Windows
pip install -r requirements.txt
```

2. **Create `.env` file:**
```bash
# Supabase (Direct project)
SUPABASE_URL=https://auth.swissvault.ai
SUPABASE_SERVICE_ROLE_KEY=your_key_here

# Anthropic LLM
ANTHROPIC_API_KEY=your_key_here

# Upstash Redis
REDIS_URL=your_redis_url_here

# K8s (for local dev)
K8S_IN_CLUSTER=false
K8S_NAMESPACE=agents

# Debug
DEBUG=true
```

3. **Run locally:**
```bash
uvicorn app.main:app --reload --port 8000
```

4. **Test API:**
```bash
# Health check
curl http://localhost:8000/health

# API docs
open http://localhost:8000/docs
```

## Deployment to Swiss K8s

### Step 1: Setup K8s Secrets

```bash
./setup-secrets.sh
```

This will prompt you for:
- Supabase URL and service role key
- Anthropic API key
- Redis URL

### Step 2: Build and Deploy

```bash
./deploy.sh
```

This script will:
1. Build Docker image
2. Push to container registry
3. Apply K8s manifests
4. Wait for rollout
5. Show deployment status

### Step 3: Verify Deployment

```bash
# Check pods
kubectl get pods -n agents

# Check logs
kubectl logs -f deployment/agent-api -n agents

# Test API
curl https://api.swissbrain.ai/health
```

## Manual Deployment Steps

If you prefer manual deployment:

### 1. Build Docker Image

```bash
docker build -t registry.swissvault.ai/agent-api:latest .
```

### 2. Push to Registry

```bash
docker push registry.swissvault.ai/agent-api:latest
```

### 3. Create Namespace

```bash
kubectl create namespace agents
```

### 4. Create Secrets

```bash
kubectl create secret generic agent-api-secrets \
  --from-literal=SUPABASE_URL="https://auth.swissvault.ai" \
  --from-literal=SUPABASE_SERVICE_ROLE_KEY="your-key" \
  --from-literal=ANTHROPIC_API_KEY="your-key" \
  --from-literal=REDIS_URL="your-url" \
  --namespace=agents
```

### 5. Apply Manifests

```bash
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml
```

### 6. Wait for Rollout

```bash
kubectl rollout status deployment/agent-api -n agents
```

## Monitoring

### Check Pod Status

```bash
kubectl get pods -n agents -l app=agent-api
```

### View Logs

```bash
# All pods
kubectl logs -f deployment/agent-api -n agents

# Specific pod
kubectl logs -f <pod-name> -n agents

# Previous pod (if crashed)
kubectl logs --previous <pod-name> -n agents
```

### Check Events

```bash
kubectl get events -n agents --sort-by='.lastTimestamp'
```

### Describe Deployment

```bash
kubectl describe deployment agent-api -n agents
```

## Scaling

### Manual Scaling

```bash
# Scale to 5 replicas
kubectl scale deployment agent-api --replicas=5 -n agents
```

### Auto-scaling (HPA)

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: agent-api-hpa
  namespace: agents
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: agent-api
  minReplicas: 3
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Troubleshooting

### Pods not starting

```bash
# Check pod events
kubectl describe pod <pod-name> -n agents

# Check logs
kubectl logs <pod-name> -n agents

# Check if secrets exist
kubectl get secret agent-api-secrets -n agents
```

### 404 errors

```bash
# Check ingress
kubectl describe ingress agent-api-ingress -n agents

# Check service
kubectl get svc agent-api -n agents

# Check endpoints
kubectl get endpoints agent-api -n agents
```

### Memory/CPU issues

```bash
# Check resource usage
kubectl top pods -n agents

# Increase limits in deployment.yaml
resources:
  limits:
    memory: "4Gi"
    cpu: "2000m"
```

## Configuration

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `SUPABASE_URL` | Supabase project URL | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key | Yes |
| `REDIS_URL` | Upstash Redis URL | Yes |
| `K8S_NAMESPACE` | K8s namespace for jobs | No (default: agents) |
| `K8S_IN_CLUSTER` | Running in K8s cluster | No (default: true) |
| `DEBUG` | Enable debug mode | No (default: false) |

### Resource Requirements

- **CPU**: 250m request, 1000m limit
- **Memory**: 512Mi request, 2Gi limit
- **Replicas**: 3 (can scale to 10+)

## Security

- Runs as non-root user (uid 1000)
- Read-only root filesystem
- No privilege escalation
- All capabilities dropped
- Network policies enforced
- TLS termination at ingress

## Integration

### Frontend Integration

Update frontend to use `api.swissbrain.ai`:

```typescript
// src/integrations/supabase/agent-client.ts
const AGENT_API_URL = 'https://api.swissbrain.ai';

async function createAgentRun(prompt: string) {
  const { data: { session } } = await supabase.auth.getSession();

  const response = await fetch(`${AGENT_API_URL}/agent/execute`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${session.access_token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: 'create',
      prompt,
    }),
  });

  return await response.json();
}
```

## License

Proprietary - SwissVault.ai

## Support

For issues or questions, contact the platform team.
