#!/bin/bash

# PDXmas Contest App - Unraid Deployment Script
# Run this script from your Unraid terminal after uploading the project

set -e

echo "🎄 PDXmas Contest App - Unraid Deployment Script 🎄"
echo "=================================================="

# Configuration
PROJECT_DIR="/mnt/user/appdata/contest-app"
UNRAID_IP="${1:-localhost}"

if [ "$UNRAID_IP" = "localhost" ]; then
    echo "⚠️  Warning: Using localhost as UNRAID_IP"
    echo "   Usage: ./deploy-unraid.sh YOUR-UNRAID-IP"
    echo "   Example: ./deploy-unraid.sh 192.168.1.100"
    echo ""
fi

echo "🔍 Checking prerequisites..."

# Check if running on Unraid
if [ ! -d "/mnt/user" ]; then
    echo "❌ Error: This script must be run on an Unraid server"
    exit 1
fi

# Check if Docker is available
if ! command -v docker &> /dev/null; then
    echo "❌ Error: Docker is not installed or not in PATH"
    exit 1
fi

# Check if docker-compose is available
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Error: docker-compose is not installed"
    echo "   Install it with: pip install docker-compose"
    exit 1
fi

echo "✅ Prerequisites check passed"

# Navigate to project directory
echo "📁 Navigating to project directory: $PROJECT_DIR"
if [ ! -d "$PROJECT_DIR" ]; then
    echo "❌ Error: Project directory not found: $PROJECT_DIR"
    echo "   Please upload your project files to this directory first"
    exit 1
fi

cd "$PROJECT_DIR"

# Create required directories
echo "📂 Creating required directories..."
mkdir -p data uploads

echo "🔧 Configuring for Unraid IP: $UNRAID_IP"

# Update docker-compose for Unraid
if [ -f "docker-compose.unraid.yml" ]; then
    # Use the Unraid-specific compose file
    sed -i "s/YOUR-UNRAID-IP/$UNRAID_IP/g" docker-compose.unraid.yml
    COMPOSE_FILE="docker-compose.unraid.yml"
else
    # Use the regular compose file and update it
    sed -i "s/localhost/$UNRAID_IP/g" docker-compose.yml
    COMPOSE_FILE="docker-compose.yml"
fi

echo "📦 Building containers..."
docker-compose -f "$COMPOSE_FILE" build

echo "🚀 Starting services..."
docker-compose -f "$COMPOSE_FILE" up -d

echo "⏳ Waiting for services to start..."
sleep 10

echo "🔍 Checking service status..."
docker-compose -f "$COMPOSE_FILE" ps

echo ""
echo "🎉 Deployment complete!"
echo "=============================="
echo "🌐 Frontend URL: http://$UNRAID_IP:3000"
echo "🔧 Backend API: http://$UNRAID_IP:3001/api/health"
echo "🛡️  Admin Password: pdxmas2025"
echo ""
echo "📋 Management commands:"
echo "  Status:   docker-compose -f $COMPOSE_FILE ps"
echo "  Logs:     docker-compose -f $COMPOSE_FILE logs -f"
echo "  Restart:  docker-compose -f $COMPOSE_FILE restart"
echo "  Stop:     docker-compose -f $COMPOSE_FILE down"
echo "  Update:   docker-compose -f $COMPOSE_FILE pull && docker-compose -f $COMPOSE_FILE up -d"
echo ""

# Test the deployment
echo "🧪 Testing deployment..."
if curl -s "http://$UNRAID_IP:3001/api/health" > /dev/null; then
    echo "✅ Backend is responding"
else
    echo "⚠️  Backend health check failed - check logs"
fi

echo "🎄 Happy holidays! Your contest app is ready! ❄️"