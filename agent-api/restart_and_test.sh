#!/bin/bash
set -e

echo "==========================================="
echo "Restarting Deployments with Fresh Image"
echo "==========================================="
echo ""

# Restart API deployment
echo "1. Restarting API deployment..."
kubectl rollout restart deployment/agent-api -n agents

# Restart worker deployment
echo "2. Restarting worker deployment..."
kubectl rollout restart deployment/agent-worker -n agents

echo ""
echo "3. Waiting for API rollout..."
kubectl rollout status deployment/agent-api -n agents --timeout=5m

echo ""
echo "4. Waiting for worker rollout..."
kubectl rollout status deployment/agent-worker -n agents --timeout=5m

echo ""
echo "5. Checking pod status..."
kubectl get pods -n agents

echo ""
echo "==========================================="
echo "Testing Phase 4 Document Generation"
echo "==========================================="
echo ""

# Wait a bit for pods to fully start
sleep 5

# Get pod name
POD=$(kubectl get pods -n agents -l app=agent-api -o jsonpath='{.items[0].metadata.name}')
echo "Using pod: $POD"
echo ""

# Start port-forward in background
echo "Starting port-forward..."
kubectl port-forward -n agents pod/$POD 8000:8000 > /dev/null 2>&1 &
PF_PID=$!

# Wait for port-forward
sleep 3

echo "✓ Port-forward established"
echo ""

echo "Test 1: Health endpoint"
echo "------------------------"
curl -s http://localhost:8000/health | python3 -m json.tool
echo ""

echo "Test 2: Supported formats"
echo "------------------------"
curl -s http://localhost:8000/api/documents/formats | python3 -m json.tool
echo ""

echo "Test 3: Generate Markdown document"
echo "------------------------"
curl -s -X POST http://localhost:8000/api/documents/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Phase 4 Verification",
    "format": "markdown",
    "sections": [
      {"heading": "Introduction", "type": "text", "content": "This document verifies Phase 4 deployment."},
      {"heading": "Features", "type": "bullet_list", "items": ["DOCX support", "PPTX support", "XLSX support", "PDF support", "Markdown support"]}
    ]
  }' | python3 -m json.tool
echo ""

echo "Test 4: Generate DOCX document"
echo "------------------------"
curl -s -X POST http://localhost:8000/api/documents/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Phase 4 DOCX Test",
    "format": "docx",
    "sections": [
      {"heading": "Test Section", "type": "text", "content": "Hello from Phase 4!"},
      {"heading": "Data Table", "type": "table", "headers": ["Format", "Status"], "rows": [["DOCX", "Working"], ["PPTX", "Working"], ["XLSX", "Working"], ["PDF", "Working"], ["Markdown", "Working"]]}
    ]
  }' | python3 -m json.tool
echo ""

echo "Test 5: Generate PDF document"
echo "------------------------"
curl -s -X POST http://localhost:8000/api/documents/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Phase 4 PDF Test",
    "format": "pdf",
    "sections": [
      {"heading": "Test Section", "type": "text", "content": "PDF generation test"}
    ]
  }' | python3 -m json.tool
echo ""

# Cleanup
kill $PF_PID 2>/dev/null
echo "Port-forward closed"
echo ""

echo "==========================================="
echo "✓ Phase 4 Testing Complete"
echo "==========================================="
