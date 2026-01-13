# Docker Build Pipeline Guide

This guide provides comprehensive documentation for the Docker image build pipeline, including local development, CI/CD integration, and production deployment strategies.

## Table of Contents

1. [Overview](#overview)
2. [Image Architecture](#image-architecture)
3. [Local Development](#local-development)
4. [CI/CD Pipeline](#cicd-pipeline)
5. [Image Tagging Strategy](#image-tagging-strategy)
6. [GitHub Container Registry](#github-container-registry)
7. [Security Scanning](#security-scanning)
8. [Multi-platform Builds](#multi-platform-builds)
9. [Optimization Techniques](#optimization-techniques)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The SwissBrain AI platform uses a multi-image Docker architecture:

| Image | Purpose | Base Image | Size |
|-------|---------|------------|------|
| **frontend** | Vite/React SPA | `nginx:1.25-alpine` | ~50MB |
| **sandbox-executor** | Code execution service | `python:3.11-slim` | ~200MB |

All images are:
- ✅ Multi-stage for minimal size
- ✅ Security-hardened with non-root users
- ✅ Scanned for vulnerabilities with Trivy
- ✅ Cached for fast builds
- ✅ Automatically tagged and versioned

---

## Image Architecture

### Frontend Image

The frontend image uses a two-stage build:

```
┌─────────────────────────────────────────────────────────────┐
│ Stage 1: Builder (node:20-alpine)                           │
│ • Install dependencies with npm ci                          │
│ • Build Vite/React app with production optimizations        │
│ • Output: /app/dist                                         │
└─────────────────┬───────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────────┐
│ Stage 2: Production (nginx:1.25-alpine)                     │
│ • Copy built assets from builder                            │
│ • Configure nginx with SPA routing                          │
│ • Add security headers                                      │
│ • Enable gzip compression                                   │
│ • Size: ~50MB (compared to ~1.2GB with node_modules)        │
└─────────────────────────────────────────────────────────────┘
```

**Benefits**:
- 95% size reduction (50MB vs 1.2GB)
- No Node.js runtime in production
- Optimized nginx serving
- Built-in health checks

### Sandbox Executor Image

Security-hardened Python container:

```
┌─────────────────────────────────────────────────────────────┐
│ Base: python:3.11-slim                                       │
│ • Minimal Debian base                                        │
│ • Essential system tools only                               │
│ • Non-root user (UID 1000)                                  │
│ • Read-only root filesystem capable                         │
│ • Health check endpoint                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## Local Development

### Building Images Locally

#### Frontend

```bash
# Build frontend image
docker build -t swissbrain-frontend:local .

# Build with environment variables
docker build \
  --build-arg VITE_SUPABASE_URL=https://your-project.supabase.co \
  --build-arg VITE_SUPABASE_ANON_KEY=your-anon-key \
  -t swissbrain-frontend:local \
  .

# Run locally
docker run -p 8080:80 swissbrain-frontend:local

# Test health check
curl http://localhost:8080/health
```

#### Sandbox Executor

```bash
# Build sandbox-executor image
cd sandbox-executor
docker build -t swissbrain-sandbox:local .

# Run with environment variables
docker run -p 8000:8000 \
  -e PORT=8000 \
  swissbrain-sandbox:local

# Test health check
curl http://localhost:8000/health
```

### Docker Compose (Optional)

Create `docker-compose.yml` for local development:

```yaml
version: '3.8'

services:
  frontend:
    build:
      context: .
      dockerfile: Dockerfile
      args:
        VITE_SUPABASE_URL: ${VITE_SUPABASE_URL}
        VITE_SUPABASE_ANON_KEY: ${VITE_SUPABASE_ANON_KEY}
    ports:
      - "8080:80"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost/health"]
      interval: 30s
      timeout: 3s
      retries: 3

  sandbox-executor:
    build:
      context: ./sandbox-executor
      dockerfile: Dockerfile
    ports:
      - "8000:8000"
    environment:
      - PORT=8000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 30s
      timeout: 3s
      retries: 3
```

Run with:

```bash
docker-compose up -d
docker-compose logs -f
docker-compose down
```

---

## CI/CD Pipeline

### Workflow Triggers

The Docker build workflow (`.github/workflows/docker-build.yml`) is triggered by:

| Trigger | Behavior |
|---------|----------|
| **Push to main** | Build all images, push with `latest` tag |
| **Push to develop** | Build all images, push with `develop` tag |
| **Push tag v*.*.*** | Build all images, push with semantic version |
| **Pull request** | Build images, do NOT push to registry |
| **Manual dispatch** | Build selected image(s), optional push |

### Pipeline Stages

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Prepare                                                   │
│    • Generate version metadata                              │
│    • Decide which images to build                           │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ├─────────────────┐
                 ▼                 ▼
┌────────────────────────┐  ┌──────────────────────────┐
│ 2a. Build Frontend     │  │ 2b. Build Sandbox        │
│    • Multi-stage build │  │    • Security hardened   │
│    • GitHub cache      │  │    • Non-root user       │
│    • Metadata labels   │  │    • Health checks       │
└────────────┬───────────┘  └──────────┬───────────────┘
             │                         │
             └─────────┬───────────────┘
                       ▼
       ┌───────────────────────────────────────┐
       │ 3. Security Scan (Trivy)              │
       │    • Vulnerability scanning           │
       │    • Upload to Security tab           │
       └───────────────┬───────────────────────┘
                       ▼
       ┌───────────────────────────────────────┐
       │ 4. Summary                            │
       │    • Build results                    │
       │    • Image URLs                       │
       │    • Registry information             │
       └───────────────────────────────────────┘
```

### Manual Workflow Dispatch

Build specific images manually:

```bash
# Build all images
gh workflow run docker-build.yml \
  -f image=all \
  -f push=true

# Build only frontend
gh workflow run docker-build.yml \
  -f image=frontend \
  -f push=true

# Build sandbox-executor without pushing
gh workflow run docker-build.yml \
  -f image=sandbox-executor \
  -f push=false
```

---

## Image Tagging Strategy

### Automatic Tags

Images are automatically tagged based on the trigger:

| Event | Tags Generated |
|-------|----------------|
| **Push to main** | `latest`, `main-<sha>` |
| **Push to develop** | `develop`, `develop-<sha>` |
| **Tag v1.2.3** | `v1.2.3`, `1.2.3`, `1.2`, `1`, `latest` |
| **Pull request #42** | `pr-42` |

### Tag Examples

```bash
# Latest stable version
ghcr.io/malenacutuli/swiss-ai-vault/frontend:latest

# Specific version
ghcr.io/malenacutuli/swiss-ai-vault/frontend:v1.2.3
ghcr.io/malenacutuli/swiss-ai-vault/frontend:1.2.3
ghcr.io/malenacutuli/swiss-ai-vault/frontend:1.2
ghcr.io/malenacutuli/swiss-ai-vault/frontend:1

# Development branch
ghcr.io/malenacutuli/swiss-ai-vault/frontend:develop

# Commit SHA (main branch)
ghcr.io/malenacutuli/swiss-ai-vault/frontend:main-abc1234

# Pull request
ghcr.io/malenacutuli/swiss-ai-vault/frontend:pr-42
```

### Semantic Versioning

To create a versioned release:

```bash
# Create and push a version tag
git tag -a v1.2.3 -m "Release version 1.2.3"
git push origin v1.2.3

# This automatically triggers:
# - Docker build workflow
# - Creates tags: v1.2.3, 1.2.3, 1.2, 1, latest
# - Pushes to GitHub Container Registry
```

---

## GitHub Container Registry

### Authentication

```bash
# Login to GHCR
echo $GITHUB_TOKEN | docker login ghcr.io -u USERNAME --password-stdin

# Pull an image
docker pull ghcr.io/malenacutuli/swiss-ai-vault/frontend:latest

# Push an image (requires write permissions)
docker tag local-image:latest ghcr.io/malenacutuli/swiss-ai-vault/frontend:v1.0.0
docker push ghcr.io/malenacutuli/swiss-ai-vault/frontend:v1.0.0
```

### Package Permissions

Images are stored as GitHub Packages:

1. Go to: `https://github.com/malenacutuli/swiss-ai-vault/packages`
2. Select package (frontend or sandbox-executor)
3. Configure:
   - **Visibility**: Private (recommended) or Public
   - **Access**: Grant teams/users access
   - **Settings**: Configure retention policies

### Making Images Public

To make images publicly accessible:

1. Go to Package Settings
2. Change visibility to **Public**
3. Anyone can now pull: `docker pull ghcr.io/malenacutuli/swiss-ai-vault/frontend:latest`

---

## Security Scanning

### Trivy Vulnerability Scanner

All images are automatically scanned with Trivy after building:

```bash
# Scan locally
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image ghcr.io/malenacutuli/swiss-ai-vault/frontend:latest

# Scan with severity filter
docker run --rm \
  -v /var/run/docker.sock:/var/run/docker.sock \
  aquasec/trivy image --severity HIGH,CRITICAL \
  ghcr.io/malenacutuli/swiss-ai-vault/frontend:latest
```

### Security Reports

Scan results are uploaded to GitHub Security tab:

1. Go to **Security** → **Code scanning alerts**
2. View Trivy scan results
3. Filter by severity: Critical, High, Medium, Low
4. Review and remediate vulnerabilities

### Best Practices

- **Keep base images updated**: Regularly rebuild with latest base images
- **Minimal dependencies**: Only include necessary packages
- **Non-root user**: Never run containers as root
- **Read-only filesystem**: Use where possible
- **Regular scans**: Enable Dependabot and security alerts

---

## Multi-platform Builds

To build for multiple architectures (amd64, arm64):

### Using Docker Buildx

```bash
# Create a new builder
docker buildx create --name multiplatform --use

# Build for multiple platforms
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t ghcr.io/malenacutuli/swiss-ai-vault/frontend:latest \
  --push \
  .
```

### Update GitHub Workflow

Modify `.github/workflows/docker-build.yml`:

```yaml
- name: Build and push frontend image
  uses: docker/build-push-action@v5
  with:
    context: .
    file: ./Dockerfile
    platforms: linux/amd64,linux/arm64  # Add this line
    push: ${{ github.event_name != 'pull_request' }}
    tags: ${{ steps.meta.outputs.tags }}
```

---

## Optimization Techniques

### 1. Build Cache

GitHub Actions uses BuildKit cache:

```yaml
cache-from: type=gha
cache-to: type=gha,mode=max
```

**Benefits**:
- Faster builds (minutes → seconds for unchanged layers)
- Reduced GitHub Actions minutes usage
- Automatic cache invalidation when dependencies change

### 2. Layer Optimization

Order Dockerfile instructions from least to most frequently changing:

```dockerfile
# ✅ Good: Stable layers first
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ❌ Bad: Changes invalidate all layers
COPY . .
RUN npm ci && npm run build
```

### 3. Multi-stage Builds

Use multi-stage builds to minimize final image size:

```dockerfile
# Build stage (large)
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage (small)
FROM nginx:1.25-alpine
COPY --from=builder /app/dist /usr/share/nginx/html
```

**Result**: 1.2GB → 50MB (95% reduction)

### 4. .dockerignore

Exclude unnecessary files to speed up builds:

```dockerignore
node_modules
.git
*.md
tests
.env*
```

---

## Troubleshooting

### Build Fails with "No space left on device"

**Problem**: Docker ran out of disk space

**Solution**:
```bash
# Clean up Docker resources
docker system prune -a --volumes

# Check disk usage
docker system df
```

### "Manifest unknown" when pulling image

**Problem**: Image doesn't exist or wrong tag

**Solution**:
```bash
# List available tags
gh api /user/packages/container/swiss-ai-vault%2Ffrontend/versions | jq '.[].metadata.container.tags'

# Verify image exists
docker manifest inspect ghcr.io/malenacutuli/swiss-ai-vault/frontend:latest
```

### Build Cache Not Working

**Problem**: Cache not being used in GitHub Actions

**Solution**:
```yaml
# Ensure cache is properly configured
- name: Build and push
  uses: docker/build-push-action@v5
  with:
    cache-from: type=gha
    cache-to: type=gha,mode=max
```

### Image Size Too Large

**Problem**: Image is larger than expected

**Solution**:
```bash
# Analyze image layers
docker history ghcr.io/malenacutuli/swiss-ai-vault/frontend:latest

# Use dive for detailed analysis
docker run --rm -it \
  -v /var/run/docker.sock:/var/run/docker.sock \
  wagoodman/dive:latest \
  ghcr.io/malenacutuli/swiss-ai-vault/frontend:latest
```

**Common causes**:
- Not using multi-stage builds
- Including unnecessary files (.git, node_modules, tests)
- Not using alpine base images
- Installing unnecessary dependencies

### Permission Denied in Container

**Problem**: Container can't write to filesystem

**Solution**:
```dockerfile
# Ensure writable directories
RUN mkdir -p /app/tmp && chown sandbox:sandbox /app/tmp
VOLUME /app/tmp

# Or in Kubernetes
volumeMounts:
- name: tmp
  mountPath: /app/tmp
volumes:
- name: tmp
  emptyDir: {}
```

---

## Best Practices Summary

1. **Use multi-stage builds** for minimal image size
2. **Order layers** from least to most frequently changing
3. **Use .dockerignore** to exclude unnecessary files
4. **Run as non-root user** for security
5. **Include health checks** for reliability
6. **Add metadata labels** for tracking
7. **Scan for vulnerabilities** before deployment
8. **Use specific version tags** in production
9. **Enable build cache** for faster builds
10. **Keep base images updated** for security patches

---

## References

- [Docker Best Practices](https://docs.docker.com/develop/dev-best-practices/)
- [Multi-stage Builds](https://docs.docker.com/build/building/multi-stage/)
- [BuildKit Cache](https://docs.docker.com/build/cache/)
- [GitHub Container Registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [Trivy Scanner](https://aquasecurity.github.io/trivy/)
- [Docker Security](https://docs.docker.com/engine/security/)
- [OCI Image Spec](https://github.com/opencontainers/image-spec)
