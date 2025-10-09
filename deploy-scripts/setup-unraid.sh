#!/bin/bash

# PDXmas Contest App - Unraid Setup Script
# This script prepares your Unraid server for automated deployments
# Run this ONCE on your Unraid server before setting up CI/CD

set -e

APP_DIR="/mnt/user/appdata/contest-app"
BACKUP_DIR="/mnt/user/Backups/contest-app"
SSH_DIR="/root/.ssh"

echo "🚀 Setting up Unraid server for PDXmas Contest App deployments"

# Function to log with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "📁 Creating necessary directories..."
mkdir -p "$APP_DIR"
mkdir -p "$APP_DIR/data"
mkdir -p "$APP_DIR/uploads"
mkdir -p "$APP_DIR/deployment"
mkdir -p "$APP_DIR/deploy-scripts"
mkdir -p "$BACKUP_DIR"
mkdir -p "$SSH_DIR"

log "🔧 Setting up directory permissions..."
chown -R nobody:users "$APP_DIR" || log "⚠️  Could not change ownership to nobody:users"
chmod -R 755 "$APP_DIR"
chmod -R 755 "$BACKUP_DIR"

log "🐳 Checking Docker installation..."
if ! command -v docker &> /dev/null; then
    log "❌ Docker is not installed! Please install Docker first."
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    log "❌ Docker Compose is not installed! Please install Docker Compose first."
    exit 1
fi

log "✅ Docker and Docker Compose are installed"

log "📦 Installing required system packages..."
# Update package list if possible
if command -v slackpkg &> /dev/null; then
    slackpkg update || log "⚠️  Could not update package list"
fi

# Install curl if not present
if ! command -v curl &> /dev/null; then
    log "📦 Installing curl..."
    # Unraid typically has curl, but just in case
    if command -v slackpkg &> /dev/null; then
        slackpkg install curl
    else
        log "⚠️  Please install curl manually"
    fi
fi

# Install rsync if not present
if ! command -v rsync &> /dev/null; then
    log "📦 Installing rsync..."
    if command -v slackpkg &> /dev/null; then
        slackpkg install rsync
    else
        log "⚠️  Please install rsync manually"
    fi
fi

log "🔑 Setting up SSH configuration..."

# Ensure SSH is enabled and configured
if [ ! -f "/etc/ssh/sshd_config" ]; then
    log "❌ SSH server is not configured! Please enable SSH in Unraid settings."
    exit 1
fi

# Check if SSH is running
if ! pgrep sshd > /dev/null; then
    log "❌ SSH server is not running! Please start SSH in Unraid settings."
    exit 1
fi

# Set proper SSH directory permissions
chmod 700 "$SSH_DIR"
touch "$SSH_DIR/authorized_keys"
chmod 600 "$SSH_DIR/authorized_keys"

log "✅ SSH configuration verified"

log "🌐 Network configuration check..."
UNRAID_IP=$(hostname -I | awk '{print $1}')
log "📍 Unraid IP Address: $UNRAID_IP"

# Test if ports are available
if ss -tuln | grep -q ":3099 "; then
    log "⚠️  Port 3099 is already in use! Make sure to stop any conflicting services."
fi

if ss -tuln | grep -q ":3001 "; then
    log "⚠️  Port 3001 is already in use! Make sure to stop any conflicting services."
fi

log "🔧 Creating initial configuration files..."

# Create a basic environment file
cat > "$APP_DIR/.env.production" << EOF
# PDXmas Contest App - Production Environment
NODE_ENV=production
PORT=3099
HOST=0.0.0.0
CORS_ORIGIN=*
DATABASE_PATH=./data/contest.db
MAX_FILE_SIZE=10485760
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100
REACT_APP_API_URL=http://$UNRAID_IP:3099/api
EOF

# Create deployment info file
cat > "$APP_DIR/deployment-info.txt" << EOF
PDXmas Contest App - Deployment Information
==========================================

Server IP: $UNRAID_IP
Setup Date: $(date)

Application URLs:
- Frontend: http://$UNRAID_IP:3099
- Backend API: http://$UNRAID_IP:3001/api/health
- Admin Panel: http://$UNRAID_IP:3099 (Results tab)

Admin Password: pdxmas2025

Directory Structure:
- App Data: $APP_DIR
- Backups: $BACKUP_DIR
- Database: $APP_DIR/data/contest.db
- Uploads: $APP_DIR/uploads/

Deployment Commands:
- Deploy: $APP_DIR/deploy-scripts/deploy.sh
- Rollback: $APP_DIR/deploy-scripts/rollback.sh
- View Logs: cd $APP_DIR && docker-compose logs -f

Troubleshooting:
- Check status: cd $APP_DIR && docker-compose ps
- Restart services: cd $APP_DIR && docker-compose restart
- Full restart: cd $APP_DIR && docker-compose down && docker-compose up -d
EOF

log "📋 Setup completed! Next steps:"
echo
echo "1. 🔑 Add your Gitea server's public SSH key to authorized_keys:"
echo "   echo 'YOUR_GITEA_PUBLIC_KEY' >> $SSH_DIR/authorized_keys"
echo
echo "2. 🌐 Configure your Gitea repository secrets:"
echo "   UNRAID_HOST: $UNRAID_IP"
echo "   UNRAID_USERNAME: root"
echo "   UNRAID_SSH_KEY: [your private SSH key]"
echo
echo "3. 🧪 Test the connection from your Gitea server:"
echo "   ssh root@$UNRAID_IP 'echo \"Connection successful!\"'"
echo
echo "4. 🚀 Push to your repository to trigger the first deployment!"
echo
echo "📄 Configuration files created:"
echo "   - Environment: $APP_DIR/.env.production"
echo "   - Info: $APP_DIR/deployment-info.txt"
echo
echo "✅ Unraid server is ready for automated deployments!"

# Show current system info
log "💻 System Information:"
echo "   Docker Version: $(docker --version)"
echo "   Docker Compose Version: $(docker-compose --version)"
echo "   Available Disk Space: $(df -h $APP_DIR | tail -1 | awk '{print $4}') available at $APP_DIR"
echo "   Memory Usage: $(free -h | grep Mem | awk '{print $3"/"$2}')"
