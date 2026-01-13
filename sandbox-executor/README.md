# Sandbox Executor Service

This directory contains the Dockerfile and configuration for the Sandbox Executor service, which provides secure code execution capabilities for SwissBrain AI agents.

## Overview

The Sandbox Executor is a backend service that:
- Executes user code in isolated containers
- Enforces resource limits (CPU, memory, time)
- Provides secure filesystem and network isolation
- Supports multiple programming languages and runtimes
- Integrates with gVisor for enhanced security

## Security Features

- **gVisor Runtime**: User-space kernel for additional isolation
- **Non-root User**: Runs as unprivileged user (UID 1000)
- **Resource Limits**: Enforced via Kubernetes and cgroups
- **Network Isolation**: Controlled network access
- **Read-only Root Filesystem**: Prevents tampering
- **Seccomp Profiles**: Restricts dangerous syscalls

## Docker Build

Build the image locally:

```bash
docker build -t sandbox-executor:latest .
```

Build with build arguments:

```bash
docker build \
  --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
  --build-arg VCS_REF=$(git rev-parse --short HEAD) \
  --build-arg VERSION=1.0.0 \
  -t sandbox-executor:latest \
  .
```

## Configuration

### Environment Variables

Configure the service using environment variables:

```bash
# Server configuration
PORT=8000
HOST=0.0.0.0

# Resource limits (overridden by Kubernetes)
MAX_MEMORY=2Gi
MAX_CPU=1000m
MAX_EXECUTION_TIME=300s

# Security
ENABLE_NETWORK=false
ALLOWED_DOMAINS=github.com,npmjs.com

# Supabase connection (if needed)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

### Kubernetes Deployment

The service is deployed to Swiss K8s cluster using the manifests in `/k8s/deployments/`.

Example deployment:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: sandbox-executor
  namespace: swissbrain
spec:
  replicas: 3
  selector:
    matchLabels:
      app: sandbox-executor
  template:
    metadata:
      labels:
        app: sandbox-executor
    spec:
      runtimeClassName: gvisor  # Use gVisor runtime
      containers:
      - name: sandbox-executor
        image: ghcr.io/malenacutuli/swiss-ai-vault/sandbox-executor:latest
        ports:
        - containerPort: 8000
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "2Gi"
            cpu: "1000m"
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          readOnlyRootFilesystem: true
          allowPrivilegeEscalation: false
          capabilities:
            drop:
            - ALL
        livenessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 10
          periodSeconds: 30
        readinessProbe:
          httpGet:
            path: /health
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 10
```

## Development

### Local Development

Run locally with Docker:

```bash
docker run -p 8000:8000 sandbox-executor:latest
```

Run with volume mounts for development:

```bash
docker run -p 8000:8000 \
  -v $(pwd)/src:/app/src \
  -e DEBUG=true \
  sandbox-executor:latest
```

### Testing

Test the health endpoint:

```bash
curl http://localhost:8000/health
```

### Customization

To use this Dockerfile for your actual service:

1. **Replace the base image** if needed (e.g., `node:20-alpine` for Node.js)
2. **Add dependencies** by uncommenting and customizing the requirements/package installation
3. **Copy your source code** by uncommenting the COPY commands
4. **Update the CMD** with your actual service start command
5. **Configure environment variables** as needed

Example for a Python FastAPI service:

```dockerfile
# Install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY --chown=sandbox:sandbox . .

# Start FastAPI with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

Example for a Node.js Express service:

```dockerfile
# Install dependencies
COPY package*.json ./
RUN npm ci --only=production

# Copy source code
COPY --chown=sandbox:sandbox . .

# Start Node.js server
CMD ["node", "server.js"]
```

## Security Considerations

1. **Never run as root**: Always use a non-root user
2. **Read-only filesystem**: Mount writable volumes only where necessary
3. **Minimal base image**: Use slim or alpine variants when possible
4. **No secrets in image**: Pass secrets via environment variables or Kubernetes secrets
5. **Security scanning**: Images are automatically scanned with Trivy in CI/CD
6. **Regular updates**: Keep base images and dependencies updated

## CI/CD Integration

This image is automatically built by GitHub Actions:

- **On push to main**: Builds and pushes `latest` tag
- **On push to develop**: Builds and pushes `develop` tag
- **On version tags**: Builds and pushes semantic version tags
- **Manual workflow**: Build specific images on demand

Trigger manual build:

```bash
gh workflow run docker-build.yml \
  -f image=sandbox-executor \
  -f push=true
```

## Deployment

Deploy using the Kubernetes deployment workflow:

```bash
gh workflow run k8s-deploy.yml \
  -f image_tag=latest \
  -f deployment=sandbox-executor
```

Or deploy via kubectl:

```bash
kubectl set image deployment/sandbox-executor \
  sandbox-executor=ghcr.io/malenacutuli/swiss-ai-vault/sandbox-executor:v1.2.3 \
  -n swissbrain

kubectl rollout status deployment/sandbox-executor -n swissbrain
```

## Monitoring

Check pod status:

```bash
kubectl get pods -n swissbrain -l app=sandbox-executor
```

View logs:

```bash
kubectl logs -n swissbrain -l app=sandbox-executor --tail=100 -f
```

Check resource usage:

```bash
kubectl top pods -n swissbrain -l app=sandbox-executor
```

## Troubleshooting

### Container fails to start

Check logs:
```bash
kubectl logs -n swissbrain -l app=sandbox-executor
```

### Health check failing

Verify the health endpoint:
```bash
kubectl port-forward -n swissbrain deployment/sandbox-executor 8000:8000
curl http://localhost:8000/health
```

### Permission denied errors

Ensure:
- Container runs as non-root user (UID 1000)
- Volumes have correct permissions
- SecurityContext is properly configured

## References

- [Docker Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [Kubernetes SecurityContext](https://kubernetes.io/docs/tasks/configure-pod-container/security-context/)
- [gVisor Runtime](https://gvisor.dev/docs/user_guide/quick_start/kubernetes/)
- [OCI Image Spec Labels](https://github.com/opencontainers/image-spec/blob/main/annotations.md)
