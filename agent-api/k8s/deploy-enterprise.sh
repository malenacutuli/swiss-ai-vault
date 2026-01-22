#!/bin/bash
# =============================================================================
# Deploy Enterprise Agent Worker
# =============================================================================
# Deploys all enterprise K8s manifests for SwissBrain agent worker
# Matches Manus.im BullMQ Worker specification
#
# Usage:
#   ./k8s/deploy-enterprise.sh
# =============================================================================

set -e

NAMESPACE="agents"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==================================================================="
echo "  SwissBrain Agent Worker - Enterprise Deployment"
echo "==================================================================="
echo ""

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "ERROR: kubectl not found"
    exit 1
fi

# Check cluster connection
echo "Checking cluster connection..."
if ! kubectl cluster-info &> /dev/null; then
    echo "ERROR: Cannot connect to Kubernetes cluster"
    exit 1
fi
echo "✓ Connected to cluster"
echo ""

# Create namespace if not exists
echo "Ensuring namespace exists..."
kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -
echo "✓ Namespace $NAMESPACE ready"
echo ""

# Apply manifests in order
echo "Applying Kubernetes manifests..."
echo ""

# 1. Service (needed by ServiceMonitor)
echo "1/7 Applying Service..."
kubectl apply -f "$SCRIPT_DIR/worker-service.yaml"
echo "✓ Service applied"

# 2. Deployment
echo "2/7 Applying Deployment..."
kubectl apply -f "$SCRIPT_DIR/worker-deployment.yaml"
echo "✓ Deployment applied"

# 3. HPA
echo "3/7 Applying HorizontalPodAutoscaler..."
kubectl apply -f "$SCRIPT_DIR/worker-hpa.yaml"
echo "✓ HPA applied"

# 4. PDB
echo "4/7 Applying PodDisruptionBudget..."
kubectl apply -f "$SCRIPT_DIR/worker-pdb.yaml"
echo "✓ PDB applied"

# 5. NetworkPolicy (optional - may require CNI support)
echo "5/7 Applying NetworkPolicy..."
kubectl apply -f "$SCRIPT_DIR/worker-networkpolicy.yaml" || echo "⚠ NetworkPolicy skipped (CNI may not support it)"

# 6. ServiceMonitor (optional - requires Prometheus Operator)
echo "6/7 Applying ServiceMonitor..."
kubectl apply -f "$SCRIPT_DIR/worker-servicemonitor.yaml" 2>/dev/null || echo "⚠ ServiceMonitor skipped (Prometheus Operator not installed)"

# 7. PrometheusRule (optional - requires Prometheus Operator)
echo "7/7 Applying PrometheusRule..."
kubectl apply -f "$SCRIPT_DIR/worker-prometheusrule.yaml" 2>/dev/null || echo "⚠ PrometheusRule skipped (Prometheus Operator not installed)"

echo ""
echo "==================================================================="
echo "  Deployment Complete!"
echo "==================================================================="
echo ""

# Show status
echo "Deployment Status:"
kubectl get deployment agent-worker -n $NAMESPACE
echo ""

echo "HPA Status:"
kubectl get hpa agent-worker-hpa -n $NAMESPACE
echo ""

echo "PDB Status:"
kubectl get pdb agent-worker-pdb -n $NAMESPACE
echo ""

echo "Pods:"
kubectl get pods -n $NAMESPACE -l app=agent-worker
echo ""

echo "==================================================================="
echo "  Useful Commands"
echo "==================================================================="
echo ""
echo "Watch rollout:    kubectl rollout status deployment/agent-worker -n $NAMESPACE"
echo "View logs:        kubectl logs -f deployment/agent-worker -n $NAMESPACE"
echo "Health check:     kubectl exec -it deployment/agent-worker -n $NAMESPACE -- curl localhost:8080/health"
echo "Metrics:          kubectl exec -it deployment/agent-worker -n $NAMESPACE -- curl localhost:9090/metrics"
echo ""
