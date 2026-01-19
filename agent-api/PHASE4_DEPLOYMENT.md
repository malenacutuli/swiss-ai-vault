# Phase 4 Deployment Guide

## 🎯 What's Being Deployed

**Phase 4: Multi-Format Document Generation**

### New Capabilities

1. **Document Generation**
   - DOCX (Microsoft Word)
   - PPTX (Microsoft PowerPoint)
   - XLSX (Microsoft Excel)
   - PDF (Portable Document Format)
   - Markdown (Plain text markup)

2. **Content Types**
   - Text paragraphs
   - Bullet lists
   - Numbered lists
   - Tables with headers
   - Code blocks

3. **REST API**
   - Generate documents via API
   - Download generated documents
   - List supported formats
   - Cleanup temporary files

---

## 📦 What Was Built

### Docker Image
- **Tag**: `docker.io/axessvideo/agent-api:v11-phase4`
- **Base**: v10-phase3 (Phase 3 with E2B sandboxes)
- **New Dependencies**:
  - python-docx==0.8.11
  - python-pptx==0.6.21
  - openpyxl>=3.1.0
  - reportlab==4.0.0
  - markdown==3.4.0
  - Pillow==10.0.0

### New Files (10 modules, 2 test suites)

**Core Module (`app/document_generation/`):**
1. `base.py` - Abstract base class and models
2. `docx_generator.py` - Word document generator
3. `pptx_generator.py` - PowerPoint generator
4. `xlsx_generator.py` - Excel generator
5. `pdf_generator.py` - PDF generator
6. `markdown_generator.py` - Markdown generator
7. `router.py` - Format routing

**API Route:**
8. `app/routes/documents.py` - REST endpoints

**Tests:**
9. `tests/test_document_generation.py` - Unit tests
10. `tests/test_document_api.py` - Integration tests

### Modified Files
- `requirements.txt` - Added document generation dependencies
- `app/main.py` - Registered documents router

---

## 🚀 Deployment Steps

### Step 1: Build Docker Image

```bash
cd /Users/malena/swiss-ai-vault/agent-api

# Build for linux/amd64 platform
docker build --platform linux/amd64 \
  -t docker.io/axessvideo/agent-api:v11-phase4 .

# Push to Docker Hub
docker push docker.io/axessvideo/agent-api:v11-phase4
```

### Step 2: Update Kubernetes Manifests

**Update `k8s/deployment.yaml`:**

```yaml
# Line 34: Update image tag
image: docker.io/axessvideo/agent-api:v11-phase4  # Phase 4: Document generation
```

**Update `k8s/worker-deployment.yaml`:**

```yaml
# Line 38: Update image tag
image: docker.io/axessvideo/agent-api:v11-phase4  # Phase 4: Document generation
```

### Step 3: Deploy to Kubernetes

```bash
# Connect to your cluster (if not already connected)
kubectl cluster-info

# Verify namespace
kubectl get namespace agents

# Deploy API
kubectl apply -f k8s/deployment.yaml
kubectl rollout status deployment/agent-api -n agents

# Deploy Worker
kubectl apply -f k8s/worker-deployment.yaml
kubectl rollout status deployment/agent-worker -n agents

# Verify deployments
kubectl get deployments -n agents
kubectl get pods -n agents
```

---

## ✅ Verification

### 1. Check Deployment Status

```bash
kubectl get deployments -n agents
```

Expected:
```
NAME           READY   UP-TO-DATE   AVAILABLE   AGE
agent-api      3/3     3            3           Xm
agent-worker   1/1     1            1           Xm
```

### 2. Check Pods

```bash
kubectl get pods -n agents
```

All pods should show `Running` status with no restarts.

### 3. Check Logs

```bash
# API logs
kubectl logs -f -n agents -l app=agent-api --tail=50

# Worker logs
kubectl logs -f -n agents -l app=agent-worker --tail=50
```

Look for:
```
✓ Agent API started
✓ Redis connected
✓ No import errors for document_generation module
```

### 4. Test Health Endpoint

```bash
curl https://api.swissbrain.ai/health
```

Expected:
```json
{
  "status": "healthy",
  "version": "1.0.0",
  "service": "agent-api"
}
```

### 5. Test Supported Formats Endpoint

```bash
curl https://api.swissbrain.ai/api/documents/formats
```

Expected:
```json
{
  "formats": ["docx", "pptx", "xlsx", "pdf", "markdown"]
}
```

### 6. Test Document Generation

```bash
curl -X POST https://api.swissbrain.ai/api/documents/generate \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Phase 4 Verification",
    "format": "docx",
    "sections": [
      {
        "heading": "Test Section",
        "type": "text",
        "content": "This document verifies Phase 4 deployment."
      }
    ]
  }'
```

Expected response:
```json
{
  "success": true,
  "format": "docx",
  "filepath": "/tmp/documents/Phase_4_Verification.docx",
  "file_size": 12345,
  "metadata": {...},
  "message": "Document generated successfully: ..."
}
```

### 7. Test All Formats

```bash
# DOCX
curl -X POST https://api.swissbrain.ai/api/documents/generate \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","format":"docx","sections":[{"heading":"Test","type":"text","content":"Hello"}]}'

# PPTX
curl -X POST https://api.swissbrain.ai/api/documents/generate \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","format":"pptx","sections":[{"heading":"Test","type":"text","content":"Hello"}]}'

# XLSX
curl -X POST https://api.swissbrain.ai/api/documents/generate \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","format":"xlsx","sections":[{"heading":"Test","type":"text","content":"Hello"}]}'

# PDF
curl -X POST https://api.swissbrain.ai/api/documents/generate \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","format":"pdf","sections":[{"heading":"Test","type":"text","content":"Hello"}]}'

# Markdown
curl -X POST https://api.swissbrain.ai/api/documents/generate \
  -H "Content-Type: application/json" \
  -d '{"title":"Test","format":"markdown","sections":[{"heading":"Test","type":"text","content":"Hello"}]}'
```

---

## 🔍 Monitoring

### Check Active Pods

```bash
kubectl get pods -n agents -w
```

### Check Resource Usage

```bash
kubectl top pods -n agents
```

### Stream Logs

```bash
# All API pods
kubectl logs -f -n agents -l app=agent-api

# All worker pods
kubectl logs -f -n agents -l app=agent-worker
```

---

## 🚨 Troubleshooting

### Import Errors

If you see `ModuleNotFoundError: No module named 'docx'`:

```bash
# Check if dependencies are in requirements.txt
kubectl exec -it -n agents <pod-name> -- cat requirements.txt | grep docx

# Rebuild image with dependencies
docker build --platform linux/amd64 --no-cache \
  -t docker.io/axessvideo/agent-api:v11-phase4 .
docker push docker.io/axessvideo/agent-api:v11-phase4

# Restart deployment
kubectl rollout restart deployment/agent-api -n agents
```

### File Permission Issues

If document generation fails with permission errors:

```bash
# Check /tmp/documents directory permissions in pod
kubectl exec -it -n agents <pod-name> -- ls -la /tmp/documents

# The directory should be created automatically by the code
# If not, check securityContext in deployment.yaml
```

### API 500 Errors

```bash
# Check detailed logs
kubectl logs -n agents <pod-name> --tail=100

# Look for stack traces
kubectl logs -n agents -l app=agent-api | grep -A 20 "Traceback"
```

---

## 🔄 Rollback

If Phase 4 has issues, rollback to Phase 3:

```bash
# Rollback API
kubectl set image deployment/agent-api \
  agent-api=docker.io/axessvideo/agent-api:v10-phase3 \
  -n agents

# Rollback worker
kubectl set image deployment/agent-worker \
  worker=docker.io/axessvideo/agent-api:v10-phase3 \
  -n agents

# Or use rollout undo
kubectl rollout undo deployment/agent-api -n agents
kubectl rollout undo deployment/agent-worker -n agents
```

---

## 📊 Success Criteria

Phase 4 is successfully deployed when:

1. ✅ All pods are Running (not Pending/CrashLooping)
2. ✅ Health endpoint returns `{"status": "healthy"}`
3. ✅ `/api/documents/formats` returns all 5 formats
4. ✅ Document generation succeeds for all 5 formats
5. ✅ Generated files have non-zero size
6. ✅ Download endpoint works correctly
7. ✅ No import errors in logs
8. ✅ No pod restarts after deployment

---

## 📚 API Documentation

After deployment, documentation is available at:
- **Swagger UI**: https://api.swissbrain.ai/docs
- **ReDoc**: https://api.swissbrain.ai/redoc

Look for the "Document Generation" section with endpoints:
- `POST /api/documents/generate`
- `GET /api/documents/download/{format}/{filename}`
- `GET /api/documents/formats`
- `DELETE /api/documents/cleanup`

---

## 🎉 Next Steps

After successful deployment:

1. **Test from Frontend**: Integrate document generation into swiss-ai-vault frontend
2. **Monitor Usage**: Track document generation requests and formats used
3. **Cleanup Strategy**: Implement automatic cleanup of old files (> 24 hours)
4. **S3 Integration**: Consider storing generated documents in S3 instead of /tmp
5. **Rate Limiting**: Add rate limits to prevent abuse
6. **File Size Limits**: Add validation for very large documents

---

**Deployment Version**: v11-phase4
**Previous Version**: v10-phase3
**Feature**: Multi-Format Document Generation
**Status**: Ready for Deployment ✅
