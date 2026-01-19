#!/bin/bash
set -e

echo "Deploying Phase 4 PDF Fix"
echo ""

kubectl rollout restart deployment/agent-api -n agents
kubectl rollout restart deployment/agent-worker -n agents

echo "Waiting for rollout..."
kubectl rollout status deployment/agent-api -n agents --timeout=5m

echo ""
echo "Testing PDF generation..."
sleep 5

POD=$(kubectl get pods -n agents -l app=agent-api -o jsonpath='{.items[0].metadata.name}')
kubectl port-forward -n agents pod/$POD 8000:8000 > /dev/null 2>&1 &
PF_PID=$!
sleep 3

curl -s -X POST http://localhost:8000/api/documents/generate \
  -H "Content-Type: application/json" \
  -d '{"title":"PDF Test","format":"pdf","sections":[{"heading":"Test","type":"text","content":"PDF fixed!"}]}' | python3 -m json.tool

kill $PF_PID 2>/dev/null
echo ""
echo "✓ Phase 4 PDF fix deployed"
