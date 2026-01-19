# Multi-stage build for Swiss Agent API
FROM python:3.11-slim as builder

# Install build dependencies (including Cairo for pycairo/reportlab)
RUN apt-get update && apt-get install -y \
    gcc \
    pkg-config \
    libcairo2-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

# Install runtime dependencies (including Cairo for pycairo/reportlab)
RUN apt-get update && apt-get install -y \
    curl \
    libcairo2 \
    && rm -rf /var/lib/apt/lists/*

# Create agent user with specific UID/GID FIRST
RUN groupadd -g 1000 agent && \
    useradd -u 1000 -g agent -m -s /bin/bash agent

# Copy virtual environment from builder and set ownership
COPY --from=builder --chown=1000:1000 /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Ensure Python and all executables in venv are executable
RUN chmod -R 755 /opt/venv/bin && \
    chmod 755 /opt/venv/bin/python* && \
    chown -R 1000:1000 /opt/venv

# Create app directory with correct ownership
RUN mkdir -p /app && \
    chown -R 1000:1000 /app

# Set working directory BEFORE copying files
WORKDIR /app

# Copy application code with explicit numeric ownership
COPY --chown=1000:1000 app/ ./app/
COPY --chown=1000:1000 entrypoint.py ./
COPY --chown=1000:1000 test_worker_in_container.py ./
COPY --chown=1000:1000 test_minimal_worker.py ./
COPY --chown=1000:1000 test_minimal_with_import.py ./
COPY --chown=1000:1000 test_ultra_minimal.py ./
COPY --chown=1000:1000 test_gradual_import.py ./
COPY --chown=1000:1000 test_simple_app_import.py ./
COPY --chown=1000:1000 test_dependencies.py ./
COPY --chown=1000:1000 test_import_by_import.py ./

# Set PYTHONDONTWRITEBYTECODE to prevent __pycache__ creation
ENV PYTHONDONTWRITEBYTECODE=1

# Test imports work as root (build-time verification)
RUN python -c "from app.worker.job_queue import JobQueue; print('✓ JobQueue import OK', flush=True)"
RUN python -c "from app.worker.job_processor import JobProcessor; print('✓ JobProcessor import OK', flush=True)"
RUN python -c "from app.worker.main import AgentWorker; print('✓ Worker main import OK', flush=True)"
RUN python -c "from app.document_generation.router import DocumentGenerationRouter; print('✓ Document generation import OK', flush=True)"
RUN python -c "from app.llm import LLMProvider, create_llm_provider; print('✓ Multi-provider LLM import OK', flush=True)"

# TEMPORARY: Run as root to verify functionality, then fix permissions
# TODO: Fix agent user permissions properly
# USER 1000:1000

# Test imports work as root
RUN python -c "import os; print(f'Running as UID={os.getuid()}, GID={os.getgid()}', flush=True)"
RUN python -c "from app.worker.main import AgentWorker; print('✓ Worker import OK', flush=True)"

# Expose port
EXPOSE 8000

# Health check (disabled - use K8s probes instead)
# For worker deployments, K8s will use custom probes
# For API deployments, K8s will use HTTP probes
HEALTHCHECK NONE

# Run application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
