# Dockerfile

# 1. Base Image: Use an official NVIDIA CUDA image compatible with CUDA 12.2
# Using CUDA 12.2.2 runtime with cuDNN 8 on Ubuntu 22.04
FROM nvidia/cuda:12.2.2-cudnn8-runtime-ubuntu22.04

# Prevent interactive prompts during package installation
ENV DEBIAN_FRONTEND=noninteractive
# Ensure UTF-8 locale to prevent potential issues with Python/Gunicorn
ENV LANG C.UTF-8

# 2. Install Python and pip
# Using Python 3.11 as it's well-supported with recent libraries
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3.11 \
    python3-pip \
    python3-venv \
    # Add git in case any pip packages need it during install
    git \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set Python 3.11 as the default python/pip
RUN update-alternatives --install /usr/bin/python python /usr/bin/python3.11 1 && \
    update-alternatives --install /usr/bin/pip pip /usr/bin/pip3 1

# 3. Set up working directory inside the container
WORKDIR /app

# 4. Copy requirements file first to leverage Docker cache
COPY requirements.txt .

# 5. Install Python dependencies using the correct PyTorch index for CUDA 12.1
# (Compatible with CUDA 12.2 drivers)
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt --index-url https://download.pytorch.org/whl/cu121

# 6. Copy the rest of the application code into the container
COPY . .

# 7. Expose the port the app runs on (matches Gunicorn command and $PORT env var)
EXPOSE 8080
ENV PORT=8080

# 8. Define the command to run the application using Gunicorn
# - Bind to 0.0.0.0 to accept connections from outside the container
# - Use the $PORT environment variable
# - Set workers=1 (usually best for GPU tasks per instance)
# - Set threads=8 (allow multiple requests if Gunicorn/Flask is async, adjust as needed)
# - Set timeout=900 (15 minutes) for model loading and long inference
CMD ["gunicorn", "--bind", "0.0.0.0:8080", "--workers", "1", "--threads", "8", "--timeout", "900", "main:app"]
