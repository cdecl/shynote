#!/bin/bash

# Configuration
IMAGE_NAME="shynote"
TAG="latest"

echo "🚀 Building Docker image: ${IMAGE_NAME}:${TAG}..."

# Build the Docker image
docker build -t "${IMAGE_NAME}:${TAG}" .

echo "✅ Build complete!"
echo "To run the container:"
echo "docker run -p 8000:8000 --env-file .env ${IMAGE_NAME}:${TAG}"
