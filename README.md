<div align="center">

# 🛡️ DaliBackup-OSS
### Enterprise-Grade Sovereign Backup & Disaster Recovery Engine

[![Release](https://img.shields.io/badge/Release-v1.0.0--OSS-008542?style=for-the-badge&logo=github)](https://github.com/daliranas/DaliBackup-OSS)
[![License](https://img.shields.io/badge/License-DaliBackup%20OSS-blue?style=for-the-badge)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20.x%20%7C%2022.x-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?style=for-the-badge&logo=docker)](https://www.docker.com/)

<br/>

**DaliBackup-OSS** is an open-source, sovereign, lightweight, single-user backup, replication, and disaster recovery orchestration platform.  
Designed for sysadmins, DevOps, and enterprises managing **Microsoft Hyper-V**, **Proxmox VE (QEMU & LXC)**, and **IMAP Email Mailboxes**, writing directly to **POSIX/NFS**, **SFTP (SSH)**, and **FTP/FTPS** storage destinations.

[Explore Documentation](https://daliranas.fr) · [Report an Issue](https://github.com/daliranas/DaliBackup-OSS/issues) · [Official Website](https://daliranas.fr)

</div>

---

## 🌟 Executive Overview & Key Pillars

<table>
<tr>
<td width="50%" valign="top">

### ⚡ Ultra-Lightweight & Zero-Bloat
- **Zero Heavy Infrastructure** : Runs with embedded, synchronous SQLite (`DatabaseSync`), requiring **no** external MariaDB, Redis, or MinIO dependencies.
- **Single-User Zero-Trust Security** : Cleaned of all paywalls, licensing tiers, and multi-tenant overhead for an instant, friction-free deployment.
- **Self-Contained Single Binary / Container** : Fast start-up time (< 200ms) with minimal RAM footprint (< 80 Mo).

</td>
<td width="50%" valign="top">

### 🖥️ Native Hypervisors & Mailbox Protection
- **Microsoft Hyper-V Engine** : Continuous streaming GZip compression (`DaliStreamCompressor`), VSS application-consistent snapshots, multi-disk capture, and 1-click disaster recovery.
- **Proxmox VE QEMU & LXC Engine** : Direct integration via Proxmox REST API 2.0 and native `vzdump` hook orchestration.
- **Universal IMAP Mail Engine** : Incremental email synchronization with UID tracking and `.tar.gz` export.

</td>
</tr>
<tr>
<td width="50%" valign="top">

### 📂 Multi-Protocol Sovereign Storage
- **NFS & Local Mounts** : Direct POSIX high-throughput block writing with zero-copy stream piping.
- **SFTP (SSH v2)** : Encrypted transfers with password or SSH private key authentication.
- **FTP / FTPS** : Standard and TLS-encrypted file transfers.

</td>
<td width="50%" valign="top">

### 🔒 Enterprise Security & CryptoVault
- **AES-256-GCM Hardware Encryption** : Hypervisor API tokens, passwords, and private keys encrypted at rest.
- **Hardware-Isolated Agents** : Host-isolated atomic claiming preventing task cross-contamination.
- **Built-in Auto-Signed & Custom SSL** : Automatic HTTPS certificate generation and HTTPS enforcement (HTTP 308 redirect).

</td>
</tr>
</table>

---

## 🏗️ Architectural Topology

```
                      ┌─────────────────────────────────────────────────┐
                      │             DaliBackup-OSS Control Plane        │
                      │                                                 │
                      │   [ Express TypeScript REST API / HTTPS 3443 ]  │
                      │         │                   │                   │
                      │         ▼                   ▼                   │
                      │    Embedded SQLite    CryptoVault AES-256-GCM   │
                      │   (dalibackup.db)       (Secrets at Rest)       │
                      └────────┬────────────────────┬───────────────────┘
                               │                    │
        ┌──────────────────────┼────────────────────┼──────────────────────┐
        │                      │                    │                      │
        ▼                      ▼                    ▼                      ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Microsoft        │ │ Proxmox VE       │ │ IMAP Mailboxes   │ │ Target Storage   │
│ Hyper-V Server   │ │ Cluster / Node   │ │ (Universal IMAP) │ │ Destinations     │
│                  │ │                  │ │                  │ │                  │
│ • VSS Snapshots  │ │ • QEMU KVM VMs   │ │ • UID Sync State │ │ • NFS / Local    │
│ • VHDX Streaming │ │ • LXC Containers │ │ • GZip Tarball   │ │ • SFTP (SSH key) │
│ • Service Daemon │ │ • vzdump Hook    │ │ • SSL/TLS 993    │ │ • FTP / FTPS     │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
```

---

## 🚀 Quick Start & Deployment

### Method 1: Instant Docker Compose (Recommended)

```bash
# 1. Clone the repository
git clone git@github.com:daliranas/DaliBackup-OSS.git
cd DaliBackup-OSS

# 2. Launch the container stack
docker-compose up -d --build
```
Access the modern Web Console at **`https://localhost:3443`** (or `http://localhost:3000`).

---

### Method 2: Native Node.js Deployment

#### Prerequisites
- **Node.js** >= 20.x or 22.x LTS
- **npm** >= 9.x

```bash
# 1. Clone & install dependencies
git clone git@github.com:daliranas/DaliBackup-OSS.git
cd DaliBackup-OSS
npm install

# 2. Configure environment variables
cp .env.example .env

# 3. Build & launch
npm run build
npm start
```

---

### Method 3: Linux Systemd Service Installation

Create `/etc/systemd/system/dalibackup-oss.service` :

```ini
[Unit]
Description=DaliBackup OSS Sovereign Engine
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/dalibackup-oss
ExecStart=/usr/bin/node dist/server.js
Restart=always
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=3000
Environment=SSL_PORT=3443

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now dalibackup-oss.service
```

---

## 💻 Hyper-V Agent & Windows Service Deployment

DaliBackup-OSS provides dedicated PowerShell automation agents in [`agents/hyperv/`](./agents/hyperv/) :

### 1. Permanent Windows Service Installation (NSSM)
On your Microsoft Hyper-V host (Windows Server 2016 / 2019 / 2022 / 2025) :

```powershell
# Open PowerShell as Administrator
cd C:\DaliBackup\agents\hyperv
.\Setup-NSSM-Service.ps1 -ServerUrl "https://backup.daliranas.fr" -ApiToken "YOUR_AGENT_TOKEN"
```

### 2. Standalone Interactive Service Daemon
```powershell
.\HyperVBackupService.ps1 -ServerUrl "https://backup.daliranas.fr" -ApiToken "YOUR_AGENT_TOKEN" -PollIntervalSeconds 15
```

### 3. One-Click Disaster Recovery & Restore
```powershell
# Restore as a New VM (Sandbox / SureBoot)
.\HyperVRestoreAgent.ps1 -ServerUrl "https://backup.daliranas.fr" -ApiToken "YOUR_AGENT_TOKEN" -JobId "JOB_UUID" -RestoreMode "NEW_VM" -AutoStart

# Disaster Recovery: In-Place Disk Overwrite
.\HyperVRestoreAgent.ps1 -ServerUrl "https://backup.daliranas.fr" -ApiToken "YOUR_AGENT_TOKEN" -JobId "JOB_UUID" -RestoreMode "OVERWRITE_DISK"
```

---

## 📡 REST API Reference

All requests must include the header `Authorization: Bearer <TOKEN>` (Admin JWT or Agent Machine Token).

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Authenticate admin user and receive JWT session |
| `GET` | `/api/jobs` | Admin | List all configured backup jobs across hypervisors and mail |
| `POST` | `/api/jobs` | Admin | Create a new backup schedule & retention policy |
| `POST` | `/api/jobs/:id/run` | Admin | Trigger immediate backup execution (1-Click Run) |
| `GET` | `/api/restore-points` | Admin | List all backup archives and restore points |
| `POST` | `/api/restore-points/:id/restore` | Admin | Trigger disaster recovery / instant VM reconstruction |
| `GET` | `/api/hypervisors/agent/tasks` | Agent | Atomic claiming of pending backup and restore tasks |
| `POST` | `/api/hypervisors/agent/upload/:taskId` | Agent | Stream raw compressed VHDX disk byte streams |
| `GET` | `/api/health` | Public | System health check and engine status |

---

## 🧪 Automated Test Suite & Verification

DaliBackup-OSS includes an end-to-end automated test suite verifying AES-256-GCM cryptography, atomic claiming, multi-disk idempotence, and VM manifest reconstruction :

```bash
npx ts-node tests/runTests.ts
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

## 🛡️ Security & Compliance

- **Zero-Trust Network Isolation** : Hostnames strictly bound to tasks to prevent rogue agent claiming.
- **Shannon Entropy Analysis Ready** : Designed for uncompressed / pre-compressed ransomware anomaly detection.
- **Data Protection at Rest** : Secrets never written in plaintext to SQLite.

---

## 📜 Legal, Authorship & License

Developed with passion by **Bastien LANGUEDOC (Daliranas)**.  
Official Website : **[https://daliranas.fr](https://daliranas.fr)**

Distributed under the **DaliBackup OSS License** (Open Source Software Edition).  
Refer to [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE) for full terms.

> **Restrictions** : Strictly forbidden to sell, resell, or monetize this software in any commercial package. Preservation of project branding *DaliBackup* is mandatory.
