# Quick Deployment Checklist

## Before You Start

- [ ] Download kubeconfig from Exoscale Console
- [ ] Save to `/Users/malena/.kube/swiss-k8s-config`
- [ ] Test: `export KUBECONFIG=/Users/malena/.kube/swiss-k8s-config && kubectl cluster-info`

## Credentials Needed

- [ ] Supabase service role key (from dashboard)
- [ ] Anthropic API key (from console.anthropic.com)
- [ ] Upstash Redis URL (from dashboard)
- [ ] Docker Hub credentials (or private registry)

## Deployment Commands

```bash
# 1. Set kubectl context
export KUBECONFIG=/Users/malena/.kube/swiss-k8s-config
kubectl cluster-info

# 2. Apply database migrations (use Supabase SQL Editor)
# Go to: https://supabase.com/dashboard/project/ghmmdochvlrnwbruyrqk/editor
# Run migrations from supabase/migrations/ folder

# 3. Update registry in files
cd /Users/malena/swiss-ai-vault/agent-api
# Edit deploy.sh line 6: REGISTRY="docker.io/yourusername"
# Edit k8s/deployment.yaml line 27: image: docker.io/yourusername/agent-api:latest

# 4. Setup secrets
./setup-secrets.sh
# Enter: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY, REDIS_URL

# 5. Deploy
./deploy.sh

# 6. Verify
kubectl get pods -n agents
curl https://api.swissbrain.ai/health
```

## Quick Test

```bash
curl https://api.swissbrain.ai/health
# Should return: {"status":"healthy","version":"1.0.0"}
```

## If Something Goes Wrong

```bash
# Check pods
kubectl get pods -n agents

# Check logs
kubectl logs -f deployment/agent-api -n agents

# Check events
kubectl get events -n agents --sort-by='.lastTimestamp' | tail -20
```

---

See DEPLOYMENT_GUIDE.md for detailed instructions.
