# Morning Certificate Status Check

**Created**: January 15, 2026 (Evening)
**Check Date**: January 16, 2026 (Morning)
**Status**: Waiting for Cloudflare rate limit to expire overnight

---

## 📋 Quick Status Check Commands

### 1. Check Certificate Status
```bash
kubectl get certificate -n agents
```

**Expected Result** (if rate limit expired):
```
NAME            READY   SECRET          AGE
agent-api-tls   True    agent-api-tls   <age>
grafana-tls     True    grafana-tls     <age>
```

### 2. Verify HTTPS Endpoints
```bash
# API (should already be working)
curl -I https://api.swissbrain.ai/health

# Grafana (should work after certificate issued)
curl -I https://monitoring.swissbrain.ai
```

### 3. Check Challenge Status
```bash
kubectl get challenge -n agents
```

**Expected Result**: `No resources found` (challenges complete and cleaned up)

### 4. Check for Any Errors
```bash
kubectl describe certificate grafana-tls -n agents | tail -20
```

---

## ✅ Success Criteria

When you see these, everything is working:

1. **Both certificates show READY = True**
2. **No active challenges**
3. **HTTPS endpoints return 200 or 302 (not connection errors)**
4. **No rate limit errors in challenge events**

---

## ⚠️ If Rate Limit Still Active

If you still see errors like:
```
Error: 10502: Too many authentication failures
Error: 971: Please wait and consider throttling your request speed
```

**Actions**:
1. **Wait a few more hours** - Cloudflare rate limits can last 24 hours in severe cases
2. **Stop retry attempts**:
   ```bash
   kubectl delete challenge --all -n agents
   kubectl delete certificaterequest --all -n agents
   ```
3. **Check back in the afternoon**

---

## 🔧 If You Need Manual Intervention

### Test Cloudflare API Token
```bash
# Extract token
TOKEN=$(kubectl get secret cloudflare-api-token-secret -n cert-manager -o jsonpath='{.data.api-token}' | base64 -d)

# Test API access
curl -X GET "https://api.cloudflare.com/client/v4/zones?name=swissbrain.ai" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response**: Should return zone details with `"success": true`

### Manually Trigger Certificate Issuance
```bash
# Delete certificate requests to trigger fresh attempts
kubectl delete certificaterequest --all -n agents

# Wait 10 seconds
sleep 10

# Check status
kubectl get certificate,certificaterequest,challenge -n agents
```

### Access Grafana Without HTTPS (Temporary)
```bash
# Port-forward to access locally
kubectl port-forward -n agents svc/grafana 3000:3000

# Access in browser
open http://localhost:3000

# Get admin password
kubectl get secret grafana-secrets -n agents -o jsonpath='{.data.admin-password}' | base64 -d
```

---

## 📊 Current Infrastructure Status

### Working ✅
- **Phase 9 Infrastructure**: 100% deployed
- **API Certificate**: Valid until April 15, 2026
- **API HTTPS**: https://api.swissbrain.ai (working)
- **All Pods**: 8/8 running (3 API, 2 worker, 1 Prometheus, 1 Grafana, 1 solver)
- **HPA**: Active (auto-scaling enabled)
- **PDB**: Active (high availability enforced)
- **Prometheus**: Collecting metrics
- **Grafana**: Running (accessible via port-forward)

### Pending ⏳
- **Grafana Certificate**: Waiting for Cloudflare rate limit to expire
- **Grafana HTTPS**: Will be available after certificate issued

---

## 🎯 What Will Happen Automatically

Once the Cloudflare rate limit expires:

1. **cert-manager retries** automatically (every 60 seconds)
2. **DNS-01 challenge proceeds**:
   - Creates TXT record: `_acme-challenge.monitoring.swissbrain.ai`
   - Let's Encrypt validates the record
   - Certificate is issued
3. **Grafana becomes accessible** at https://monitoring.swissbrain.ai
4. **Total time**: 2-3 minutes after rate limit expires

**No manual intervention required** - the system will self-heal.

---

## 📝 Documentation Files

All relevant documentation is available:

1. **Phase 9 Deployment Status**: `PHASE9_DEPLOYMENT_STATUS.md`
2. **Phase 9 Checkpoint**: `PHASE9_CHECKPOINT.md`
3. **DNS-01 Migration Status**: `DNS01_MIGRATION_STATUS.md`
4. **SSL Certificate Fix**: `SSL_CERTIFICATE_FIX_SUMMARY.md`
5. **This File**: `MORNING_CERTIFICATE_CHECK.md`

---

## 🔄 Next Steps After Certificates Are Issued

### Immediate
1. ✅ Verify both certificates show READY = True
2. ✅ Test HTTPS endpoints (both should work)
3. ✅ Access Grafana dashboard
4. ✅ Import Grafana dashboards for agent metrics

### Short Term
- Configure Grafana alert notifications
- Set up Prometheus AlertManager
- Test HPA scaling under load
- Document Phase 9 completion

### Long Term (Remaining Phase 9 Modules)
- Module 4: Database backup documentation
- Module 6: Analytics system implementation
- Module 7: Email service integration (Resend)
- Module 8: Stripe payment processing
- Module 9: REST API documentation

---

## 📞 Quick Reference

### Cluster Access
```bash
# View all Phase 9 resources
kubectl get all,certificate,ingress,hpa,pdb -n agents

# View monitoring stack
kubectl get pods,svc -n agents | grep -E "(prometheus|grafana)"

# View certificates
kubectl get certificate,clusterissuer -A
```

### Grafana Access
- **HTTPS URL**: https://monitoring.swissbrain.ai (after cert issued)
- **Port-forward**: `kubectl port-forward -n agents svc/grafana 3000:3000`
- **Username**: `admin`
- **Password**: `kubectl get secret grafana-secrets -n agents -o jsonpath='{.data.admin-password}' | base64 -d`

### Prometheus Access
- **Internal URL**: http://prometheus.agents.svc.cluster.local:9090
- **Port-forward**: `kubectl port-forward -n agents svc/prometheus 9090:9090`
- **Targets**: http://localhost:9090/targets (after port-forward)

---

## ✨ Summary

Everything is configured correctly. The only thing preventing the Grafana certificate from being issued is a **temporary Cloudflare API rate limit** that should expire overnight.

**Morning Action**:
1. Run: `kubectl get certificate -n agents`
2. If both show `READY = True` → ✅ Success!
3. If still `False` → Check this guide for troubleshooting

**No action required during the night** - cert-manager will handle everything automatically once the rate limit expires.

---

*Prepared*: January 15, 2026 Evening
*For Review*: January 16, 2026 Morning
*Expected Status*: ✅ All certificates issued and working
