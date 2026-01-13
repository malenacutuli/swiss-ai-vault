# Kubernetes Resource Optimization Guide

This guide provides comprehensive documentation for optimizing Kubernetes resources, autoscaling, and high availability configurations for the SwissBrain AI platform on Swiss K8s cluster.

## Table of Contents

1. [Overview](#overview)
2. [Resource Management](#resource-management)
3. [Autoscaling Strategies](#autoscaling-strategies)
4. [High Availability](#high-availability)
5. [Network Policies](#network-policies)
6. [Monitoring and Alerting](#monitoring-and-alerting)
7. [Deployment Strategies](#deployment-strategies)
8. [Troubleshooting](#troubleshooting)

---

## Overview

The SwissBrain K8s infrastructure is optimized for:
- **Resource efficiency**: Right-sized limits and requests
- **High availability**: Multi-zone deployment with PodDisruptionBudgets
- **Auto-scaling**: HPA and VPA for dynamic resource allocation
- **Security**: gVisor runtime, network policies, RBAC
- **Observability**: Prometheus metrics, alerts, and dashboards

### Architecture Summary

```
┌────────────────────────────────────────────────────────────────┐
│                  Swiss K8s Cluster (ch-gva-2)                  │
├────────────────────────────────────────────────────────────────┤
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Namespace: swissbrain                                     │ │
│  │ • Resource Quota: 40 CPU / 80Gi Memory                   │ │
│  │ • LimitRange: Default limits and constraints             │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Deployment: sandbox-executor                             │ │
│  │ • Replicas: 3-10 (HPA-managed)                          │ │
│  │ • Runtime: gVisor (runsc)                                │ │
│  │ • Resources: 250m-1000m CPU, 512Mi-2Gi Memory           │ │
│  │ • PodDisruptionBudget: minAvailable=2                   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Ingress + TLS                                            │ │
│  │ • cert-manager: Let's Encrypt certs                      │ │
│  │ • nginx: api.swissbrain.ai                               │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │ Monitoring                                                │ │
│  │ • Prometheus: Metrics collection                         │ │
│  │ • ServiceMonitor: Auto-discovery                         │ │
│  │ • PrometheusRule: Alerting rules                         │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

---

## Resource Management

### Resource Requests and Limits

**Best Practices**:
- Set requests based on baseline usage
- Set limits to prevent resource exhaustion
- Maintain a ratio of 1:2 to 1:4 (requests:limits)

#### Sandbox Executor Configuration

```yaml
resources:
  requests:
    cpu: 250m         # Baseline: 0.25 cores
    memory: 512Mi     # Baseline: 512 MiB
    ephemeral-storage: 1Gi
  limits:
    cpu: 1000m        # Max: 1 core (4x requests)
    memory: 2Gi       # Max: 2 GiB (4x requests)
    ephemeral-storage: 5Gi
```

**Rationale**:
- `requests`: Guaranteed resources for pod scheduling
- `limits`: Maximum resources pod can consume
- Ratio allows bursting while preventing resource monopolization

### Resource Quotas

Namespace-level limits prevent resource exhaustion:

```yaml
hard:
  requests.cpu: "20"        # Max 20 cores requested
  requests.memory: 40Gi     # Max 40 GiB requested
  limits.cpu: "40"          # Max 40 cores total
  limits.memory: 80Gi       # Max 80 GiB total
  pods: "50"                # Max 50 pods
```

**Check quota usage**:
```bash
kubectl describe resourcequota swissbrain-quota -n swissbrain
```

### LimitRange

Default limits for containers without explicit resource specs:

```yaml
default:
  cpu: 500m
  memory: 1Gi
defaultRequest:
  cpu: 100m
  memory: 256Mi
```

**Benefits**:
- Prevents unbounded resource consumption
- Provides sensible defaults
- Ensures consistent resource allocation

---

## Autoscaling Strategies

### Horizontal Pod Autoscaler (HPA)

Scales pod count based on metrics:

#### Configuration

```yaml
minReplicas: 3
maxReplicas: 10
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

#### Scaling Behavior

**Scale Up**:
- Stabilization: 60 seconds
- Max increase: 100% per 30 seconds OR 2 pods per 30 seconds
- Fast response to traffic spikes

**Scale Down**:
- Stabilization: 300 seconds (5 minutes)
- Max decrease: 50% per 60 seconds OR 1 pod per 60 seconds
- Conservative to prevent flapping

#### HPA Commands

```bash
# Check HPA status
kubectl get hpa -n swissbrain

# Describe HPA with current metrics
kubectl describe hpa sandbox-executor -n swissbrain

# Watch HPA scaling decisions
kubectl get hpa -n swissbrain -w

# Manually adjust HPA
kubectl patch hpa sandbox-executor -n swissbrain -p '{"spec":{"minReplicas":5}}'
```

### Vertical Pod Autoscaler (VPA)

Automatically adjusts CPU and memory requests/limits:

#### Modes

1. **Off**: Only provides recommendations
2. **Initial**: Sets resources on pod creation only
3. **Recreate**: Updates resources by recreating pods
4. **Auto**: Updates resources in place (requires VPA admission controller)

#### Configuration

```yaml
updatePolicy:
  updateMode: "Auto"
resourcePolicy:
  containerPolicies:
    - containerName: sandbox-executor
      minAllowed:
        cpu: 100m
        memory: 256Mi
      maxAllowed:
        cpu: 2000m
        memory: 4Gi
```

#### VPA Commands

```bash
# Check VPA recommendations
kubectl describe vpa sandbox-executor-recommender -n swissbrain

# View current recommendations
kubectl get vpa -n swissbrain -o yaml | grep -A 10 recommendation
```

### HPA vs VPA

| Aspect | HPA | VPA |
|--------|-----|-----|
| **What it scales** | Pod count | Pod resources |
| **Best for** | Variable load | Consistent load with wrong sizing |
| **Response time** | Fast (seconds) | Slow (requires pod restart) |
| **Use case** | Traffic spikes | Right-sizing resources |
| **Conflicts** | Can't use both on CPU/memory | Can't use both on CPU/memory |

**Recommendation**: Use HPA for sandbox-executor due to variable workload patterns.

---

## High Availability

### Multi-zone Deployment

**Topology Spread Constraints** ensure pods are distributed across zones:

```yaml
topologySpreadConstraints:
  - maxSkew: 1
    topologyKey: topology.kubernetes.io/zone
    whenUnsatisfiable: DoNotSchedule
    labelSelector:
      matchLabels:
        app: sandbox-executor
```

**Result**: With 3 replicas, each zone gets 1 pod (maxSkew=1 enforces even distribution).

### Pod Anti-affinity

Prefer spreading pods across different nodes:

```yaml
affinity:
  podAntiAffinity:
    preferredDuringSchedulingIgnoredDuringExecution:
      - weight: 100
        podAffinityTerm:
          labelSelector:
            matchExpressions:
              - key: app
                operator: In
                values:
                  - sandbox-executor
          topologyKey: kubernetes.io/hostname
```

**Effect**: Pods prefer different nodes, improving resilience to node failures.

### PodDisruptionBudget (PDB)

Ensures minimum availability during voluntary disruptions:

```yaml
minAvailable: 2
```

**Protects against**:
- Node drains
- Cluster upgrades
- Pod evictions

**Commands**:
```bash
# Check PDB status
kubectl get pdb -n swissbrain

# Describe PDB
kubectl describe pdb sandbox-executor -n swissbrain

# Test if pod can be evicted
kubectl drain <node-name> --dry-run
```

### Rolling Updates

Zero-downtime deployments:

```yaml
strategy:
  type: RollingUpdate
  rollingUpdate:
    maxSurge: 1        # Create 1 extra pod during update
    maxUnavailable: 0  # Always maintain full capacity
```

**Update process**:
1. Create 1 new pod (maxSurge=1)
2. Wait for new pod to be ready
3. Terminate 1 old pod
4. Repeat until all pods updated

**Commands**:
```bash
# Update image
kubectl set image deployment/sandbox-executor \
  sandbox-executor=ghcr.io/malenacutuli/swiss-ai-vault/sandbox-executor:v1.2.3 \
  -n swissbrain

# Watch rollout
kubectl rollout status deployment/sandbox-executor -n swissbrain

# Check rollout history
kubectl rollout history deployment/sandbox-executor -n swissbrain

# Rollback if needed
kubectl rollout undo deployment/sandbox-executor -n swissbrain
```

---

## Network Policies

### Default Policies

1. **Default Deny Ingress**: Block all incoming traffic by default
2. **Default Allow Egress**: Allow all outgoing traffic by default

### Sandbox Executor Policy

**Ingress** (what can reach sandbox-executor):
- ✅ Nginx ingress controller on port 8000
- ✅ Pods in same namespace on ports 8000, 9090
- ✅ Prometheus scraping on port 9090

**Egress** (where sandbox-executor can connect):
- ✅ DNS resolution (kube-dns on port 53)
- ✅ HTTPS to external services (port 443)
- ✅ Internal HTTP services (port 80, 8000)
- ✅ PostgreSQL (port 5432) and Redis (port 6379)

### Network Policy Commands

```bash
# List network policies
kubectl get networkpolicy -n swissbrain

# Describe policy
kubectl describe networkpolicy sandbox-executor -n swissbrain

# Test connectivity
kubectl run -it --rm debug \
  --image=nicolaka/netshoot \
  --restart=Never \
  -n swissbrain \
  -- /bin/bash

# Inside debug pod:
curl http://sandbox-executor:8000/health
```

---

## Monitoring and Alerting

### Metrics Collection

**ServiceMonitor** automatically discovers and scrapes metrics:

```yaml
endpoints:
  - port: metrics
    interval: 30s
    path: /metrics
```

**Collected metrics** (examples):
- `http_requests_total`: Request count
- `http_request_duration_seconds`: Request latency
- `process_cpu_seconds_total`: CPU usage
- `process_resident_memory_bytes`: Memory usage
- `up`: Service availability

### Prometheus Alerts

#### Alert Rules

1. **SandboxExecutorHighCPU**: CPU > 80% for 5 minutes
2. **SandboxExecutorHighMemory**: Memory > 85% for 5 minutes
3. **SandboxExecutorPodRestarting**: Restart rate > 0.1/15min
4. **SandboxExecutorPodNotReady**: Pod not running for 10 minutes
5. **SandboxExecutorReplicaMismatch**: Desired ≠ available replicas for 15 minutes
6. **SandboxExecutorHighErrorRate**: Error rate > 5% for 5 minutes
7. **SandboxExecutorLowAvailability**: < 70% pods running for 5 minutes

#### Alert Management

```bash
# Check PrometheusRule
kubectl get prometheusrule -n swissbrain

# View alert definitions
kubectl get prometheusrule sandbox-executor-alerts -n swissbrain -o yaml

# Check active alerts (via Prometheus UI)
# Navigate to: http://<prometheus-url>/alerts
```

### Grafana Dashboards

**Recommended dashboards**:
- Kubernetes Cluster Monitoring
- Kubernetes Pod Resources
- Node Exporter Full
- Custom: Sandbox Executor Dashboard

**Key metrics to visualize**:
- CPU usage by pod
- Memory usage by pod
- Request rate and latency
- Error rate
- Pod restart count
- HPA scaling decisions

---

## Deployment Strategies

### Blue-Green Deployment

Create new deployment (green), switch traffic when ready:

```bash
# Create green deployment
kubectl apply -f sandbox-executor-green.yaml

# Test green deployment internally
kubectl port-forward -n swissbrain deployment/sandbox-executor-green 8000:8000

# Switch service to green
kubectl patch service sandbox-executor -n swissbrain \
  -p '{"spec":{"selector":{"version":"green"}}}'

# Delete blue deployment after verification
kubectl delete deployment sandbox-executor-blue -n swissbrain
```

### Canary Deployment

Gradually shift traffic to new version:

```bash
# Deploy canary with 1 replica
kubectl apply -f sandbox-executor-canary.yaml

# Monitor canary metrics
kubectl logs -f -n swissbrain -l version=canary

# If successful, scale canary up and stable down
kubectl scale deployment sandbox-executor-canary -n swissbrain --replicas=3
kubectl scale deployment sandbox-executor -n swissbrain --replicas=0

# Delete old deployment
kubectl delete deployment sandbox-executor -n swissbrain
```

### A/B Testing

Route specific traffic to different versions using Ingress annotations:

```yaml
nginx.ingress.kubernetes.io/canary: "true"
nginx.ingress.kubernetes.io/canary-weight: "20"  # 20% to canary
```

---

## Troubleshooting

### Pod Issues

#### Pods Not Starting

```bash
# Check pod status
kubectl get pods -n swissbrain -l app=sandbox-executor

# Describe pod for events
kubectl describe pod <pod-name> -n swissbrain

# Common issues:
# - ImagePullBackOff: Check image name and registry access
# - CrashLoopBackOff: Check logs for application errors
# - Pending: Check resource availability and node affinity
```

#### Check Logs

```bash
# Current logs
kubectl logs -n swissbrain <pod-name>

# Previous logs (if pod restarted)
kubectl logs -n swissbrain <pod-name> --previous

# Follow logs
kubectl logs -f -n swissbrain -l app=sandbox-executor

# Logs from specific container
kubectl logs -n swissbrain <pod-name> -c sandbox-executor
```

### Resource Issues

#### Out of Resources

```bash
# Check node resources
kubectl top nodes

# Check pod resources
kubectl top pods -n swissbrain

# Describe node for allocatable resources
kubectl describe node <node-name>

# Check resource quota usage
kubectl describe resourcequota -n swissbrain
```

#### OOMKilled (Out of Memory)

```bash
# Check pod status
kubectl get pods -n swissbrain

# If STATUS shows OOMKilled:
# 1. Check memory limits
kubectl get pod <pod-name> -n swissbrain -o jsonpath='{.spec.containers[0].resources}'

# 2. Check actual memory usage before restart
kubectl describe pod <pod-name> -n swissbrain | grep -A 10 "Last State"

# 3. Increase memory limits
kubectl set resources deployment sandbox-executor -n swissbrain \
  --limits=memory=4Gi --requests=memory=1Gi
```

### HPA Not Scaling

```bash
# Check HPA status
kubectl describe hpa sandbox-executor -n swissbrain

# Common issues:
# - Metrics not available: Check metrics-server
# - Target utilization not met: Check current vs target
# - At max/min replicas: Check HPA spec

# Check metrics-server
kubectl top pods -n swissbrain

# If metrics not available:
kubectl get pods -n kube-system -l k8s-app=metrics-server
```

### Network Policy Issues

```bash
# Test connectivity from debug pod
kubectl run -it --rm debug \
  --image=nicolaka/netshoot \
  --restart=Never \
  -n swissbrain \
  -- curl -v http://sandbox-executor:8000/health

# If connection fails:
# 1. Check NetworkPolicy
kubectl get networkpolicy -n swissbrain

# 2. Describe policy
kubectl describe networkpolicy sandbox-executor -n swissbrain

# 3. Temporarily delete policy to test
kubectl delete networkpolicy sandbox-executor -n swissbrain

# 4. If connection works, update policy and reapply
```

### Ingress Issues

```bash
# Check ingress
kubectl get ingress -n swissbrain

# Describe ingress
kubectl describe ingress swissbrain-ingress -n swissbrain

# Check ingress controller logs
kubectl logs -n ingress-nginx -l app.kubernetes.io/name=ingress-nginx

# Test service directly
kubectl port-forward -n swissbrain svc/sandbox-executor 8000:8000
curl http://localhost:8000/health
```

---

## Best Practices Summary

### Resource Management
1. ✅ Always set both requests and limits
2. ✅ Use 1:2 to 1:4 ratio for requests:limits
3. ✅ Monitor actual usage and adjust accordingly
4. ✅ Use VPA in recommendation mode before enabling auto-updates
5. ✅ Set namespace resource quotas

### High Availability
1. ✅ Minimum 3 replicas for production
2. ✅ Use PodDisruptionBudgets
3. ✅ Configure topology spread constraints
4. ✅ Use pod anti-affinity
5. ✅ Implement proper health checks
6. ✅ Set termination grace period (30s+)

### Autoscaling
1. ✅ Use HPA for variable workloads
2. ✅ Configure appropriate scaling thresholds (70-80%)
3. ✅ Set conservative scale-down policies
4. ✅ Monitor scaling decisions and adjust
5. ✅ Don't use HPA and VPA on same metrics

### Security
1. ✅ Use gVisor runtime for sandboxing
2. ✅ Run as non-root user
3. ✅ Use read-only root filesystem
4. ✅ Drop all capabilities
5. ✅ Implement network policies
6. ✅ Use RBAC with least privilege
7. ✅ Regular security scanning

### Monitoring
1. ✅ Expose Prometheus metrics
2. ✅ Configure ServiceMonitor
3. ✅ Set up alerting rules
4. ✅ Create Grafana dashboards
5. ✅ Monitor golden signals (latency, traffic, errors, saturation)
6. ✅ Set up log aggregation

---

## Additional Resources

- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [HPA Documentation](https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/)
- [VPA Documentation](https://github.com/kubernetes/autoscaler/tree/master/vertical-pod-autoscaler)
- [Network Policies](https://kubernetes.io/docs/concepts/services-networking/network-policies/)
- [gVisor Runtime](https://gvisor.dev/docs/user_guide/quick_start/kubernetes/)
- [Prometheus Operator](https://prometheus-operator.dev/)
- [Swiss K8s Documentation](https://www.swisscom.ch/en/business/enterprise/offer/cloud/cloudservices/kubernetes-services.html)

---

## Deployment Checklist

Before deploying to production:

- [ ] Namespace created with resource quotas
- [ ] Deployment manifest configured
- [ ] Resource requests and limits set appropriately
- [ ] HPA configured and tested
- [ ] PDB configured (minAvailable: 2)
- [ ] Network policies applied
- [ ] ServiceMonitor configured
- [ ] PrometheusRule alerts set up
- [ ] Grafana dashboards created
- [ ] Health checks working
- [ ] TLS certificates configured
- [ ] Ingress routing working
- [ ] Load testing performed
- [ ] Disaster recovery plan documented
- [ ] Runbook created for on-call team

---

## Conclusion

This guide provides a comprehensive foundation for optimizing Kubernetes resources on the Swiss K8s cluster. Regular monitoring, testing, and adjustment based on actual usage patterns will ensure optimal performance and cost efficiency.

For questions or issues, refer to the troubleshooting section or contact the SwissBrain infrastructure team.
