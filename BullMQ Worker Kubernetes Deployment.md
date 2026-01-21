# BullMQ Worker Kubernetes Deployment

This directory contains Kustomize configurations for deploying the BullMQ worker to Kubernetes.

## Directory Structure

```
k8s/
├── kustomization.yaml          # Root kustomization (defaults to production)
├── README.md                   # This file
├── base/
│   ├── kustomization.yaml      # Base configuration
│   ├── manifests.yaml          # All Kubernetes resources
│   └── commonlabels.yaml       # Label transformer config
├── overlays/
│   ├── development/
│   │   └── kustomization.yaml  # Dev: 1 replica, debug logging
│   ├── staging/
│   │   └── kustomization.yaml  # Staging: 3 replicas
│   └── production/
│       └── kustomization.yaml  # Production: 5 replicas, enhanced resources
└── patches/
    └── replica-count-5.yaml    # Standalone replica patch
```

## Quick Start

### Deploy to Production (5 replicas)

```bash
# Preview what will be deployed
kubectl kustomize k8s/

# Apply to cluster
kubectl apply -k k8s/

# Or explicitly use production overlay
kubectl apply -k k8s/overlays/production/
```

### Deploy to Staging (3 replicas)

```bash
kubectl apply -k k8s/overlays/staging/
```

### Deploy to Development (1 replica)

```bash
kubectl apply -k k8s/overlays/development/
```

## Environment Comparison

| Setting | Development | Staging | Production |
|---------|-------------|---------|------------|
| Replicas | 1 | 3 | 5 |
| HPA Min/Max | 1/2 | 2/10 | 5/50 |
| CPU Request | 100m | 500m | 1000m |
| CPU Limit | 500m | 2000m | 4000m |
| Memory Request | 256Mi | 1Gi | 2Gi |
| Memory Limit | 1Gi | 8Gi | 16Gi |
| Concurrency | 2 | 10 | 15 |
| Log Level | debug | info | warn |
| PDB minAvailable | 0 | 2 | 3 |

## Customization

### Change Replica Count

Edit the overlay's `kustomization.yaml`:

```yaml
replicas:
  - name: bullmq-worker
    count: 10  # Your desired count
```

Or use the standalone patch:

```bash
kubectl patch deployment bullmq-worker -n workers \
  --patch-file k8s/patches/replica-count-5.yaml
```

### Change Image Tag

```yaml
images:
  - name: docker.io/swissbrain/bullmq-worker
    newTag: "2.0.0"
```

### Add Environment Variables

Add to the ConfigMap patch in your overlay:

```yaml
patches:
  - target:
      kind: ConfigMap
      name: bullmq-worker-config
    patch: |-
      apiVersion: v1
      kind: ConfigMap
      metadata:
        name: bullmq-worker-config
      data:
        MY_NEW_VAR: "value"
```

### Add Secrets

For production, use External Secrets Operator:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: bullmq-worker-secrets
  namespace: workers
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: vault-backend
    kind: ClusterSecretStore
  target:
    name: bullmq-worker-secrets
  data:
    - secretKey: redis-password
      remoteRef:
        key: swissbrain/redis
        property: password
```

## Verification

### Check Deployment Status

```bash
# Watch rollout
kubectl rollout status deployment/bullmq-worker -n workers

# Check pods
kubectl get pods -n workers -l app=bullmq-worker

# Check HPA
kubectl get hpa -n workers

# Check logs
kubectl logs -f deployment/bullmq-worker -n workers
```

### Validate Manifests

```bash
# Dry run
kubectl apply -k k8s/overlays/production/ --dry-run=client

# Server-side dry run
kubectl apply -k k8s/overlays/production/ --dry-run=server

# Diff against current state
kubectl diff -k k8s/overlays/production/
```

## Rollback

```bash
# View rollout history
kubectl rollout history deployment/bullmq-worker -n workers

# Rollback to previous version
kubectl rollout undo deployment/bullmq-worker -n workers

# Rollback to specific revision
kubectl rollout undo deployment/bullmq-worker -n workers --to-revision=2
```

## Troubleshooting

### Pods Not Starting

```bash
# Check events
kubectl get events -n workers --sort-by='.lastTimestamp'

# Describe pod
kubectl describe pod -n workers -l app=bullmq-worker

# Check resource quotas
kubectl describe resourcequota -n workers
```

### Redis Connection Issues

```bash
# Check if Redis is accessible
kubectl exec -it deployment/bullmq-worker -n workers -- \
  nc -zv redis-cluster.redis.svc.cluster.local 6379

# Check TLS certificates
kubectl exec -it deployment/bullmq-worker -n workers -- \
  ls -la /etc/redis-tls/
```

### High Memory Usage

```bash
# Check current usage
kubectl top pods -n workers -l app=bullmq-worker

# Check limits
kubectl get deployment bullmq-worker -n workers -o jsonpath='{.spec.template.spec.containers[0].resources}'
```
