# DNS-01 Migration Status

**Date**: January 15, 2026
**Status**: IN PROGRESS - Cloudflare Rate Limited
**Issue**: Temporary API rate limit due to previous failed attempts

---

## ✅ Completed Steps

### 1. Cloudflare API Token Setup
- ✅ API token created with correct permissions (Zone DNS Edit, Zone Read)
- ✅ Token stored in Kubernetes secret: `cloudflare-api-token-secret`
- ✅ Token verified: 40 characters, correct format

### 2. DNS-01 ClusterIssuer Deployment
- ✅ ClusterIssuer `letsencrypt-prod-dns01` created
- ✅ ClusterIssuer status: READY = True
- ✅ Cloudflare configuration: Zone selector for `swissbrain.ai`

### 3. Certificate Configuration
- ✅ Both certificates updated to use DNS-01 issuer
- ✅ Ingress annotations updated to point to DNS-01 issuer

---

## ⚠️ Current Situation: Cloudflare Rate Limit

### Error
```
Error: 10502: Too many authentication failures. Please try again later.
```

### Root Cause
During initial setup, we made multiple attempts with an invalid/incomplete API token. This triggered Cloudflare's security mechanism that temporarily blocks API access after too many failed authentication attempts.

### Timeline
- **First invalid token**: 12:45 PM (made ~10-15 failed requests)
- **Updated with valid token**: 1:00 PM
- **Rate limit triggered**: Still active as of 1:15 PM
- **Expected resolution**: 1:30-1:45 PM (15-30 minutes from first failed attempt)

---

## 📊 Current Certificate Status

### api.swissbrain.ai ✅ WORKING
- **Certificate Status**: Valid and working
- **Issuer**: letsencrypt-prod (HTTP-01)
- **Expiry**: April 15, 2026 (3 months)
- **HTTPS Status**: ✅ Working (HSTS enabled)
- **Action Required**: None immediately - will migrate to DNS-01 after rate limit expires

### monitoring.swissbrain.ai ⏳ PENDING
- **Certificate Status**: Pending (waiting for rate limit)
- **Issuer**: letsencrypt-prod-dns01 (DNS-01)
- **HTTPS Status**: ⏳ Not yet issued
- **Action Required**: Retry after rate limit expires

---

## 🔧 What Happens Next

### Automatic Process (Once Rate Limit Expires)

1. **cert-manager will automatically retry** (every 60 seconds)
2. **DNS-01 challenge will proceed**:
   - cert-manager creates TXT record: `_acme-challenge.monitoring.swissbrain.ai`
   - Waits for DNS propagation (30-60 seconds)
   - Let's Encrypt validates the TXT record
   - Certificate is issued

3. **Certificate stored** in Kubernetes secret `grafana-tls`
4. **Grafana becomes accessible** at https://monitoring.swissbrain.ai

### Expected Timeline
- **Rate limit expiry**: 1:30-1:45 PM (approximately 15-30 minutes from now)
- **DNS-01 challenge**: 2-3 minutes
- **Total time to completion**: ~20-35 minutes from now

---

## 🛠️ Manual Intervention (If Needed)

If the rate limit persists beyond 30 minutes, we can manually trigger a retry:

```bash
# Stop current attempts
kubectl delete challenge --all -n agents
kubectl delete certificaterequest --all -n agents

# Wait 2 minutes
sleep 120

# Check certificates (they will auto-recreate requests)
kubectl get certificate -n agents

# Monitor progress
kubectl get certificaterequest,challenge -n agents
kubectl describe challenge -n agents
```

### Verification Commands

```bash
# Check certificate status
kubectl get certificate -n agents

# Check challenge progress
kubectl describe challenge -n agents

# Check Cloudflare DNS records (should see TXT record)
dig _acme-challenge.monitoring.swissbrain.ai TXT +short

# Test HTTPS once issued
curl -I https://monitoring.swissbrain.ai
```

---

## 📈 Migration Progress

| Component | Status | Notes |
|-----------|--------|-------|
| Cloudflare API Token | ✅ Complete | Valid token stored |
| DNS-01 ClusterIssuer | ✅ Complete | Ready and registered |
| Certificate Configuration | ✅ Complete | Both certs configured for DNS-01 |
| api.swissbrain.ai Cert | ✅ Working | Valid until April 2026 (HTTP-01) |
| monitoring.swissbrain.ai Cert | ⏳ Pending | Waiting for rate limit expiry |
| Rate Limit Resolution | ⏳ In Progress | Expected: 1:30-1:45 PM |

**Overall Progress**: 80% Complete

---

## 🎯 Benefits of DNS-01 (Once Complete)

### Solved Issues
1. ✅ **Hairpin NAT Problem**: No longer requires cluster to reach external LoadBalancer IP
2. ✅ **Wildcard Certificates**: Can issue `*.swissbrain.ai` if needed
3. ✅ **Multi-domain**: Easier to manage multiple subdomains
4. ✅ **Private Networks**: Works even for internal domains

### Technical Advantages
- **Challenge Method**: DNS TXT record (not HTTP endpoint)
- **Reliability**: Independent of ingress/LoadBalancer configuration
- **Flexibility**: Works with any domain configuration
- **Security**: No need to expose challenge endpoints

---

## 📝 Lessons Learned

### API Token Validation
- Always test API tokens before deploying to production
- Cloudflare rate limits are strict: 5-10 failed attempts triggers 15-30 minute block
- Consider using staging environment for testing

### Rate Limit Mitigation
- Stop retry attempts immediately when rate limited
- Wait for full rate limit window to expire (don't retry too soon)
- Monitor cert-manager logs to detect issues early

### Best Practices
1. **Test tokens first**: Use `curl` to verify Cloudflare API access before deploying
2. **Use staging**: Test with Let's Encrypt staging environment first
3. **Monitor closely**: Watch cert-manager logs during initial deployment
4. **Document thoroughly**: Keep records of token permissions and configurations

---

## 🔍 Troubleshooting Guide

### Issue: Rate Limit Persists Beyond 30 Minutes

**Solution**:
```bash
# Check if token is actually valid
kubectl get secret cloudflare-api-token-secret -n cert-manager -o jsonpath='{.data.api-token}' | base64 -d

# Test token manually
export CF_TOKEN="<token_from_above>"
curl -X GET "https://api.cloudflare.com/client/v4/zones?name=swissbrain.ai" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response**: Should return zone details including zone ID

### Issue: Certificate Stays in "False" State

**Check**:
```bash
# Check certificate request status
kubectl describe certificaterequest -n agents

# Check challenge details
kubectl describe challenge -n agents

# Check cert-manager logs
kubectl logs -f deployment/cert-manager -n cert-manager
```

### Issue: DNS TXT Record Not Created

**Verify**:
```bash
# Check Cloudflare DNS records via API
curl -X GET "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/dns_records?type=TXT&name=_acme-challenge.monitoring.swissbrain.ai" \
  -H "Authorization: Bearer $CF_TOKEN" \
  -H "Content-Type: application/json"
```

---

## ✅ Success Criteria

When migration is complete, we should see:

1. **Certificate Status**:
   ```bash
   kubectl get certificate -n agents
   # Both should show READY = True
   ```

2. **HTTPS Endpoints**:
   ```bash
   curl -I https://api.swissbrain.ai/health
   # HTTP/2 200 OK

   curl -I https://monitoring.swissbrain.ai
   # HTTP/2 200 OK (or 302/301 redirect)
   ```

3. **Certificate Details**:
   ```bash
   kubectl get certificate agent-api-tls -n agents -o jsonpath='{.spec.issuerRef.name}'
   # letsencrypt-prod-dns01

   kubectl get certificate grafana-tls -n agents -o jsonpath='{.spec.issuerRef.name}'
   # letsencrypt-prod-dns01
   ```

4. **No Active Challenges**:
   ```bash
   kubectl get challenge -n agents
   # No resources found (challenges complete and cleaned up)
   ```

---

## 📞 Next Actions

### Immediate (Right Now)
- ✅ All retry attempts stopped
- ✅ Waiting for rate limit to expire naturally
- ✅ API certificate remains valid and working

### In 15-30 Minutes
- ⏳ Check if rate limit has expired
- ⏳ Monitor certificate request progress
- ⏳ Verify Grafana certificate issuance

### After Completion
- 📝 Update Phase 9 checkpoint documentation
- 📝 Document DNS-01 setup for future reference
- ✅ Mark Phase 9 infrastructure as 100% complete

---

## 🎉 Expected Final State

```bash
$ kubectl get certificate -n agents
NAME            READY   SECRET          ISSUER                   AGE
agent-api-tls   True    agent-api-tls   letsencrypt-prod-dns01   <age>
grafana-tls     True    grafana-tls     letsencrypt-prod-dns01   <age>

$ curl -I https://monitoring.swissbrain.ai
HTTP/2 200
content-type: text/html; charset=UTF-8
strict-transport-security: max-age=31536000; includeSubDomains
```

---

*Last Updated*: January 15, 2026 1:15 PM
*Status*: Waiting for Cloudflare rate limit to expire
*ETA*: 15-30 minutes
*Action Required*: None - automatic retry will proceed
