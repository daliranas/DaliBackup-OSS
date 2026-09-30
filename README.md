<div align="center">

> Validation status and deployment limitations: [Operational readiness](docs/READINESS.md).
> In particular, incremental Hyper-V RCT is not yet wired into the OSS worker end to end.

# 🛡️ DaliBackup-OSS
### Sovereign Backup Engine for Hyper-V, Proxmox VE, IMAP, Databases & Remote Folders

[![Release](https://img.shields.io/github/v/release/daliranas/DaliBackup-OSS?style=for-the-badge)](https://github.com/daliranas/DaliBackup-OSS/releases)
[![CI/CD Pipeline](https://img.shields.io/github/actions/workflow/status/daliranas/DaliBackup-OSS/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI%2FCD)](https://github.com/daliranas/DaliBackup-OSS/actions)
[![Docker Pulls](https://img.shields.io/docker/pulls/blanguedoc/dalibackup-oss?style=for-the-badge&logo=docker&logoColor=white)](https://hub.docker.com/r/blanguedoc/dalibackup-oss)
[![Snyk Security](https://img.shields.io/badge/Security-Snyk%20Scanned-4C158A?style=for-the-badge&logo=snyk&logoColor=white)](https://snyk.io/)
[![License](https://img.shields.io/badge/License-DaliBackup%20OSS-blue?style=for-the-badge)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-22.x%20%7C%2024.x-339933?style=for-the-badge&logo=node.js)](https://nodejs.org/)

<br/>

**DaliBackup-OSS** is a free, self-hosted, lightweight, and sovereign open-source backup and disaster recovery platform.  
For **Sysadmins, MSPs, DevOps, and Homelabers**, it provides backup workflows for **Microsoft Hyper-V**, **Proxmox VE (QEMU/KVM & LXC)**, **IMAP**, **MySQL/PostgreSQL/MSSQL** and **remote folders**, with **local/NFS, mounted SMB, SFTP, FTP/FTPS and S3-compatible storage**. Real-system backup and restore acceptance tests remain required before production use.

[🌐 Live Documentation](https://daliranas.github.io/DaliBackup-OSS/) · [🐳 Docker Hub](https://hub.docker.com/r/blanguedoc/dalibackup-oss) · [🤝 Contributing](./CONTRIBUTING.md) · [🐛 Report Bug](https://github.com/daliranas/DaliBackup-OSS/issues) · [💡 Request Feature](https://github.com/daliranas/DaliBackup-OSS/issues) · [🏢 Official Website](https://daliranas.fr)

</div>

---

## 📑 Table of Contents

- [Current scope and limitations](#current-scope-and-limitations)

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

## Current scope and limitations

See the [changelog and upgrade instructions](CHANGELOG.md) and
[readiness report](docs/READINESS.md). This upgrade focuses on storage reliability,
S3, mounted SMB, explicit FTPS, safe restoration, cross-platform startup, and
the v1.1.3 Hyper-V inventory and database/folder source additions.

- CI tests the server on Windows, Linux and macOS with Node.js 22/24.
- Docker, VM and bare-metal installation paths are available. LXC deployments
  require correct persistent mounts and permissions. K8s/K3s manifests and
  deployment acceptance tests are not delivered in this release.
- Hyper-V OSS backups are full gzip-compressed disks. End-to-end RCT incremental
  backup and full-plus-delta restoration to a selected date are **not implemented**.
- MySQL, PostgreSQL and MSSQL sources produce full dumps; database log/WAL/binlog
  incremental backups are not implemented. MariaDB, SQLite and MongoDB connectors
  are not certified. Embedded SQLite remains the server's catalog.
- Folder sources use FTP, FTPS, SFTP or an OS-mounted SMB share/UNC. Incremental
  selection uses file size and modification time (or copies all files when the
  remote server supplies no usable timestamp). A chain starts with a full archive;
  retain every archive in the chain to restore a later point.
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

### Database and folder sources (v1.1.3)

In **Bases & Dossiers**, register a source and then create a **Database** or
**Folder** job with a storage target. MySQL requires `mysqldump`, PostgreSQL
requires `pg_dump`, and SQL Server requires `sqlcmd` installed on the DaliBackup
host (including when using the Windows server `.exe`). These external vendor
tools are not embedded in the executable. MySQL and PostgreSQL dumps are
compressed `.sql.gz`; SQL Server uses `BACKUP DATABASE ... WITH COMPRESSION,
CHECKSUM` and needs a backup directory writable by SQL Server and readable by
DaliBackup. For a remote SQL Server, map the server-side backup path and the
locally accessible SMB path to the same directory. SQL backup permissions and
an isolated test restore are required before production use.

Folder sources read recursively and create `.tar.gz` archives. SMB uses the
identity and mount/UNC permissions of the DaliBackup process; the application
does not mount a share or negotiate separate SMB credentials. FTP is unencrypted;
prefer FTPS or SFTP over untrusted networks. Incremental archives contain
changed files and a manifest of deletions. Download the complete chain from
the restore-point view and reconstruct it with
`node scripts/restore-folder-chain.mjs <empty-output-dir> <full.tar.gz> <increment-1.tar.gz> ...`
in chronological order. The script refuses a non-empty destination. See
[source backup and restore details](docs/08-database-folder-backups.md).

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
      test: ["CMD", "curl", "-k", "-f", "https://localhost:3443/api/health"]
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

### Windows : serveur en un seul `.exe`

Téléchargez `DaliBackup-Server-v1.1.3-win-x64.exe` et `SHA256SUMS.txt` depuis
la [release officielle](https://github.com/daliranas/DaliBackup-OSS/releases/tag/v1.1.3).
Vérifiez l'empreinte SHA-256, placez l'exécutable dans un dossier dédié, puis
lancez-le. L'interface est disponible sur `https://localhost:3443` ; le port
HTTP 3000 redirige vers HTTPS. Node.js, `npm` et les fichiers `public/` ne sont
pas nécessaires sur ce serveur Windows.

Le dossier `data/` (base SQLite, certificats et stockage local par défaut) est
créé à côté de l'exécutable et doit être conservé lors des mises à jour. Une
configuration `.env` facultative peut être placée dans le même dossier. Le
serveur s'exécute tant que sa fenêtre reste ouverte ; utilisez votre
gestionnaire de service habituel pour un démarrage automatique.

### Installation Node.js / Linux / macOS

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

### GitHub release updates

After login, **Settings → Mises à jour GitHub** checks the latest official
release and displays its version and download link. The server caches GitHub
responses for 30 minutes. Updates are installed by the administrator after
backing up persistent data and stopping the server; the application does not
replace its own binaries or restart Docker containers. Use `SHA256SUMS.txt` from
the release to verify downloaded archives. Docker installations use the
corresponding image and keep the same mounted `data` and backup directories.

## 💻 Hyper-V Agent Deployment (Windows)

DaliBackup-OSS publishes a self-contained `DaliBackup-HyperV-Agent-vX.Y.Z.exe`
with every release. It embeds the supported worker; no directory of PowerShell
files is required.

### 1. Install the single-file agent as a Background Scheduled Task
On your Hyper-V Host (Windows Server 2016/2019/2022/2025 or Windows 10/11 Pro) :

```powershell
# Run PowerShell as Administrator
cd C:\DaliBackup
.\DaliBackup-HyperV-Agent-vX.Y.Z.exe -ServerUrl "https://backup.yourdomain.com:3443" -ApiToken "YOUR_AGENT_TOKEN"
```

This registers and starts `DaliBackup-HyperV-Daemon`; its executable is reused
at each Windows startup. Use `-Action uninstall` from the same executable to
remove it.

### 2. Source mode (for audit or customization)
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
