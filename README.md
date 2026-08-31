<div align="center">

# 🛡️ DaliBackup-OSS
### Sovereign, Lightweight Backup, Replication & Disaster Recovery Engine for Microsoft Hyper-V, Proxmox VE & IMAP

[![Release](https://img.shields.io/badge/Release-v1.0.0--OSS-008542?style=for-the-badge&logo=github)](https://github.com/daliranas/DaliBackup-OSS/releases)
[![CI/CD Pipeline](https://img.shields.io/github/actions/workflow/status/daliranas/DaliBackup-OSS/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI%2FCD)](https://github.com/daliranas/DaliBackup-OSS/actions)
[![Docker Pulls](https://img.shields.io/docker/pulls/blanguedoc/dalibackup-oss?style=for-the-badge&logo=docker&logoColor=white)](https://hub.docker.com/r/blanguedoc/dalibackup-oss)
[![Docker Image Size](https://img.shields.io/badge/Docker%20Image-64.7%20MB-success?style=for-the-badge&logo=docker)](https://hub.docker.com/r/blanguedoc/dalibackup-oss)
[![Snyk Security](https://img.shields.io/badge/Security-Snyk%20Scanned-4C158A?style=for-the-badge&logo=snyk&logoColor=white)](https://snyk.io/)
[![License](https://img.shields.io/badge/License-DaliBackup%20OSS-blue?style=for-the-badge)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x%20%7C%2022.x-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)

<br/>

**DaliBackup-OSS** is a free, self-hosted, lightweight, and sovereign open-source backup and disaster recovery platform.  
Engineered for **Sysadmins, MSPs, DevOps, and Homelabers**, it delivers native, application-consistent protection for **Microsoft Hyper-V (Windows Server & Desktop)**, **Proxmox VE (QEMU KVM & LXC)**, and **Universal IMAP Mailboxes**, with instant streaming directly to **NFS / Local POSIX Mounts**, **SFTP (SSH)**, and **FTP/FTPS**.

[🌐 Live Documentation](https://daliranas.github.io/DaliBackup-OSS/) · [🐳 Docker Hub](https://hub.docker.com/r/blanguedoc/dalibackup-oss) · [🤝 Contributing](./CONTRIBUTING.md) · [🐛 Report Bug](https://github.com/daliranas/DaliBackup-OSS/issues) · [💡 Request Feature](https://github.com/daliranas/DaliBackup-OSS/issues) · [🏢 Official Website](https://daliranas.fr)

</div>

---

## 📑 Table of Contents

- [Why DaliBackup-OSS?](#-why-dalibackup-oss)
- [Feature Comparison (vs. Veeam & Proxmox Backup Server)](#-feature-comparison)
- [Key Architectural Pillars](#-key-architectural-pillars)
- [System Architecture Topology](#-system-architecture-topology)
- [Quick Start with Docker Compose](#-quick-start-with-docker-compose)
- [Native Bare-Metal Installation](#-native-bare-metal-installation)
- [Hyper-V Agent Deployment (Windows)](#-hyper-v-agent-deployment-windows)
- [Proxmox VE vzdump Integration](#-proxmox-ve-vzdump-integration)
- [IMAP Mailbox Protection](#-imap-mailbox-protection)
- [REST API Reference](#-rest-api-reference)
- [Automated Test Suite & Verification](#-automated-test-suite--verification)
- [Frequently Asked Questions (FAQ)](#-frequently-asked-questions-faq)
- [Legal, Authorship & License](#-legal-authorship--license)

---

## 💡 Why DaliBackup-OSS?

Traditional enterprise backup solutions are often **heavy, memory-hungry, locked behind expensive licensing paywalls**, or require complex multi-node database clusters (PostgreSQL, MariaDB, Redis, MinIO).

DaliBackup-OSS was designed from the ground up to solve these problems:
* **Zero Infrastructure Overhead** : Uses Node.js 22 LTS with embedded, synchronous SQLite (`DatabaseSync`), booting up in **< 200ms** and consuming **< 80 MB of RAM**.
* **Zero Paywall & Single-User Sovereignty** : 100% free of licensing counters, paywalls, and telemetry.
* **Universal Hypervisor & Mail Support** : Back up your Windows Hyper-V clusters, Linux Proxmox VE nodes, and IMAP servers from a unified, modern web console.
* **Instant Disaster Recovery** : 1-click restore to new VM (sandbox/SureBoot) or in-place raw disk overwrite.

---

## ⚖️ Feature Comparison

| Feature / Capability | 🛡️ **DaliBackup-OSS** | 🏢 **Veeam Community** | 📦 **Proxmox Backup Server (PBS)** |
| :--- | :---: | :---: | :---: |
| **Pricing / License** | **100% Free Open Source** | Free (Max 10 instances) | Free Open Source |
| **Microsoft Hyper-V Native (VSS & RCT)** | ✅ **Yes (Uncapped)** | ✅ Yes (Limited to 10 VMs) | ❌ No (Proxmox Only) |
| **Proxmox VE (QEMU & LXC Containers)** | ✅ **Yes** | ❌ No native LXC support | ✅ Yes |
| **IMAP Mailbox Incremental Backup** | ✅ **Yes (Built-in)** | ❌ No (Requires M365 plugin) | ❌ No |
| **Footprint / Memory Usage** | ⚡ **< 80 MB RAM** | 🐘 > 4 GB - 8 GB RAM | ⚖️ ~500 MB - 1 GB RAM |
| **Database Dependency** | 🍃 **Embedded SQLite** | 🐘 MS SQL / PostgreSQL | 🍃 Rust Datastore |
| **Storage Targets** | **POSIX / NFS / SFTP / FTPS** | SMB / Hardened Repo / S3 | Dedicated PBS Datastore |
| **Zero-Lock-in GZip Tarballs** | ✅ **Yes (Standard format)** | ❌ Proprietary `.vbk` / `.vib` | ❌ Chunked index format |
| **Docker-Ready Single Container** | ✅ **Yes (64 MB Image)** | ❌ Windows VM Required | ❌ Debian/PVE Host Required |

---

## 🌟 Key Architectural Pillars

<table>
<tr>
<td width="50%" valign="top">

### ⚡ Ultra-Lightweight & Zero-Bloat
- **Embedded Synchronous SQLite** (`node:sqlite` `DatabaseSync`) : Zero external database processes.
- **Single Binary / Docker Image** : Ready to deploy via Docker, Docker Compose, or systemd in under 60 seconds.
- **Hardware Acceleration** : Stream-piped compression with minimal CPU overhead.

</td>
<td width="50%" valign="top">

### 🖥️ Native Hypervisors & Mail Engine
- **Microsoft Hyper-V Agent** : Application-consistent VSS snapshots, automatic root VHDX chain traversal, multi-disk support, and automatic temp snapshot pruning.
- **Proxmox VE Cluster Engine** : Direct Proxmox REST API 2.0 and `vzdump` hook integration.
- **Universal IMAP Sync** : Incremental email synchronization with UID state tracking.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📂 Multi-Protocol Sovereign Storage
- **NFS & Local Mounts** : High-throughput zero-copy stream writing to local or mounted storage pools.
- **SFTP (SSH v2)** : Secure encrypted remote transfers with password or SSH private key authentication.
- **FTP / FTPS (TLS)** : Standard and encrypted file server connectivity.

</td>
<td width="50%" valign="top">

### 🔒 Enterprise Security & CryptoVault
- **AES-256-GCM Cryptography** : Hypervisor credentials, passwords, and private keys encrypted at rest.
- **Atomic Claiming & Host Isolation** : Agent tasks are bound to hostname tokens to prevent cross-node interference.
- **Built-in Self-Signed / Custom SSL** : Dual HTTP (3000) and HTTPS (3443) listeners with automatic TLS certificate generation.

</td>
</tr>
</table>

---

## 🏗️ System Architecture Topology

```
                      ┌─────────────────────────────────────────────────────────┐
                      │              DaliBackup-OSS Control Plane               │
                      │                                                         │
                      │   [ Express TypeScript Engine / HTTPS:3443 / HTTP:3000 ]│
                      │         │                           │                   │
                      │         ▼                           ▼                   │
                      │   Embedded SQLite             CryptoVault               │
                      │   (dalibackup.db)          (AES-256-GCM at Rest)        │
                      └─────────┬───────────────────────────┬───────────────────┘
                                │                           │
         ┌──────────────────────┼───────────────────────────┼──────────────────────┐
         │                      │                           │                      │
         ▼                      ▼                           ▼                      ▼
┌──────────────────┐   ┌──────────────────┐        ┌──────────────────┐   ┌──────────────────┐
│ Microsoft        │   │ Proxmox VE       │        │ Universal IMAP   │   │ Target Storage   │
│ Hyper-V Server   │   │ Cluster / Node   │        │ Mailboxes        │   │ Destinations     │
│                  │   │                  │        │                  │   │                  │
│ • VSS Snapshots  │   │ • QEMU KVM VMs   │        │ • UID Sync State │   │ • NFS / Local    │
│ • VHDX Streaming │   │ • LXC Containers │        │ • GZip Tarballs  │   │ • SFTP (SSH Key) │
│ • Service Daemon │   │ • vzdump Hook    │        │ • SSL/TLS (993)  │   │ • FTP / FTPS     │
└──────────────────┘   └──────────────────┘        └──────────────────┘   └──────────────────┘
```

---

## 🚀 Quick Start with Docker Compose

The fastest way to deploy DaliBackup-OSS is via Docker Compose :

```yaml
version: '3.8'

services:
  dalibackup:
    image: blanguedoc/dalibackup-oss:latest
    container_name: dalibackup-oss
    restart: always
    ports:
      - "3000:3000"   # HTTP Console
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

```bash
docker-compose up -d
```
Open your browser at **`https://localhost:3443`** (or `http://localhost:3000`).

---

## 💻 Hyper-V Agent Deployment (Windows)

DaliBackup-OSS provides dedicated PowerShell automation agents located in [`agents/hyperv/`](./agents/hyperv/) :

### 1. Install as a Background Windows Service (NSSM)
On your Hyper-V Host (Windows Server 2016/2019/2022/2025 or Windows 10/11 Pro) :

```powershell
# Run PowerShell as Administrator
cd C:\DaliBackup\agents\hyperv
.\Setup-NSSM-Service.ps1 -ServerUrl "https://backup.yourdomain.com" -ApiToken "YOUR_AGENT_TOKEN"
```

### 2. Standalone Interactive Daemon Mode
```powershell
.\HyperVBackupService.ps1 -ServerUrl "https://backup.yourdomain.com" -ApiToken "YOUR_AGENT_TOKEN" -PollIntervalSeconds 15
```

### 3. One-Click Disaster Recovery & Restore Agent
```powershell
# Restore as a New Sandbox VM (SureBoot Instant Validation)
.\HyperVRestoreAgent.ps1 -ServerUrl "https://backup.yourdomain.com" -ApiToken "YOUR_AGENT_TOKEN" -JobId "UUID" -RestoreMode "NEW_VM" -AutoStart

# Disaster Recovery: In-Place Disk Overwrite
.\HyperVRestoreAgent.ps1 -ServerUrl "https://backup.yourdomain.com" -ApiToken "YOUR_AGENT_TOKEN" -JobId "UUID" -RestoreMode "OVERWRITE_DISK"
```

---

## 🐧 Proxmox VE vzdump Integration

To trigger backup jobs and synchronize Proxmox VE backups with DaliBackup-OSS :

1. Copy [`agents/proxmox/vzdump-hook.sh`](./agents/proxmox/vzdump-hook.sh) to `/usr/local/bin/dalibackup-hook.sh` on your Proxmox node.
2. Edit `/etc/vzdump.conf` :
```ini
script: /usr/local/bin/dalibackup-hook.sh
```

---

## 📡 REST API Reference

All requests must provide authentication via `Authorization: Bearer <TOKEN>` (Admin JWT or Machine Token).

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Admin login, returns session JWT |
| `GET` | `/api/jobs` | Admin | List all configured backup jobs |
| `POST` | `/api/jobs` | Admin | Create schedule, hypervisor target & retention policy |
| `POST` | `/api/jobs/:id/run` | Admin | Trigger immediate backup execution (1-Click Run) |
| `GET` | `/api/restore-points` | Admin | List all backup archives and restore points |
| `POST` | `/api/restore-points/:id/restore` | Admin | Trigger disaster recovery / instant VM reconstruction |
| `GET` | `/api/hypervisors/agent/tasks` | Agent | Atomic claiming of pending backup and restore tasks |
| `POST` | `/api/hypervisors/agent/upload/:taskId` | Agent | Stream compressed VHDX disk byte stream |
| `GET` | `/api/health` | Public | System health check, uptime, and engine status |

---

## 🧪 Automated Test Suite & Verification

DaliBackup-OSS includes a comprehensive automated test suite verifying AES-256-GCM cryptography, atomic claiming, multi-disk idempotence, and VM manifest reconstruction :

```bash
npm test
```

```text
🧪 Démarrage de la suite de tests DaliBackup (Environnement 100% Isolé)...

1. Test CryptoVault (Chiffrement / Déchiffrement AES-256-GCM)...
   ✅ CryptoVault validé avec succès.
2. Test Sécurité Authentification & Tokens Dynamiques...
   ✅ Tokens dynamiques et JWT validés.
3. Test Claiming Atomique & Isolation Stricte par Hôte...
   ✅ Claiming atomique et isolation par hôte validés.
4. Test Moteur Hyper-V Multi-Disques & Idempotence de Re-téléversement...
   ✅ Multi-disques & Idempotence validés.
5. Test Nettoyage Automatique sur Échec Partiel (Anti-Fuite Stockage)...
   ✅ Purge automatique sur échec partiel validée.
6. Test Restauration Exacte avec Manifeste (Reconstruction Matérielle)...
   ✅ Pipeline de restauration exacte de VM validé.
7. Test Rétention Multi-Disques...
   ✅ Moteur de rétention multi-disques validé.
8. Test Moteur E-mail IMAP (CryptoVault, Sync State & Rétention)...
   ✅ Moteur E-mail IMAP validé avec succès.

🎉 TOUS LES TESTS SONT PASSÉS AVEC SUCCÈS ! (100% OK)
```

---

## ❓ Frequently Asked Questions (FAQ)

<details>
<summary><strong>Q: Is DaliBackup-OSS suitable as a free replacement for Veeam?</strong></summary>
<p>Yes. If you manage Microsoft Hyper-V or Proxmox VE environments and want a lightweight, zero-license backup system writing to NFS/SFTP/Local storage with VSS consistency and instant VM reconstruction, DaliBackup-OSS delivers native performance with zero paywalls.</p>
</details>

<details>
<summary><strong>Q: Does it support incremental Hyper-V backups?</strong></summary>
<p>Yes. DaliBackup-OSS leverages Resilient Change Tracking (RCT) and differential VHDX chain analysis to transfer only modified blocks.</p>
</details>

<details>
<summary><strong>Q: How are credentials and hypervisor tokens secured?</strong></summary>
<p>All sensitive credentials, API keys, passwords, and private keys are encrypted at rest using AES-256-GCM authenticated hardware encryption via the internal CryptoVault.</p>
</details>

<details>
<summary><strong>Q: What operating systems are supported for the server?</strong></summary>
<p>The server runs anywhere Docker or Node.js 20+/22+ LTS is available (Ubuntu, Debian, Alpine Linux, Red Hat Enterprise Linux, macOS, and Windows Subsystem for Linux).</p>
</details>

---

## 📜 Legal, Authorship & License

Developed with passion by **Bastien LANGUEDOC (Daliranas)**.  
Official Website : **[https://daliranas.fr](https://daliranas.fr)**

Distributed under the **DaliBackup OSS License** (Open Source Software Edition).  
Refer to [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE) for full terms.

> **Restrictions** : Strictly forbidden to sell, resell, or monetize this software in any commercial package. Preservation of project branding *DaliBackup* is mandatory.
