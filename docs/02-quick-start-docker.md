# 🐳 Quick Start & Docker Deployment — DaliBackup-OSS

## 1. 1-Click Run via Docker Hub

To launch DaliBackup-OSS immediately without cloning the repository:

```bash
docker run -d \
  --name dalibackup-oss \
  --restart always \
  -p 3000:3000 \
  -p 3443:3443 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/backups:/var/backups/dalibackup \
  ghcr.io/daliranas/dalibackup-oss:latest
```

## 2. Docker Compose Setup (Recommended for Production)

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  dalibackup:
    image: ghcr.io/daliranas/dalibackup-oss:latest
    container_name: dalibackup-oss
    restart: always
    ports:
      - "3000:3000"   # HTTP Console & HTTPS 308 Redirection
      - "3443:3443"   # HTTPS Console & Secure Agent API
    environment:
      - NODE_ENV=production
      - PORT=3000
      - SSL_PORT=3443
      - SSL_ENABLED=true
      - DATABASE_FILE=/app/data/dalibackup.db
      - DEFAULT_LOCAL_STORAGE_PATH=/var/backups/dalibackup
      - TZ=Europe/Paris
    volumes:
      - ./data:/app/data
      - ./backups:/var/backups/dalibackup
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s
```

Run the container:
```bash
docker-compose up -d
```

## 3. Initial Setup Wizard
1. Open your browser at `https://<YOUR_SERVER_IP>:3443` (accept self-signed certificate on initial boot).
2. Configure your Single-User Admin username and password.
3. Configure your initial storage repository (Local / NFS / SFTP).
4. The system is ready to backup Hyper-V, Proxmox VE, and IMAP mailboxes!
