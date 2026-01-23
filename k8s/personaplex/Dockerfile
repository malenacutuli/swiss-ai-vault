# PersonaPlex Docker Image for Swiss K8s
# Based on official NVIDIA PersonaPlex Dockerfile
ARG BASE_IMAGE="nvcr.io/nvidia/cuda"
ARG BASE_IMAGE_TAG="12.4.1-runtime-ubuntu22.04"

FROM ${BASE_IMAGE}:${BASE_IMAGE_TAG}

# Install uv for fast Python package management
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libopus-dev \
    git \
    curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Clone PersonaPlex
RUN git clone https://github.com/NVIDIA/personaplex.git /app/personaplex

# Set up Python environment
WORKDIR /app/personaplex/moshi
RUN uv venv /app/personaplex/moshi/.venv --python 3.12
RUN uv sync

# Create SSL directory (required by server)
RUN mkdir -p /app/ssl

# Expose WebSocket port
EXPOSE 8998

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=120s --retries=3 \
    CMD curl -f http://localhost:8998/health || exit 1

# Start server (without SSL for internal K8s - TLS handled by ingress)
CMD ["/app/personaplex/moshi/.venv/bin/python", "-m", "moshi.server", "--host", "0.0.0.0", "--port", "8998"]
