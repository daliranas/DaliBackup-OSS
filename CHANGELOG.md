# Changelog

## v1.1.0 — 2026-09-29

Upgrade focused on storage reliability, cross-platform startup and restoration safety.
This release does not certify every backup target for production; see
[operational readiness](docs/READINESS.md) before deployment.

### Added

- S3-compatible storage using the AWS SDK: multipart upload, streaming download,
  paginated listing and deletion, with configurable endpoint and region.
- SMB storage through an OS-mounted share or a Windows UNC path.
- Explicit FTPS support, separate from unencrypted FTP.
- Storage round-trip, migration, error-handling and HTTP/HTTPS startup regression tests.
- CI matrix for Windows, Linux and macOS on Node.js 22 and 24.

### Fixed

- FTP/SFTP repository paths, streaming errors and download cleanup.
- Local/NFS atomic writes, interrupted overwrite preservation, repository path
  confinement and actual filesystem capacity reporting.
- Storage migration preserves existing rows and encrypted credentials.
- Failed storage deletion no longer silently removes the catalog entry;
  referenced storage cannot be deleted and restore-point deletion handles all disks.
- Hyper-V restoration stops on SHA-256 mismatch; full backup flattens existing
  differencing disks instead of copying only the parent disk.
- Windows installers target the OSS Hyper-V worker with the correct arguments.
- Certificate generation no longer requires an external OpenSSL executable.
- Express 5 startup routing, safe download filenames and dependency security fixes.

### Upgrade

1. Back up the application database, configuration, encryption material and repositories.
2. Stop the server, install this version and run `npm ci` and `npm run build`.
3. Start with the existing configuration; the storage schema migrates automatically.
4. Verify repository access and perform a disposable backup/restore before production use.

Node.js 22 or 24 is recommended. The server archive requires Node.js and dependency
installation; it is not a self-contained executable. Mount NFS/SMB before startup.
The Hyper-V worker requires Windows with Hyper-V and trust in the server certificate.

### Known limitations

- End-to-end Hyper-V RCT incremental backup and full-plus-delta point-in-time
  restoration are not implemented in the OSS worker. Its backups are full gzip disks.
- MariaDB, PostgreSQL, SQLite, MSSQL and MongoDB application backup connectors are
  not delivered by this release (the server's own SQLite database is separate).
- Real Hyper-V backup/boot restoration, Windows service deployment, multi-GB S3
  multipart transfers and real remote storage failure scenarios still need acceptance tests.
- Generic S3 endpoint support is not certification of AWS, OVHcloud, Cloudflare
  or Bastivan Consulting interoperability.
- Mandatory compression across every backup path and K8s/K3s deployment validation
  remain unfinished. Existing API routes are unchanged.

### Distribution

The release workflow builds Hyper-V scripts, Proxmox hooks and a compiled server
archive, with SHA-256 checksums. Docker publication runs separately; check its
workflow result before relying on an image tag.

## v1.0.0

Initial tagged release. See the Git history for its original changes.
