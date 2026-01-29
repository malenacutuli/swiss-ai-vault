# =============================================================================
# Swiss AI Vault - Frontend Dockerfile
# =============================================================================
# Author: Manus AI
# Date: January 21, 2026
# Version: 2.0
# Status: Production-Ready
#
# Build:
#   docker build -t swiss-ai-vault:latest .
#
# Run locally:
#   docker run --rm -p 3000:3000 swiss-ai-vault:latest
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
COPY .npmrc ./

# Install all dependencies (including devDependencies for build)
RUN npm ci --include=dev

# Copy all source files needed for Vite build
COPY tsconfig.json tsconfig.app.json tsconfig.node.json ./
COPY vite.config.ts tailwind.config.ts postcss.config.js ./
COPY index.html ./
COPY src/ ./src/
COPY public/ ./public/

# Build the Vite React application
RUN npm run build

# -----------------------------------------------------------------------------
# Stage 2: Production Stage (Nginx)
# -----------------------------------------------------------------------------
FROM nginx:alpine AS production

# Labels
LABEL maintainer="Manus AI <engineering@manus.ai>"
LABEL description="Swiss AI Vault - AI Agent Platform Frontend"
LABEL version="2.0"

# Install runtime dependencies
RUN apk add --no-cache \
    curl \
    ca-certificates \
    tzdata

# Copy built assets from builder stage
COPY --from=builder /build/dist /usr/share/nginx/html

# Copy custom nginx configuration for SPA routing
RUN echo 'server { \
    listen 80; \
    listen [::]:80; \
    server_name _; \
    root /usr/share/nginx/html; \
    index index.html; \
    location / { \
        try_files $uri $uri/ /index.html; \
    } \
    location /health { \
        access_log off; \
        return 200 "healthy"; \
        add_header Content-Type text/plain; \
    } \
    gzip on; \
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript; \
}' > /etc/nginx/conf.d/default.conf

# Set environment variables
ENV TZ=UTC

# Expose port
EXPOSE 80

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
    CMD curl -f http://localhost/ || exit 1

# Start nginx
CMD ["nginx", "-g", "daemon off;"]
