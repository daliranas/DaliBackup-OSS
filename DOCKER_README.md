<div align="center">
  <img src="https://raw.githubusercontent.com/daliranas/DaliBackup-OSS/main/public/logo.svg" width="90" height="90" alt="DaliBackup-OSS Logo" />
  <h2>DaliBackup-OSS</h2>
  <p><strong>Sovereign Backup, Replication & Disaster Recovery Engine</strong></p>

[![Docker Hub](https://img.shields.io/badge/Docker%20Hub-blanguedoc%2Fdalibackup--oss-2496ED?style=flat-square&logo=docker&logoColor=white)](https://hub.docker.com/r/blanguedoc/dalibackup-oss)
[![Docker Image Size](https://img.shields.io/badge/Image%20Size-64.7%20MB-success?style=flat-square&logo=docker)](https://hub.docker.com/r/blanguedoc/dalibackup-oss)
[![License](https://img.shields.io/badge/License-DaliBackup%20OSS-blue?style=flat-square)](https://github.com/daliranas/DaliBackup-OSS)
</div>

**DaliBackup-OSS** is a lightweight, single-user, sovereign backup and disaster recovery orchestration platform.  
Engineered for sysadmins, DevOps, and businesses managing **Microsoft Hyper-V**, **Proxmox VE (QEMU & LXC)**, and **IMAP Mailboxes**, with zero external database dependencies (embedded SQLite `DatabaseSync`).

Official Website: **[https://daliranas.fr](https://daliranas.fr)** · GitHub: **[daliranas/DaliBackup-OSS](https://github.com/daliranas/DaliBackup-OSS)**

---

## 🚀 Quick Start (1-Click Run)

```bash
docker run -d \
  --name dalibackup-oss \
  --restart always \
  -p 3000:3000 \
  -p 3443:3443 \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/backups:/var/backups/dalibackup \
  blanguedoc/dalibackup-oss:latest
```

Access the Web Console immediately at **`https://localhost:3443`** (or `http://localhost:3000`).

---

## 🐳 Docker Compose Deployment

```yaml
version: '3.8'

services:
  dalibackup:
    image: daliranas/dalibackup-oss:latest
    container_name: dalibackup-oss
    restart: always
    ports:
      - "3000:3000"   # HTTP Console & HTTPS Redirection
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
```

---

## 🌟 Key Highlights & Architectural Pillars

- **🚀 Ultra-Lightweight** : Runs on Node.js 22 LTS with native embedded SQLite. Zero heavy MariaDB, Redis, or MinIO required.
- **🖥️ Microsoft Hyper-V Engine** : Continuous streaming GZip compression (`DaliStreamCompressor`), VSS application-consistent checkpoints, multi-disk capture, and instant disaster recovery.
- **🐧 Proxmox VE Integration** : QEMU VM and LXC container backup via Proxmox REST API 2.0 and native `vzdump` hook.
- **📬 Universal IMAP Email Sync** : Incremental email synchronization with UID tracking and `.tar.gz` export.
- **💾 Multi-Protocol Storage** : Direct high-throughput writing to POSIX/NFS mounts, SFTP (SSH key/password) and FTP/FTPS.
- **🔒 Zero-Trust Security** : AES-256-GCM hardware encryption for secrets at rest and machine-bound agent tokens.

---

## 📁 Persistent Storage Volumes

| Container Path | Host Recommended Path | Description |
| :--- | :--- | :--- |
| `/app/data` | `./data` | SQLite database (`dalibackup.db`), CryptoVault keys, and SSL certs. |
| `/var/backups/dalibackup` | `./backups` or `/mnt/nfs` | Local backup repository and NFS mount point. |

---

## ⚙️ Environment Variables Reference

| Variable | Default | Description |
| :--- | :--- | :--- |
| `PORT` | `3000` | HTTP Web Console port (redirects to HTTPS). |
| `SSL_PORT` | `3443` | Native HTTPS Web Console & Agent REST API port. |
| `SSL_ENABLED` | `true` | Enables built-in auto-signed or custom SSL certificates. |
| `DATABASE_FILE` | `/app/data/dalibackup.db` | Absolute path to the SQLite database file. |
| `DEFAULT_LOCAL_STORAGE_PATH` | `/var/backups/dalibackup` | Default local/NFS repository directory. |
| `TZ` | `Europe/Paris` | Container timezone for backup cron schedules. |

---

## 📜 Authorship & Legal Notice

Developed with passion by **Bastien LANGUEDOC (Daliranas)**.  
Official Website : **[https://daliranas.fr](https://daliranas.fr)**  
GitHub Repository : **[https://github.com/daliranas/DaliBackup-OSS](https://github.com/daliranas/DaliBackup-OSS)**

*Distributed under the DaliBackup Open Source Software License.*
