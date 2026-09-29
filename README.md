<div align="center">

> Validation status and deployment limitations: [Operational readiness](docs/READINESS.md).
> In particular, incremental Hyper-V RCT is not yet wired into the OSS worker end to end.

# 🛡️ DaliBackup-OSS
### Sovereign, Lightweight Backup, Replication & Disaster Recovery Engine for Microsoft Hyper-V, Proxmox VE & IMAP

[![Release](https://img.shields.io/github/v/release/daliranas/DaliBackup-OSS?style=for-the-badge)](https://github.com/daliranas/DaliBackup-OSS/releases)
[![CI/CD Pipeline](https://img.shields.io/github/actions/workflow/status/daliranas/DaliBackup-OSS/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI%2FCD)](https://github.com/daliranas/DaliBackup-OSS/actions)
[![Docker Pulls](https://img.shields.io/docker/pulls/blanguedoc/dalibackup-oss?style=for-the-badge&logo=docker&logoColor=white)](https://hub.docker.com/r/blanguedoc/dalibackup-oss)
[![Snyk Security](https://img.shields.io/badge/Security-Snyk%20Scanned-4C158A?style=for-the-badge&logo=snyk&logoColor=white)](https://snyk.io/)
[![License](https://img.shields.io/badge/License-DaliBackup%20OSS-blue?style=for-the-badge)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x%20%7C%2024.x-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)

<br/>

**DaliBackup-OSS** is a free, self-hosted, lightweight, and sovereign open-source backup and disaster recovery platform.  
For **Sysadmins, MSPs, DevOps, and Homelabers**, it provides backup workflows for **Microsoft Hyper-V**, **Proxmox VE (QEMU/KVM & LXC)** and **IMAP**, with **local/NFS, mounted SMB, SFTP, FTP/FTPS and S3-compatible storage**. Real-hypervisor recovery and provider acceptance tests remain required before production use.

[🌐 Live Documentation](https://daliranas.github.io/DaliBackup-OSS/) · [🐳 Docker Hub](https://hub.docker.com/r/blanguedoc/dalibackup-oss) · [🤝 Contributing](./CONTRIBUTING.md) · [🐛 Report Bug](https://github.com/daliranas/DaliBackup-OSS/issues) · [💡 Request Feature](https://github.com/daliranas/DaliBackup-OSS/issues) · [🏢 Official Website](https://daliranas.fr)

</div>

---

## 📑 Table of Contents

- [v1.1.0 scope and limitations](#v110-scope-and-limitations)

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

## v1.1.0 scope and limitations

See the [changelog and upgrade instructions](CHANGELOG.md) and
[readiness report](docs/READINESS.md). This upgrade focuses on storage reliability,
S3, mounted SMB, explicit FTPS, safe restoration and cross-platform startup.

- CI tests the server on Windows, Linux and macOS with Node.js 22/24.
- Docker, VM and bare-metal installation paths are available. LXC deployments
  require correct persistent mounts and permissions. K8s/K3s manifests and
  deployment acceptance tests are not delivered in this release.
- Hyper-V OSS backups are full gzip-compressed disks. End-to-end RCT incremental
  backup and full-plus-delta restoration to a selected date are **not implemented**.
- MariaDB, PostgreSQL, SQLite, MSSQL and MongoDB application backup connectors are
  **not implemented**; embedded SQLite is the server's catalog, not a backup connector.
- Mandatory compression across every backup path is not yet guaranteed.
- Large remote transfers, real Hyper-V recovery and Windows service deployment
  still need acceptance testing; CI is not proof of production recoverability.

### Storage configuration

SMB/NFS must be mounted by the OS; SMB also accepts a Windows UNC path accessible
to the service account. The server does not mount shares or negotiate SMB credentials.

For S3, set `remote_path` to `bucket/prefix`, `host` to an optional custom endpoint,
`username` to access key ID and `password` to secret key. Set `AWS_REGION`
(default `us-east-1`). Omit the endpoint for AWS. Use your account/region endpoint
for OVHcloud or Cloudflare R2. Bastivan Consulting's requested endpoint is
`https://fr-mar1-s3.bastivan.consulting`. Individual cloud providers are not certified
by this release: test write/read/list/delete and restoration with your credentials.

## 💡 Why DaliBackup-OSS?

Traditional enterprise backup solutions are often **heavy, memory-hungry, locked behind expensive licensing paywalls**, or require complex multi-node database clusters (PostgreSQL, MariaDB, Redis, MinIO).

DaliBackup-OSS was designed from the ground up to solve these problems:
* **Embedded Catalog** : Node.js with synchronous SQLite (`DatabaseSync`), without an external database server.
* **Zero Paywall & Single-User Sovereignty** : 100% free of licensing counters, paywalls, and telemetry.
* **Universal Hypervisor & Mail Support** : Back up your Windows Hyper-V clusters, Linux Proxmox VE nodes, and IMAP servers from a unified, modern web console.
* **Recovery Workflows** : Backup catalog and agent restore tasks. Validate an isolated test restore before relying on them.

---

## ⚖️ Feature Comparison

The historical comparison below is not a current assessment of other products.
DaliBackup's supported scope is defined above and in the readiness report.

| Feature / Capability | 🛡️ **DaliBackup-OSS** | 🏢 **Veeam Community** | 📦 **Proxmox Backup Server (PBS)** |
| :--- | :---: | :---: | :---: |
| **Pricing / License** | **100% Free Open Source** | Free (Max 10 instances) | Free Open Source |
| **Microsoft Hyper-V Native (VSS & RCT)** | Full disks; RCT incomplete | See vendor documentation | See vendor documentation |
| **Proxmox VE (QEMU & LXC Containers)** | ✅ **Yes** | ❌ No native LXC support | ✅ Yes |
| **IMAP Mailbox Incremental Backup** | ✅ **Yes (Built-in)** | ❌ No (Requires M365 plugin) | ❌ No |
| **Footprint / Memory Usage** | Workload-dependent; benchmark required | See vendor documentation | See vendor documentation |
| **Database Dependency** | 🍃 **Embedded SQLite** | 🐘 MS SQL / PostgreSQL | 🍃 Rust Datastore |
| **Storage Targets** | **Local / NFS / mounted SMB / SFTP / FTP(S) / S3** | See vendor documentation | See vendor documentation |
| **Zero-Lock-in GZip Tarballs** | ✅ **Yes (Standard format)** | ❌ Proprietary `.vbk` / `.vib` | ❌ Chunked index format |
| **Docker-Ready Single Container** | Dockerfile supplied | See vendor documentation | See vendor documentation |

---

## 🌟 Key Architectural Pillars

<table>
<tr>
<td width="50%" valign="top">

### ⚡ Ultra-Lightweight & Zero-Bloat
- **Embedded Synchronous SQLite** (`node:sqlite` `DatabaseSync`) : Zero external database processes.
- **Node.js / Docker** : Native installation or Docker Compose; the server archive is not a self-contained binary.
- **Streaming Compression** : Full Hyper-V disks are gzip-compressed; CPU and bandwidth depend on workload.

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
- **S3-compatible** : AWS SDK multipart uploads, streaming downloads, paginated listing and deletion.
- **SMB** : OS-mounted shares or Windows UNC paths under the server account.

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

## 💻 Native Bare-Metal Installation

Install Node.js 22 or 24, download the release source/archive, then run:

```bash
npm ci
npm run build
```

Copy `.env.example` to `.env`, replace all example passwords and tokens, configure
persistent database and backup paths, then run `npm start`. Complete initial setup
on a trusted network. Configure trusted TLS before connecting remote agents.
Back up the database, configuration, encryption material and repositories before
upgrades; keep a matching application/database snapshot for rollback.

## 💻 Hyper-V Agent Deployment (Windows)

DaliBackup-OSS provides dedicated PowerShell automation agents located in [`agents/hyperv/`](./agents/hyperv/) :

### 1. Install as a Background Scheduled Task
On your Hyper-V Host (Windows Server 2016/2019/2022/2025 or Windows 10/11 Pro) :

```powershell
# Run PowerShell as Administrator
cd C:\DaliBackup\agents\hyperv
.\Install-DaliBackupService.ps1 -ApiUrl "https://backup.yourdomain.com:3443" -ApiToken "YOUR_AGENT_TOKEN"
```

### 2. Standalone Interactive Daemon Mode
```powershell
.\DaliAgent-HyperV.ps1 -ServerUrl "https://backup.yourdomain.com:3443" -ApiToken "YOUR_AGENT_TOKEN" -Action worker -PollIntervalSeconds 15
```

### 3. Restore validation

Trust the server certificate, protect tokens with filesystem ACLs, and trigger
restore tasks from the console/API using the OSS worker above. Validate a disposable
VM on an isolated network. Allow temporary capacity for differencing-disk flattening.
Legacy RCT/multipart scripts target a different API contract; do not treat them as
working OSS incremental backup support.

---

## 🐧 Proxmox VE vzdump Integration

To trigger backup jobs and synchronize Proxmox VE backups with DaliBackup-OSS :

1. Copy [`agents/proxmox/dalibackup-pve-hook.sh`](./agents/proxmox/dalibackup-pve-hook.sh) to `/usr/local/bin/dalibackup-hook.sh` on your Proxmox node, make it executable, and configure `DALIBKP_API_URL` / `DALIBKP_API_TOKEN` in its environment. This hook notifies completion; it does not transport the archive itself.
2. Edit `/etc/vzdump.conf` :
```ini
script: /usr/local/bin/dalibackup-hook.sh
```

---

## 📡 REST API Reference

Protected requests require `Authorization: Bearer <TOKEN>` (Admin JWT or appropriate Machine Token). Login and health are public. Existing `/api/...` routes are unchanged; v1.1.0 does not introduce `/api/v1`.

| Method | Endpoint | Access | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/login` | Public | Admin login, returns session JWT |
| `GET` | `/api/jobs` | Admin | List all configured backup jobs |
| `POST` | `/api/jobs` | Admin | Create schedule, hypervisor target & retention policy |
| `POST` | `/api/jobs/:id/run` | Admin | Trigger immediate backup execution (1-Click Run) |
| `GET` | `/api/restore-points` | Admin | List all backup archives and restore points |
| `POST` | `/api/restore-points/:id/restore` | Admin | Trigger disaster recovery / instant VM reconstruction |
| `GET` | `/api/hypervisors/agent/tasks` | Agent | Atomic claiming of pending backup and restore tasks |
| `POST` | `/api/hypervisors/agent/upload/:taskId/:diskIndex` | Agent | Stream compressed VHDX disk byte stream |
| `GET` | `/api/health` | Public | System health check, uptime, and engine status |

---

## 🧪 Automated Test Suite & Verification

DaliBackup-OSS includes a comprehensive automated test suite verifying AES-256-GCM cryptography, atomic claiming, multi-disk idempotence, and VM manifest reconstruction :

```bash
npm test
npm run test:smoke
npm audit --audit-level=high
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
<p>Evaluate the documented feature gaps and perform real restore tests first. This release is not a feature-equivalent or certified replacement for an established production backup solution.</p>
</details>

<details>
<summary><strong>Q: Does it support incremental Hyper-V backups?</strong></summary>
<p>No end-to-end RCT incremental pipeline is available in the OSS worker yet. It streams full gzip-compressed disks; full-plus-delta point-in-time recovery remains unfinished.</p>
</details>

<details>
<summary><strong>Q: How are credentials and hypervisor tokens secured?</strong></summary>
<p>All sensitive credentials, API keys, passwords, and private keys are encrypted at rest using AES-256-GCM authenticated hardware encryption via the internal CryptoVault.</p>
</details>

<details>
<summary><strong>Q: What operating systems are supported for the server?</strong></summary>
<p>The CI matrix covers Windows, Linux and macOS with Node.js 22 and 24. Specific distribution/container deployments still require acceptance tests. The Hyper-V worker requires Windows with Hyper-V.</p>
</details>

---

## 📜 Legal, Authorship & License

Developed with passion by **Bastien LANGUEDOC (Daliranas)**.  
Official Website : **[https://daliranas.fr](https://daliranas.fr)**

Distributed under the **DaliBackup OSS License** (Open Source Software Edition).  
Refer to [`LICENSE`](./LICENSE) and [`NOTICE`](./NOTICE) for full terms.

> **Restrictions** : Strictly forbidden to sell, resell, or monetize this software in any commercial package. Preservation of project branding *DaliBackup* is mandatory.
