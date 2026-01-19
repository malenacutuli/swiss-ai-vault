#!/bin/bash

echo "Testing Phase 4 via direct port-forward..."
echo ""

# Get pod name
POD=$(kubectl get pods -n agents -l app=agent-api -o jsonpath='{.items[0].metadata.name}')
echo "Using pod: $POD"
echo ""

# Start port-forward in background
kubectl port-forward -n agents pod/$POD 8000:8000 > /dev/null 2>&1 &
PF_PID=$!

# Wait for port-forward
sleep 2

echo "1. Testing health endpoint..."
curl -s http://localhost:8000/health | python3 -m json.tool
echo ""

echo "2. Testing document formats endpoint..."
curl -s http://localhost:8000/api/documents/formats | python3 -m json.tool
echo ""

echo "3. Generating Markdown document..."
curl -s -X POST http://localhost:8000/api/documents/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Phase 4 Test",
    "format": "markdown",
    "sections": [
      {"heading": "Test Section", "type": "text", "content": "Hello from Phase 4!"}
    ]
  }' | python3 -m json.tool
echo ""

echo "4. Generating DOCX document..."
curl -s -X POST http://localhost:8000/api/documents/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Phase 4 DOCX Test",
    "format": "docx",
    "sections": [
      {"heading": "Introduction", "type": "text", "content": "This is a test DOCX."},
      {"heading": "Features", "type": "bullet_list", "items": ["Multi-format", "REST API", "Production ready"]}
    ]
  }' | python3 -m json.tool

# Cleanup
kill $PF_PID 2>/dev/null
echo ""
echo "Port-forward closed"
