# 📡 REST API Reference — DaliBackup-OSS

## 1. Authentication

All requests to `/api/*` require either:
- **User JWT Token** (Bearer header) obtained from `POST /api/auth/login`.
- **Machine Agent Token** (`dalibkp_oss_...`) for hypervisor agent communication.

```http
Authorization: Bearer <JWT_OR_AGENT_TOKEN>
```

---

## 2. API Endpoints Summary

### A. System & Health
* `GET /api/health` : Control Plane healthcheck. Returns `{ "status": "HEALTHY", "version": "1.0.0-oss" }`.
* `GET /api/auth/setup-status` : Check if the setup wizard has been completed.
* `POST /api/auth/setup-complete` : Complete initial setup wizard and create the admin user.
* `POST /api/auth/login` : Authenticate admin user and receive JWT.

### B. Storage Targets
* `GET /api/storage-targets` : List all configured storage destinations.
* `POST /api/storage-targets` : Add a new POSIX/NFS, SFTP, or FTP target.
* `POST /api/storage-targets/test` : Test connectivity and write permissions to a storage target.
* `DELETE /api/storage-targets/:id` : Delete a storage target.

### C. Backup Jobs & Hypervisors
* `GET /api/jobs` : List all backup jobs with schedules and last execution statuses.
* `POST /api/jobs` : Create a new backup job (Hyper-V, Proxmox, or IMAP).
* `POST /api/jobs/:id/run` : Trigger an immediate 1-click execution of a backup job.
* `DELETE /api/jobs/:id` : Delete a backup job.
* `POST /api/hypervisors/nodes` : Register a Hyper-V or Proxmox VE hypervisor node.

### D. Hyper-V Agent Streaming Endpoints
* `GET /api/hypervisors/agent/tasks?hostname=HOSTNAME` : Claim pending tasks for the given host.
* `POST /api/hypervisors/agent/manifest/:taskId` : Upload VM hardware topology JSON.
* `POST /api/hypervisors/agent/upload/:taskId/:diskIndex` : High-throughput binary upload stream.
* `GET /api/hypervisors/agent/restore-manifest/:taskId` : Download hardware reconstruction manifest.
* `GET /api/hypervisors/agent/download-restore/:taskId/:diskIndex` : Download decompressed raw VHDX stream.
* `POST /api/hypervisors/agent/complete-restore/:taskId` : Confirm successful VM restoration and attach.

### E. Restore Points Catalog
* `GET /api/restore-points` : List all restore points with hypervisor metadata, size, SHA-256 and status.
* `POST /api/restore-points/:id/restore` : Order an automated disaster recovery restore.
* `DELETE /api/restore-points/:id` : Delete restore point catalog entry and purge physical disk archive.
