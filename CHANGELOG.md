# Changelog

## v1.1.3 — 2026-09-30

### Added

- Hyper-V inventory now lists detected VMs, their state, jobs and backup history;
  a discovered VM can be selected directly when creating a backup job. Local
  `Get-VM` results and remote agent reports are saved in SQLite.
- MySQL, PostgreSQL and MSSQL source jobs with compressed full dumps. The
  corresponding vendor client must be installed on the DaliBackup server.
- Recursive FTP, FTPS, SFTP and OS-mounted SMB folder sources with full and
  incremental `.tar.gz` archives, deletion manifests, chain download and a
  verified restore script for an empty directory.
- Source configuration in the Web UI, encrypted stored credentials, connection
  tests, scheduled execution and chain-aware retention.

### Operational notes

- Database dumps are complete, not WAL/binlog/log incremental backups. MSSQL
  requires a server-side backup directory also readable by DaliBackup.
- SMB uses the operating-system mount/UNC identity. Real-server acceptance and
  isolated restore tests are required before production use.


## v1.1.2 — 2026-09-30

Patch release for the web console, local Hyper-V discovery, update visibility and
dependency security. Review [operational readiness](docs/READINESS.md) before
production use.

### Added

- A single-file Windows Hyper-V agent executable in the release assets. It
  embeds the supported worker, installs its scheduled task and requires no
  adjacent PowerShell files. The source ZIP remains available.
- A single-file Windows x64 server executable containing Node.js, the API and
  the complete Web UI. Run it directly; `data/` persists beside the executable
  and no Node.js installation or `node_modules` directory is required.
- Automatic local Hyper-V detection when the DaliBackup server runs on a Windows
  Hyper-V host with permission to call `Get-VM`. The connected hypervisor list
  shows the local node and VM count without manual registration.
- An authenticated update check in General Settings. It queries the latest
  official GitHub release, compares versions and links to the release download.
  GitHub responses are cached for 30 minutes; installation is administrator-led.

### Fixed

- With SSL enabled, HTTP now redirects the UI and API to HTTPS using status 308.
  HTTPS is available before changing the setting, so activation takes effect
  without restarting the server.
- Updated transitive `brace-expansion` from 5.0.9 to 5.0.12, resolving the
  high-severity denial-of-service advisories reported by `npm audit`.
- Docker health checks now probe the HTTPS endpoint, and release packaging
  removes the temporary artifact directory before generating SHA-256 checksums.
- Added an HTTP-to-HTTPS smoke check and a GitHub release comparison/cache test.

### Upgrade

1. Back up `data/dalibackup.db`, `.env`, SSL keys and backup repositories.
2. Download the server archive and `SHA256SUMS.txt` from the official v1.1.2
   GitHub release and verify the archive checksum.
3. Stop the server, replace application files while preserving `data/`, `.env`
   and mounted repositories, then run `npm ci` and start the server again.
4. For Docker, pull the new image and recreate the container with the same
   persistent volumes. Do not replace the database or backup volumes.

The console checks GitHub for updates and reports them; it does not modify a
running server or container automatically. Windows Hyper-V discovery still
requires the server account to access the local Hyper-V PowerShell module.
The Windows server executable is unsigned; verify its SHA-256 checksum before
running it. Keep the `data/` directory when replacing the executable.

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
