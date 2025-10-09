#!/bin/bash

# PDXmas Contest App Rollback Script for Unraid
# Usage: ./rollback.sh

set -e  # Exit on any error

APP_DIR="/mnt/user/appdata/contest-app"
BACKUP_DIR="/mnt/user/backups/contest-app"

echo "🔄 Starting rollback of PDXmas Contest App"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

# Check if backup exists
if [ ! -d "$BACKUP_DIR/last-working" ]; then
    log "❌ No backup found in $BACKUP_DIR/last-working"
    log "   Cannot perform rollback!"
    exit 1
fi

log "💾 Found backup, proceeding with rollback..."

# Stop current services
log "⏹️  Stopping current services..."
cd "$APP_DIR"
docker-compose down || log "⚠️  Services were not running"

# Backup current state (in case rollback needs to be rolled back)
log "💾 Backing up current state before rollback..."
mkdir -p "$BACKUP_DIR/pre-rollback-$(date +%Y%m%d-%H%M%S)"
rsync -av --exclude='node_modules' --exclude='build' --exclude='dist' \
      --exclude='*.log' --exclude='deployment/' \
      . "$BACKUP_DIR/pre-rollback-$(date +%Y%m%d-%H%M%S)/"

# Restore from backup
log "🔄 Restoring from backup..."
rsync -av "$BACKUP_DIR/last-working/" "$APP_DIR/"

# Start restored services
log "▶️  Starting restored services..."
docker-compose up -d

log "⏱️  Waiting for services to start..."
sleep 15

# Health checks
log "🏥 Performing health checks..."

# Check if containers are running
BACKEND_STATUS=$(docker-compose ps -q backend | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not_found")
FRONTEND_STATUS=$(docker-compose ps -q frontend | xargs docker inspect -f '{{.State.Status}}' 2>/dev/null || echo "not_found")

if [ "$BACKEND_STATUS" != "running" ]; then
    log "❌ Backend container is not running! Status: $BACKEND_STATUS"
    docker-compose logs backend
    exit 1
fi

if [ "$FRONTEND_STATUS" != "running" ]; then
    log "❌ Frontend container is not running! Status: $FRONTEND_STATUS"
    docker-compose logs frontend
    exit 1
fi

# Test backend API
log "🧪 Testing backend API..."
HEALTH_CHECK_COUNT=0
while [ $HEALTH_CHECK_COUNT -lt 12 ]; do  # Try for up to 60 seconds
    if curl -f -s http://localhost:3001/api/health >/dev/null 2>&1; then
        log "✅ Backend API is healthy"
        break
    fi
    HEALTH_CHECK_COUNT=$((HEALTH_CHECK_COUNT + 1))
    if [ $HEALTH_CHECK_COUNT -eq 12 ]; then
        log "❌ Backend API health check failed after 60 seconds"
        docker-compose logs backend
        exit 1
    fi
    sleep 5
done

# Test frontend
log "🧪 Testing frontend..."
if curl -f -s http://localhost:3000/ >/dev/null 2>&1; then
    log "✅ Frontend is responding"
else
    log "❌ Frontend health check failed"
    docker-compose logs frontend
    exit 1
fi

# Update rollback marker
echo "ROLLBACK-$(date)" > "$APP_DIR/.last-deployment"

log "🎉 Rollback completed successfully!"
log "📊 Application Status:"
docker-compose ps

log "🌐 Application URLs:"
log "   Frontend: http://$(hostname -I | awk '{print $1}'):3000"
log "   Backend API: http://$(hostname -I | awk '{print $1}'):3001/api/health"

echo
echo "✅ PDXmas Contest App rollback completed successfully!"
echo "🔄 Previous version restored and running!"