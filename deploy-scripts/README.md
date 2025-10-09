# PDXmas Contest App - Deployment Scripts

This directory contains all the scripts needed for automated deployment from Gitea to Unraid.

## 🚀 Quick Start

### 1. Validate Your Setup
```bash
./validate-deployment.sh
```

### 2. Set Up Unraid Server (run on Unraid)
```bash
./setup-unraid.sh
```

### 3. Generate SSH Keys (run locally/on Gitea server)
```bash
./generate-ssh-keys.sh
```

### 4. Configure Gitea Secrets
- Go to your repository → Settings → Secrets → Actions
- Add the secrets shown by the SSH key generation script

### 5. Push to Deploy
```bash
git push origin main
```

## 📁 Script Overview

| Script | Purpose | Run On | When |
|--------|---------|---------|------|
| `validate-deployment.sh` | Check setup before deployment | Local | Before first deployment |
| `setup-unraid.sh` | Prepare Unraid server | Unraid | Once, before first deployment |
| `generate-ssh-keys.sh` | Create SSH keys for deployment | Local/Gitea | Once, before first deployment |
| `deploy.sh` | Main deployment script | Unraid | Automatically via Gitea Actions |
| `rollback.sh` | Rollback to previous version | Unraid | When needed |
| `monitor.sh` | Health monitoring and status | Unraid | Ongoing maintenance |

## 🔄 Deployment Flow

```
Developer pushes to main
        ↓
Gitea Actions triggered
        ↓
Build & test application
        ↓
Create Docker images
        ↓
Transfer to Unraid via SSH
        ↓
Run deploy.sh on Unraid
        ↓
Health checks & validation
        ↓
Deployment complete! 🎉
```

## 🛠️ Manual Operations

### On Unraid Server

```bash
cd /mnt/user/appdata/contest-app

# Application status
./deploy-scripts/monitor.sh status

# View logs
./deploy-scripts/monitor.sh logs
docker-compose logs -f

# Manual deployment
./deploy-scripts/deploy.sh

# Rollback if needed
./deploy-scripts/rollback.sh

# Health monitoring
./deploy-scripts/monitor.sh monitor
```

### Docker Operations

```bash
cd /mnt/user/appdata/contest-app

# View services
docker-compose ps

# Restart services
docker-compose restart

# Full restart
docker-compose down && docker-compose up -d

# View resource usage
docker stats

# Clean up old images
docker image prune -f
```

## 🔧 Configuration Files

### Generated on Unraid:
- `/mnt/user/appdata/contest-app/.env.production` - Environment variables
- `/mnt/user/appdata/contest-app/deployment-info.txt` - Setup information

### Required in Repository:
- `.gitea/workflows/deploy.yml` - Gitea Actions workflow
- `docker-compose.yml` - Service definitions
- `backend/Dockerfile` - Backend container build
- `frontend/Dockerfile` - Frontend container build

## 🔍 Troubleshooting

### Common Issues:

1. **SSH Connection Failed**
   ```bash
   # Test SSH manually:
   ssh root@YOUR_UNRAID_IP

   # Check public key on Unraid:
   cat /root/.ssh/authorized_keys
   ```

2. **Deployment Fails**
   ```bash
   # Check logs:
   ./monitor.sh logs

   # Try manual deployment:
   ./deploy.sh
   ```

3. **Services Won't Start**
   ```bash
   # Check status:
   docker-compose ps

   # View service logs:
   docker-compose logs backend
   docker-compose logs frontend
   ```

4. **Out of Disk Space**
   ```bash
   # Check space:
   df -h /mnt/user/appdata/contest-app

   # Clean up:
   docker system prune -f
   ```

### Getting Help:

1. Run `./validate-deployment.sh` to check setup
2. Check `./monitor.sh status` for current state
3. Review deployment logs in Gitea Actions
4. See main `DEPLOYMENT.md` for detailed troubleshooting

## 📱 Application URLs

After successful deployment:

- **Frontend**: `http://YOUR_UNRAID_IP:3099`
- **Backend API**: `http://YOUR_UNRAID_IP:3001/api/health`
- **Admin Panel**: Frontend → Results tab (password: `pdxmas2025`)

## 🔒 Security Notes

- SSH keys are used for secure deployment
- Private keys should only be stored in Gitea secrets
- Consider using VPN for Gitea ↔ Unraid communication
- Regular key rotation recommended

## 📊 Monitoring

### Health Checks:
```bash
# Full health check:
./monitor.sh monitor

# Quick status:
./monitor.sh status

# Recent logs:
./monitor.sh logs
```

### Automated Monitoring:
Add to root crontab for continuous monitoring:
```bash
# Check every 5 minutes:
*/5 * * * * /mnt/user/appdata/contest-app/deploy-scripts/monitor.sh monitor
```

---

🎄 **Happy Holidays!** ❄️

For detailed setup instructions, see the main [DEPLOYMENT.md](../DEPLOYMENT.md) file.
