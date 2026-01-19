#!/bin/bash

POD=$(kubectl get pods -n agents -l app=agent-api -o jsonpath='{.items[0].metadata.name}')
echo "Diagnosing pod: $POD"
echo ""

echo "1. Check running processes:"
kubectl exec -n agents $POD -- ps aux | head -20
echo ""

echo "2. Check Python process:"
kubectl exec -n agents $POD -- ps aux | grep python
echo ""

echo "3. Check if main.py exists and has documents import:"
kubectl exec -n agents $POD -- grep -n "documents" /app/app/main.py || echo "No documents import found"
echo ""

echo "4. Check if documents.py exists:"
kubectl exec -n agents $POD -- ls -la /app/app/routes/documents.py || echo "documents.py not found"
echo ""

echo "5. Check if document_generation module exists:"
kubectl exec -n agents $POD -- ls -la /app/app/document_generation/ || echo "document_generation module not found"
echo ""

echo "6. Try importing the module:"
kubectl exec -n agents $POD -- python -c "from app.routes import documents; print('✓ Import successful')" || echo "✗ Import failed"
echo ""

echo "7. Get actual FastAPI routes:"
kubectl exec -n agents $POD -- python -c "
from app.main import app
print('Registered routes:')
for route in app.routes:
    if hasattr(route, 'path'):
        print(f'  {route.methods if hasattr(route, \"methods\") else \"GET\"} {route.path}')
" 2>&1 | head -30
