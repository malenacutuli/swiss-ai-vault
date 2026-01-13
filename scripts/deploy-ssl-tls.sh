#!/bin/bash
# SwissBrain.ai SSL/TLS Certificate Deployment
# Deploys cert-manager and configures Let's Encrypt TLS certificates

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     SwissBrain.ai SSL/TLS Certificate Deployment            ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Step 1: Install cert-manager v1.14.0
echo "📦 Step 1/7: Installing cert-manager v1.14.0..."
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.14.0/cert-manager.yaml

echo "⏳ Waiting for cert-manager installation to complete..."
sleep 10

# Step 2: Wait for cert-manager pods to be ready
echo ""
echo "⏳ Step 2/7: Waiting for cert-manager pods to be ready..."
kubectl wait --for=condition=ready pod \
  -l app.kubernetes.io/instance=cert-manager \
  -n cert-manager \
  --timeout=120s

echo "✅ cert-manager pods are ready"

# Step 3: Apply ClusterIssuer
echo ""
echo "🔐 Step 3/7: Creating Let's Encrypt ClusterIssuer..."
kubectl apply -f k8s/cert-manager/cluster-issuer.yaml

# Wait for ClusterIssuer to be ready
echo "⏳ Waiting for ClusterIssuer to be ready..."
sleep 5

# Step 4: Check if namespace exists
echo ""
echo "🔍 Step 4/7: Verifying swissbrain namespace..."
if ! kubectl get namespace swissbrain &> /dev/null; then
  echo "Creating swissbrain namespace..."
  kubectl create namespace swissbrain
else
  echo "✅ Namespace swissbrain exists"
fi

# Step 5: Apply TLS-enabled ingress
echo ""
echo "🌐 Step 5/7: Deploying TLS-enabled ingress..."
kubectl apply -f k8s/ingress/swissbrain-ingress-tls.yaml

echo "⏳ Waiting for certificate to be requested..."
sleep 10

# Step 6: Verify certificate
echo ""
echo "🔍 Step 6/7: Verifying certificate status..."
echo ""
kubectl get certificate -n swissbrain
echo ""
echo "Certificate details:"
kubectl describe certificate swissbrain-tls-secret -n swissbrain | grep -A 5 "Status:"

# Step 7: Test HTTPS endpoint
echo ""
echo "🧪 Step 7/7: Testing HTTPS endpoint..."
echo ""

# Wait a bit more for DNS and certificate propagation
echo "⏳ Waiting 30 seconds for certificate propagation..."
sleep 30

# Test HTTP redirect to HTTPS
echo "Testing HTTP redirect to HTTPS..."
HTTP_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -L http://api.swissbrain.ai/health)
echo "HTTP Response Code: $HTTP_RESPONSE"

# Test HTTPS endpoint
echo ""
echo "Testing HTTPS endpoint..."
if curl -f -s https://api.swissbrain.ai/health > /dev/null 2>&1; then
  echo "✅ HTTPS endpoint is working!"
  echo ""
  curl -v https://api.swissbrain.ai/health 2>&1 | grep -E "SSL|TLS|Server certificate"
else
  echo "⚠️  HTTPS endpoint not yet available (certificate may still be provisioning)"
  echo "   Run this command to check certificate status:"
  echo "   kubectl describe certificate swissbrain-tls-secret -n swissbrain"
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║              SSL/TLS Deployment Complete!                   ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "1. Verify certificate is Ready: kubectl get certificate -n swissbrain"
echo "2. Test HTTPS: curl https://api.swissbrain.ai/health"
echo "3. Check ingress: kubectl get ingress -n swissbrain"
echo ""
