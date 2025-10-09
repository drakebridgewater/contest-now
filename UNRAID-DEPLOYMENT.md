# PDXmas Contest App - Unraid Deployment Guide 🚀

## 📋 Prerequisites

1. **Unraid server** with Docker enabled
2. **Community Applications** plugin installed
3. Basic familiarity with Unraid file shares and Docker containers

---

## 📁 File Preparation

### Step 1: Upload Project to Unraid

1. **Create project folder** on your Unraid share:
   ```
   /mnt/user/appdata/contest-app/
   ```

2. **Upload all project files** to this directory:
   - `docker-compose.yml`
   - `backend/` folder (with Dockerfile, server.js, package.json)
   - `frontend/` folder (with Dockerfile, src/, public/, package.json)

3. **Create required directories**:
   ```
   /mnt/user/appdata/contest-app/data/
   /mnt/user/appdata/contest-app/uploads/
   ```

---

## 🐳 Method 1: Docker Compose (Recommended)

### Step 1: Access Unraid Terminal

1. Open **Unraid web interface**
2. Go to **Main** > **Terminal**
3. Navigate to your project directory:
   ```bash
   cd /mnt/user/appdata/contest-app
   ```

### Step 2: Update docker-compose.yml for Unraid

The provided `docker-compose.yml` is already optimized for Unraid with:
- ✅ Proper volume mappings to `/mnt/user/appdata/contest-app/`
- ✅ Health checks for service dependencies
- ✅ Environment variables for configuration
- ✅ Persistent data storage

### Step 3: Build and Deploy

```bash
# Build the containers
docker-compose build

# Start the application
docker-compose up -d

# Check status
docker-compose ps
```

### Step 4: Access Your Application

- **Frontend**: `http://YOUR-UNRAID-IP:3099`
- **Backend API**: `http://YOUR-UNRAID-IP:3001/api/health`

Replace `YOUR-UNRAID-IP` with your Unraid server's IP address (e.g., `192.168.1.100`)

---

## 🐳 Method 2: Individual Docker Containers (Alternative)

If you prefer using Unraid's Docker interface:

### Backend Container

1. Go to **Docker** tab in Unraid
2. Click **Add Container**
3. Configure:

**Container Settings:**
- **Name**: `contest-backend`
- **Repository**: `build from /mnt/user/appdata/contest-app/backend`
- **Network Type**: `bridge`

**Port Mappings:**
- **Host Port**: `3001`
- **Container Port**: `3001`

**Volume Mappings:**
- **Host Path**: `/mnt/user/appdata/contest-app/data`
- **Container Path**: `/app/data`
- **Host Path**: `/mnt/user/appdata/contest-app/uploads`
- **Container Path**: `/app/uploads`

**Environment Variables:**
- `NODE_ENV=production`
- `PORT=3001`

### Frontend Container

1. **Add another container**
2. Configure:

**Container Settings:**
- **Name**: `contest-frontend`
- **Repository**: `build from /mnt/user/appdata/contest-app/frontend`
- **Network Type**: `bridge`

**Port Mappings:**
- **Host Port**: `3099`
- **Container Port**: `80`

**Environment Variables:**
- `REACT_APP_API_URL=http://YOUR-UNRAID-IP:3001/api`

---

## 🔧 Configuration for Your Network

### Update API URL for Network Access

Create a `.env` file in your project root:

```bash
# /mnt/user/appdata/contest-app/.env
REACT_APP_API_URL=http://YOUR-UNRAID-IP:3001/api
```

Then update your `docker-compose.yml`:

```yaml
frontend:
  # ... other settings ...
  env_file:
    - .env
  environment:
    - REACT_APP_API_URL=${REACT_APP_API_URL:-http://localhost:3001/api}
```

### Alternative: Direct IP Configuration

Update the docker-compose.yml frontend environment:

```yaml
frontend:
  environment:
    - REACT_APP_API_URL=http://192.168.1.100:3001/api  # Replace with your IP
```

---

## 🛡️ Reverse Proxy Setup (Optional)

For cleaner URLs and HTTPS, set up a reverse proxy:

### Using Nginx Proxy Manager

1. **Install Nginx Proxy Manager** from Community Applications
2. **Add Proxy Host**:
   - **Domain Name**: `contest.your-domain.com`
   - **Forward Hostname/IP**: `YOUR-UNRAID-IP`
   - **Forward Port**: `3099`
3. **Enable SSL** with Let's Encrypt

### Using Swag/Letsencrypt

Add this to your nginx config:

```nginx
server {
    listen 80;
    server_name contest.your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name contest.your-domain.com;

    # SSL configuration here

    location / {
        proxy_pass http://YOUR-UNRAID-IP:3099;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://YOUR-UNRAID-IP:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 📊 Monitoring & Maintenance

### Viewing Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

### Updating the Application

```bash
cd /mnt/user/appdata/contest-app

# Pull latest changes (if using git)
git pull

# Rebuild and restart
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Backing Up Data

```bash
# Create backup
cd /mnt/user/appdata/contest-app
tar -czf contest-backup-$(date +%Y%m%d).tar.gz data/ uploads/

# Or use Unraid's built-in backup tools
```

---

## 🔧 Troubleshooting

### Container Won't Start

```bash
# Check logs
docker-compose logs

# Remove and rebuild
docker-compose down
docker system prune -f
docker-compose build --no-cache
docker-compose up -d
```

### Can't Access from Other Devices

1. **Check Unraid firewall** settings
2. **Verify port mappings** in Docker containers
3. **Ensure devices are on same network**
4. **Test direct IP access**: `http://UNRAID-IP:3099`

### Database Issues

```bash
# Check database file permissions
ls -la /mnt/user/appdata/contest-app/data/

# Reset database (WARNING: Deletes all data)
rm /mnt/user/appdata/contest-app/data/contest.db
docker-compose restart backend
```

### Frontend Can't Connect to Backend

1. **Verify backend is running**:
   ```bash
   curl http://YOUR-UNRAID-IP:3001/api/health
   ```

2. **Check API URL** in frontend environment variables

3. **Verify network connectivity** between containers

---

## 🚀 Production Optimizations

### Resource Limits

Add to your `docker-compose.yml`:

```yaml
backend:
  deploy:
    resources:
      limits:
        cpus: '1.0'
        memory: 512M

frontend:
  deploy:
    resources:
      limits:
        cpus: '0.5'
        memory: 256M
```

### Auto-Start with Unraid

Set containers to **auto-start** in Docker settings:
- Backend: **Enable** auto-start
- Frontend: **Enable** auto-start

### Scheduled Backups

Create a User Script in Unraid:

```bash
#!/bin/bash
cd /mnt/user/appdata/contest-app
tar -czf /mnt/user/Backups/contest-backup-$(date +%Y%m%d-%H%M).tar.gz data/ uploads/
find /mnt/user/Backups/contest-backup-* -mtime +30 -delete  # Keep 30 days
```

---

## 🎉 You're Ready!

Your PDXmas Contest App is now running on Unraid!

**Access URLs:**
- **Contest App**: `http://YOUR-UNRAID-IP:3099`
- **API Health**: `http://YOUR-UNRAID-IP:3001/api/health`

**Admin Access:**
- Navigate to **Results** tab
- Enter password: `pdxmas2025`
- Use tabbed interface to manage entries and voters

**Quick Commands:**
```bash
# Status check
docker-compose ps

# View logs
docker-compose logs -f

# Restart services
docker-compose restart

# Stop everything
docker-compose down

# Start everything
docker-compose up -d
```

Enjoy your holiday contest! 🎄❄️🎁
