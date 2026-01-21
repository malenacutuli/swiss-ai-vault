# =============================================================================
# BullMQ Worker Dockerfile
# =============================================================================
# Author: Manus AI
# Date: January 21, 2026
# Version: 1.0
# Status: Production-Ready
#
# Build:
#   docker build -t bullmq-worker:latest .
#
# Run locally:
#   docker run --rm -it \
#     -e REDIS_HOST=localhost \
#     -e REDIS_PORT=6379 \
#     -e REDIS_PASSWORD=secret \
#     bullmq-worker:latest
# =============================================================================

# -----------------------------------------------------------------------------
# Stage 1: Build Stage
# -----------------------------------------------------------------------------
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git

# Set working directory
WORKDIR /build

# Copy package files first for better caching
COPY package.json package-lock.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy source code
COPY tsconfig.json ./
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Prune devDependencies
RUN npm prune --production

# -----------------------------------------------------------------------------
# Stage 2: Production Stage
# -----------------------------------------------------------------------------
FROM node:20-alpine AS production

# Labels
LABEL maintainer="Manus AI <engineering@manus.ai>"
LABEL description="BullMQ Worker for task queue processing"
LABEL version="1.0"

# Install runtime dependencies only
RUN apk add --no-cache \
    # For health checks
    curl \
    # For TLS certificate handling
    ca-certificates \
    # For timezone support
    tzdata \
    # For signal handling
    tini \
    # For debugging (optional, remove in hardened builds)
    busybox-extras \
    && rm -rf /var/cache/apk/*

# Create non-root user and group (use different IDs to avoid conflicts)
RUN addgroup -g 1001 -S worker && \
    adduser -u 1001 -S worker -G worker -h /home/worker -s /bin/sh

# Create required directories with correct ownership
RUN mkdir -p /app /home/worker/.cache /tmp/worker && \
    chown -R worker:worker /app /home/worker /tmp/worker

# Set working directory
WORKDIR /app

# Copy built application from builder stage
COPY --from=builder --chown=worker:worker /build/dist ./dist
COPY --from=builder --chown=worker:worker /build/node_modules ./node_modules
COPY --from=builder --chown=worker:worker /build/package.json ./

# Copy entrypoint and health check scripts
COPY --chown=worker:worker scripts/entrypoint.sh /usr/local/bin/entrypoint.sh
COPY --chown=worker:worker scripts/healthcheck.sh /usr/local/bin/healthcheck.sh
COPY --chown=worker:worker scripts/shutdown-handler.sh /usr/local/bin/shutdown-handler.sh

# Make scripts executable
RUN chmod +x /usr/local/bin/entrypoint.sh \
    /usr/local/bin/healthcheck.sh \
    /usr/local/bin/shutdown-handler.sh

# Set environment variables
ENV NODE_ENV=production \
    # Disable npm update check
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    # Node.js settings
    NODE_OPTIONS="--max-old-space-size=6144 --enable-source-maps" \
    # Timezone
    TZ=UTC \
    # Application paths (writable directories)
    TMPDIR=/tmp/worker \
    HOME=/home/worker \
    # Health check port
    HEALTH_PORT=8080 \
    # Metrics port
    METRICS_PORT=9090

# Switch to non-root user
USER worker

# Expose ports
EXPOSE 8080 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD /usr/local/bin/healthcheck.sh

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/entrypoint.sh"]

# Default command
CMD ["node", "dist/index.js"]
