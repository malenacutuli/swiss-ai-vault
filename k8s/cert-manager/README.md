# SSL/TLS Certificate Management

This directory contains configuration for SSL/TLS certificates using cert-manager and Let's Encrypt.

## Overview

- **cert-manager version**: v1.14.0
- **Certificate Authority**: Let's Encrypt (Production)
- **Challenge Type**: HTTP-01
- **Domain**: api.swissbrain.ai
- **Ingress Controller**: nginx

## Files

- `cluster-issuer.yaml` - Let's Encrypt ClusterIssuer configuration
- `README.md` - This file

## Quick Start

### Deploy SSL/TLS Certificates

```bash
# From project root
./scripts/deploy-ssl-tls.sh
```

### Verify Deployment

```bash
./scripts/verify-ssl-tls.sh
```

### Manual Verification

```bash
# Check cert-manager pods
kubectl get pods -n cert-manager

# Check ClusterIssuer
kubectl get clusterissuer

# Check certificate status
kubectl get certificate -n swissbrain
kubectl describe certificate swissbrain-tls-secret -n swissbrain

# Test HTTPS endpoint
curl https://api.swissbrain.ai/health
```

## Certificate Lifecycle

### Automatic Renewal

cert-manager automatically renews certificates 30 days before expiration. Let's Encrypt certificates are valid for 90 days.

### Manual Renewal

```bash
# Delete the certificate (will trigger automatic recreation)
kubectl delete certificate swissbrain-tls-secret -n swissbrain

# Certificate will be automatically recreated
kubectl get certificate -n swissbrain -w
```

### Force Certificate Reissuance

```bash
# Delete both certificate and secret
kubectl delete certificate swissbrain-tls-secret -n swissbrain
kubectl delete secret swissbrain-tls-secret -n swissbrain

# Wait for automatic recreation
kubectl get certificate -n swissbrain -w
```

## Troubleshooting

### Certificate Not Ready

```bash
# Check certificate status
kubectl describe certificate swissbrain-tls-secret -n swissbrain

# Check cert-manager logs
kubectl logs -n cert-manager -l app=cert-manager

# Check certificate request
kubectl get certificaterequest -n swissbrain
kubectl describe certificaterequest -n swissbrain
```

### ACME Challenge Failing

```bash
# Check challenge status
kubectl get challenge -n swissbrain
kubectl describe challenge -n swissbrain

# Common issues:
# 1. Ingress not accessible from internet
# 2. DNS not pointing to correct IP (185.19.28.196)
# 3. Ingress controller not configured correctly
```

### DNS Verification

```bash
# Verify DNS points to LoadBalancer IP
dig api.swissbrain.ai +short
# Should return: 185.19.28.196

# Check from external DNS
nslookup api.swissbrain.ai 8.8.8.8
```

### Certificate Details

```bash
# View certificate details
kubectl get secret swissbrain-tls-secret -n swissbrain -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -text -noout

# Check certificate expiration
kubectl get secret swissbrain-tls-secret -n swissbrain -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -dates
```

## Configuration Details

### ClusterIssuer Specification

```yaml
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@swissbrain.ai
    privateKeySecretRef:
      name: letsencrypt-prod-account-key
    solvers:
    - http01:
        ingress:
          class: nginx
```

### Ingress TLS Configuration

```yaml
tls:
- hosts:
  - api.swissbrain.ai
  secretName: swissbrain-tls-secret
```

### Ingress Annotations

```yaml
annotations:
  cert-manager.io/cluster-issuer: letsencrypt-prod  # Triggers cert-manager
  nginx.ingress.kubernetes.io/ssl-redirect: "true"  # Force HTTPS
```

## Security Best Practices

1. **Use Production Let's Encrypt**: Already configured (not staging)
2. **Force HTTPS**: Enabled via `ssl-redirect: "true"`
3. **Strong TLS Configuration**: Handled by nginx ingress controller
4. **Certificate Monitoring**: cert-manager handles automatic renewal
5. **Rate Limits**: Let's Encrypt has rate limits (50 certificates per domain per week)

## Monitoring

### Certificate Expiration

Set up monitoring alerts for certificate expiration:

```bash
# Get certificate expiration date
kubectl get secret swissbrain-tls-secret -n swissbrain -o jsonpath='{.data.tls\.crt}' | base64 -d | openssl x509 -noout -enddate
```

### cert-manager Metrics

cert-manager exposes Prometheus metrics on port 9402:

- `certmanager_certificate_expiration_timestamp_seconds` - Certificate expiration
- `certmanager_certificate_ready_status` - Certificate ready status

## Adding Additional Domains

To add more domains (e.g., `*.swissbrain.ai`):

1. Update `swissbrain-ingress-tls.yaml`:

```yaml
tls:
- hosts:
  - api.swissbrain.ai
  - app.swissbrain.ai
  - '*.swissbrain.ai'  # Requires DNS-01 challenge
  secretName: swissbrain-tls-secret
```

2. For wildcard certificates, update ClusterIssuer to use DNS-01:

```yaml
solvers:
- dns01:
    cloudflare:  # or other DNS provider
      apiTokenSecretRef:
        name: cloudflare-api-token
        key: api-token
```

## References

- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Let's Encrypt](https://letsencrypt.org/)
- [nginx Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
