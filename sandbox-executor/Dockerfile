# Sandbox Executor Dockerfile
# Secure code execution environment with gVisor runtime support
# This is a reference implementation - customize based on actual service requirements

FROM python:3.11-slim AS base

# Build arguments
ARG BUILD_DATE
ARG VCS_REF
ARG VERSION

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    git \
    build-essential \
    libffi-dev \
    libssl-dev \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN useradd -m -u 1000 -s /bin/bash sandbox && \
    mkdir -p /app /workspace && \
    chown -R sandbox:sandbox /app /workspace

# Set working directory
WORKDIR /app

# Copy requirements (if using Python)
# COPY requirements.txt .
# RUN pip install --no-cache-dir -r requirements.txt

# Switch to non-root user
USER sandbox

# Copy application code
# COPY --chown=sandbox:sandbox . .

# Add labels
LABEL org.opencontainers.image.created="${BUILD_DATE}" \
      org.opencontainers.image.title="SwissBrain Sandbox Executor" \
      org.opencontainers.image.description="Secure code execution environment" \
      org.opencontainers.image.authors="SwissBrain.ai" \
      org.opencontainers.image.url="https://swissbrain.ai" \
      org.opencontainers.image.source="https://github.com/malenacutuli/swiss-ai-vault" \
      org.opencontainers.image.version="${VERSION}" \
      org.opencontainers.image.revision="${VCS_REF}" \
      org.opencontainers.image.vendor="SwissBrain.ai"

# Expose port
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Default command (customize based on your service)
# CMD ["python", "main.py"]
# CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
# CMD ["node", "server.js"]

# Placeholder command for reference implementation
CMD ["sh", "-c", "echo 'Sandbox Executor container started. Configure with actual service command.' && sleep infinity"]
