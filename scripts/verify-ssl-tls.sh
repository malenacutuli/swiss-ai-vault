#!/bin/bash
# Verify SSL/TLS Certificate Deployment Status

set -e

echo "╔══════════════════════════════════════════════════════════════╗"
echo "║     SwissBrain.ai SSL/TLS Verification                      ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""

# Check cert-manager
echo "1️⃣  Checking cert-manager installation..."
if kubectl get deployment -n cert-manager cert-manager &> /dev/null; then
  echo "✅ cert-manager is installed"
  kubectl get pods -n cert-manager
else
  echo "❌ cert-manager is not installed"
  exit 1
fi

echo ""

# Check ClusterIssuer
echo "2️⃣  Checking ClusterIssuer..."
if kubectl get clusterissuer letsencrypt-prod &> /dev/null; then
  echo "✅ ClusterIssuer exists"
  kubectl get clusterissuer letsencrypt-prod
else
  echo "❌ ClusterIssuer not found"
  exit 1
fi

echo ""

# Check Certificate
echo "3️⃣  Checking Certificate..."
if kubectl get certificate swissbrain-tls-secret -n swissbrain &> /dev/null; then
  echo "✅ Certificate exists"
  kubectl get certificate swissbrain-tls-secret -n swissbrain
  echo ""
  echo "Certificate details:"
  kubectl describe certificate swissbrain-tls-secret -n swissbrain | grep -A 10 "Status:"
else
  echo "❌ Certificate not found"
  exit 1
fi

echo ""

# Check TLS Secret
echo "4️⃣  Checking TLS Secret..."
if kubectl get secret swissbrain-tls-secret -n swissbrain &> /dev/null; then
  echo "✅ TLS Secret exists"
  kubectl get secret swissbrain-tls-secret -n swissbrain
else
  echo "❌ TLS Secret not found"
  exit 1
fi

echo ""

# Check Ingress
echo "5️⃣  Checking Ingress..."
if kubectl get ingress swissbrain-ingress -n swissbrain &> /dev/null; then
  echo "✅ Ingress exists"
  kubectl get ingress swissbrain-ingress -n swissbrain
  echo ""
  echo "Ingress details:"
  kubectl describe ingress swissbrain-ingress -n swissbrain | grep -A 5 "TLS:"
else
  echo "❌ Ingress not found"
  exit 1
fi

echo ""

# Test HTTPS endpoint
echo "6️⃣  Testing HTTPS endpoint..."
echo ""

# Check HTTP redirect
echo "Testing HTTP → HTTPS redirect..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://api.swissbrain.ai/health)
echo "HTTP response code: $HTTP_CODE"

if [ "$HTTP_CODE" = "308" ] || [ "$HTTP_CODE" = "301" ]; then
  echo "✅ HTTP redirects to HTTPS"
else
  echo "⚠️  Unexpected HTTP response code: $HTTP_CODE"
fi

echo ""

# Check HTTPS
echo "Testing HTTPS endpoint..."
if curl -f -s https://api.swissbrain.ai/health > /dev/null 2>&1; then
  echo "✅ HTTPS endpoint is accessible"
  echo ""
  echo "Certificate information:"
  echo | openssl s_client -servername api.swissbrain.ai -connect api.swissbrain.ai:443 2>/dev/null | openssl x509 -noout -subject -issuer -dates
else
  echo "❌ HTTPS endpoint is not accessible"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║         ✅ SSL/TLS Verification Complete!                    ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo ""
