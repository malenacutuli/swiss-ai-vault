# PersonaPlex Docker Image for Swiss K8s
FROM nvidia/cuda:12.4-runtime-ubuntu22.04

# Install Python and dependencies
RUN apt-get update && apt-get install -y \
    python3.11 \
    python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Clone PersonaPlex
RUN git clone https://github.com/NVIDIA/personaplex.git .

# Install dependencies
RUN pip3 install ./moshi/.

# Install PyTorch with CUDA support
RUN pip3 install torch torchvision torchaudio --index-url https://download.pytorch.org/whl/cu124

# Pre-download voice prompts
COPY voices/ /app/voices/

# Health check endpoint
RUN pip3 install flask
COPY health_server.py /app/

# Expose WebSocket port
EXPOSE 8998

# Start server
CMD ["python3", "-m", "moshi.server", "--host", "0.0.0.0", "--port", "8998"]
