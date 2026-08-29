# 📐 Architectural Overview — DaliBackup-OSS

## 1. Introduction
**DaliBackup-OSS** is designed as a sovereign, single-user, zero-bloat backup and disaster recovery platform. Unlike monolithic backup suites requiring multi-gigabyte databases (MariaDB, PostgreSQL, Redis) and object storage clusters, DaliBackup-OSS is fully self-contained.

## 2. Core Architectural Components

```
                      ┌──────────────────────────────────────────────┐
                      │         DaliBackup-OSS Control Plane         │
                      │                                              │
                      │  [ Express REST API / Web UI / HTTPS 3443 ]  │
                      │        │                      │              │
                      │        ▼                      ▼              │
                      │  SQLite Database        CryptoVault GCM      │
                      │  (node:sqlite)        (AES-256 Encryption)   │
                      └───────┬───────────────────────┬──────────────┘
                              │                       │
           ┌──────────────────┼───────────────────────┼──────────────────┐
           │                  │                       │                  │
           ▼                  ▼                       ▼                  ▼
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ Microsoft        │ │ Proxmox VE       │ │ IMAP Mailboxes   │ │ Target Storage   │
│ Hyper-V Agent    │ │ vzdump Hook      │ │ Universal IMAP   │ │ POSIX / SFTP     │
└──────────────────┘ └──────────────────┘ └──────────────────┘ └──────────────────┘
```

### A. Database Engine: Synchronous Embedded SQLite (`node:sqlite`)
- Uses Node.js 22's native `DatabaseSync` engine with Write-Ahead Logging (`PRAGMA journal_mode = WAL`).
- ACID compliant with atomic transactions for task claiming and restore point cataloging.
- Single-file storage (`data/dalibackup.db`), making migrations, snapshots, and backups effortless.

### B. Security & Cryptography: CryptoVault (AES-256-GCM)
- Every secret (Proxmox API tokens, SFTP SSH private keys, IMAP passwords, Windows credentials) is encrypted at rest using AES-256-GCM with distinct IVs and authentication tags (`${iv}:${tag}:${encrypted}`).
- Single-user session authentication via dynamically signed JWT with 24-hour expiration.
- Machine-bound agent tokens (`dalibkp_oss_...`) preventing unauthorized task interception.

### C. Streaming Engine: Zero-Copy Bit-by-Bit Compression
- Real-time GZip compression stream (`DaliStreamCompressor`) piping directly from the hypervisor storage bus to the network socket, avoiding intermediate temporary files on disk.
- Real-time SHA-256 integrity checksum calculation during stream upload and decompression on restore.
