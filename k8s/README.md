# Kubernetes Manifests

This directory contains all Kubernetes manifests for deploying SwissBrain AI services to the Swiss K8s cluster (ch-gva-2).

## Directory Structure

```
k8s/
├── namespaces/          # Namespace, ResourceQuota, LimitRange
├── deployments/         # Deployment manifests and ConfigMaps
├── autoscaling/         # HPA and VPA configurations
├── policies/            # PodDisruptionBudget and NetworkPolicy
├── monitoring/          # ServiceMonitor and PrometheusRule
├── ingress/             # Ingress with TLS termination
└── cert-manager/        # Certificate management
```

## Quick Start

### 1. Create Namespace and Resource Quotas

```bash
kubectl apply -f namespaces/swissbrain-namespace.yaml
```

### 2. Deploy Application

```bash
# Apply all configurations
kubectl apply -f deployments/

# Or deploy individually
kubectl apply -f deployments/configmap.yaml
kubectl apply -f deployments/sandbox-executor.yaml
```

### 3. Configure Autoscaling

```bash
# HPA (Horizontal Pod Autoscaler)
kubectl apply -f autoscaling/sandbox-executor-hpa.yaml

# VPA (Vertical Pod Autoscaler) - Optional
kubectl apply -f autoscaling/sandbox-executor-vpa.yaml
```

### 4. Apply Policies

```bash
# PodDisruptionBudget and NetworkPolicy
kubectl apply -f policies/
```

### 5. Set Up Monitoring

```bash
# ServiceMonitor and PrometheusRule (requires Prometheus Operator)
kubectl apply -f monitoring/
```

### 6. Configure Ingress and TLS

```bash
# cert-manager ClusterIssuer
kubectl apply -f cert-manager/cluster-issuer.yaml

# Ingress with TLS
kubectl apply -f ingress/swissbrain-ingress-tls.yaml
```

## Deployment Commands

### Deploy Everything

```bash
# Apply all manifests in order
kubectl apply -f namespaces/
kubectl apply -f deployments/
kubectl apply -f autoscaling/sandbox-executor-hpa.yaml
kubectl apply -f policies/
kubectl apply -f monitoring/
kubectl apply -f cert-manager/
kubectl apply -f ingress/
```

### Verify Deployment

```bash
# Check all resources
kubectl get all -n swissbrain

# Check specific resources
kubectl get pods -n swissbrain
kubectl get svc -n swissbrain
kubectl get ingress -n swissbrain
kubectl get hpa -n swissbrain
kubectl get pdb -n swissbrain
kubectl get networkpolicy -n swissbrain

# Check resource usage
kubectl top pods -n swissbrain
kubectl top nodes
```

### Update Deployment

```bash
# Update image
kubectl set image deployment/sandbox-executor \
  sandbox-executor=ghcr.io/malenacutuli/swiss-ai-vault/sandbox-executor:v1.2.3 \
  -n swissbrain

# Watch rollout
kubectl rollout status deployment/sandbox-executor -n swissbrain

# Check rollout history
kubectl rollout history deployment/sandbox-executor -n swissbrain
```

### Rollback

```bash
# Rollback to previous version
kubectl rollout undo deployment/sandbox-executor -n swissbrain

# Rollback to specific revision
kubectl rollout undo deployment/sandbox-executor -n swissbrain --to-revision=2
```

### Scale Manually

```bash
# Scale deployment
kubectl scale deployment sandbox-executor -n swissbrain --replicas=5

# Scale via HPA (adjust min/max)
kubectl patch hpa sandbox-executor -n swissbrain -p '{"spec":{"minReplicas":5,"maxReplicas":15}}'
```

## Monitoring

### Check Pod Status

```bash
# Get pods
kubectl get pods -n swissbrain -l app=sandbox-executor

# Describe pod
kubectl describe pod <pod-name> -n swissbrain

# Check logs
kubectl logs -f -n swissbrain -l app=sandbox-executor

# Exec into pod
kubectl exec -it <pod-name> -n swissbrain -- /bin/sh
```

### Check HPA

```bash
# Get HPA status
kubectl get hpa -n swissbrain

# Describe HPA with metrics
kubectl describe hpa sandbox-executor -n swissbrain

# Watch HPA scaling
kubectl get hpa -n swissbrain -w
```

### Check Resource Usage

```bash
# Pod resource usage
kubectl top pods -n swissbrain

# Node resource usage
kubectl top nodes

# Resource quota usage
kubectl describe resourcequota swissbrain-quota -n swissbrain
```

### Check Network Policies

```bash
# List policies
kubectl get networkpolicy -n swissbrain

# Describe policy
kubectl describe networkpolicy sandbox-executor -n swissbrain

# Test connectivity
kubectl run -it --rm debug \
  --image=nicolaka/netshoot \
  --restart=Never \
  -n swissbrain \
  -- curl -v http://sandbox-executor:8000/health
```

## Troubleshooting

### Pods Not Starting

```bash
# Check pod status and events
kubectl get pods -n swissbrain
kubectl describe pod <pod-name> -n swissbrain

# Common issues:
# - ImagePullBackOff: Check image registry and credentials
# - CrashLoopBackOff: Check logs for errors
# - Pending: Check resource availability
```

### Check Logs

```bash
# Current logs
kubectl logs <pod-name> -n swissbrain

# Previous logs (after restart)
kubectl logs <pod-name> -n swissbrain --previous

# All pods
kubectl logs -n swissbrain -l app=sandbox-executor --tail=100
```

### Debug Container

```bash
# Run debug container in same namespace
kubectl run -it --rm debug \
  --image=nicolaka/netshoot \
  --restart=Never \
  -n swissbrain \
  -- /bin/bash

# Inside debug container:
# - Test DNS: nslookup sandbox-executor
# - Test HTTP: curl http://sandbox-executor:8000/health
# - Test network: ping, traceroute, etc.
```

### Resource Issues

```bash
# Check node resources
kubectl describe nodes

# Check pod resource limits
kubectl get pod <pod-name> -n swissbrain -o jsonpath='{.spec.containers[0].resources}'

# Increase resources if needed
kubectl set resources deployment sandbox-executor -n swissbrain \
  --limits=cpu=2000m,memory=4Gi \
  --requests=cpu=500m,memory=1Gi
```

## Security

### gVisor Runtime

Deployments use gVisor runtime for enhanced security:

```yaml
runtimeClassName: gvisor
```

Verify gVisor is available:
```bash
kubectl get runtimeclass
```

### Security Context

All containers run as non-root with dropped capabilities:

```yaml
securityContext:
  runAsNonRoot: true
  runAsUser: 1000
  readOnlyRootFilesystem: true
  allowPrivilegeEscalation: false
  capabilities:
    drop:
      - ALL
```

### Network Policies

Network policies restrict traffic by default. To allow new connections, update:
```bash
kubectl edit networkpolicy sandbox-executor -n swissbrain
```

## CI/CD Integration

These manifests integrate with GitHub Actions workflows:

### Deploy via GitHub Actions

```bash
gh workflow run k8s-deploy.yml \
  -f image_tag=v1.2.3 \
  -f deployment=sandbox-executor
```

### Deploy via kubectl

```bash
# Update image in deployment
kubectl set image deployment/sandbox-executor \
  sandbox-executor=ghcr.io/malenacutuli/swiss-ai-vault/sandbox-executor:v1.2.3 \
  -n swissbrain

# Watch rollout
kubectl rollout status deployment/sandbox-executor -n swissbrain
```

## Documentation

For detailed information, see:

- [Kubernetes Optimization Guide](../docs/KUBERNETES_OPTIMIZATION_GUIDE.md) - Comprehensive guide
- [cert-manager README](cert-manager/README.md) - TLS certificate management
- [Docker Build Guide](../docs/DOCKER_BUILD_GUIDE.md) - Container images
- [GitHub Secrets Setup](../docs/GITHUB_SECRETS_SETUP.md) - CI/CD configuration

## Support

For issues or questions:
1. Check the troubleshooting section in this README
2. Review the Kubernetes Optimization Guide
3. Check pod logs and events
4. Contact the SwissBrain infrastructure team

## Notes

- All manifests assume namespace: `swissbrain`
- Cluster: Swiss K8s (ch-gva-2)
- Registry: ghcr.io/malenacutuli/swiss-ai-vault
- Monitoring: Prometheus Operator required for ServiceMonitor/PrometheusRule
- TLS: cert-manager required for automatic certificate provisioning
