#!/bin/bash

# deploy.sh - Deployment script for contest app on Unraid
# Usage: ./deploy.sh <commit-sha>

set -e  # Exit on any error

COMMIT_SHA=$1
DEPLOYMENT_DIR="/mnt/user/appdata/contest-app/deployment"
APP_DIR="/mnt/user/appdata/contest-app"

echo "=========================================="
echo "Starting deployment process..."
echo "Commit SHA: ${COMMIT_SHA}"
echo "Time: $(date)"
echo "=========================================="

# Change to deployment directory
cd ${DEPLOYMENT_DIR}

# Backup current images (optional, for rollback capability)
echo "Creating backup tags..."
docker tag contest-backend:latest contest-backend:backup || true
docker tag contest-frontend:latest contest-frontend:backup || true

# Load new Docker images
echo "Loading backend image..."
if [ -f "contest-backend.tar.gz" ]; then
    docker load < contest-backend.tar.gz
    echo "✅ Backend image loaded"
else
    echo "❌ Backend image file not found!"
    exit 1
fi

echo "Loading frontend image..."
if [ -f "contest-frontend.tar.gz" ]; then
    docker load < contest-frontend.tar.gz
    echo "✅ Frontend image loaded"
else
    echo "❌ Frontend image file not found!"
    exit 1
fi

# Copy docker-compose.yml to app directory
echo "Copying docker-compose.yml to app directory..."
cp docker-compose.yml ${APP_DIR}/

# Change to app directory for docker-compose operations
cd ${APP_DIR}

# Stop and remove existing containers
echo "Stopping existing containers..."
docker-compose down || true

# Remove old images to free up space
echo "Cleaning up old images..."
docker image prune -f

# Start services with new images
echo "Starting services..."
docker-compose up -d

# Wait for services to be ready
echo "Waiting for services to initialize..."
sleep 10

# Check if containers are running
echo "Checking container status..."
docker-compose ps

# Verify backend is responding
echo "Verifying backend health..."
BACKEND_READY=false
for i in {1..30}; do
    if docker-compose exec -T backend wget --quiet --spider http://localhost:3001/api/health 2>/dev/null; then
        BACKEND_READY=true
        echo "✅ Backend is healthy"
        break
    fi
    echo "Waiting for backend to be ready... (attempt $i/30)"
    sleep 2
done

if [ "$BACKEND_READY" = false ]; then
    echo "❌ Backend failed to become healthy"
    echo "Rolling back to previous version..."
    docker tag contest-backend:backup contest-backend:latest || true
    docker tag contest-frontend:backup contest-frontend:latest || true
    docker-compose down
    docker-compose up -d
    exit 1
fi

# Clean up deployment files
echo "Cleaning up deployment artifacts..."
cd ${DEPLOYMENT_DIR}
rm -f contest-backend.tar.gz contest-frontend.tar.gz

# Remove backup tags
echo "Removing old backup images..."
docker rmi contest-backend:backup || true
docker rmi contest-frontend:backup || true

echo "=========================================="
echo "✅ Deployment completed successfully!"
echo "Commit SHA: ${COMMIT_SHA}"
echo "Time: $(date)"
echo "=========================================="

# Show running containers
echo ""
echo "Running containers:"
cd ${APP_DIR}
docker-compose ps

# Show resource usage
echo ""
echo "Resource usage:"
docker stats --no-stream pdxmas-contest-backend pdxmas-contest-frontend

exit 0
