# Operational readiness — 2026-09-29

This branch is under validation. It is not yet a certified production backup release.

## Implemented and checked locally

- TypeScript build and existing engine/API suites.
- Local repository binary round-trip, interrupted overwrite preservation, partial-file cleanup,
  path confinement, deletion and actual filesystem capacity.
- S3 backend: SDK multipart upload, download, paginated listing and deletion. Local HTTP
  fixture checks small-object round-trip, pagination, missing objects and denied deletion.
  Large multipart and real AWS/MinIO credentials still require integration testing.
- Explicit FTPS enables TLS; FTP remains a separate option.
- SMB uses an OS-mounted share or a Windows UNC path accessible to the server account.
  It does not mount shares or negotiate SMB credentials itself.
- Legacy database migration preserves storage rows and encrypted credentials.
- Server HTTP/HTTPS startup test generates certificates without an external OpenSSL binary.
- CI matrix covers Windows, Linux and macOS, Node 22 and 24; a configured matrix is not evidence
  that those remote jobs have run.

## Hyper-V deployment path

Use the release `DaliBackup-HyperV-Agent-vX.Y.Z.exe` with `-ServerUrl` and
`-ApiToken`; it installs the scheduled task and embeds the worker. The source
worker remains available as `agents/hyperv/DaliAgent-HyperV.ps1` for audit or
customization.
Trust the server TLS certificate on the Windows host before starting the service.
The server runs on multiple operating systems; the Hyper-V agent requires Windows/Hyper-V.

The OSS worker currently streams full gzip-compressed disks. Existing older RCT/S3 scripts
refer to different `/api/v1/backup/multipart` endpoints that this OSS server does not expose.
Their presence is **not working incremental RCT support**. Do not use their success messages
as evidence of restorable incremental backups.

Corrections made to the OSS worker stop restoration on SHA-256 mismatch and flatten an
existing differencing-disk chain instead of backing up only its parent. Flattening requires
temporary disk capacity. These PowerShell changes require validation on a Hyper-V test host.

## Required release gates

1. Run the full CI matrix and PowerShell AST checks.
2. Back up a disposable Hyper-V VM with multiple disks and existing checkpoints, restore
   under another name on an isolated switch, boot it and compare known guest files.
3. Implement and validate the incremental baseline/delta/restore/retention chain end to end.
   A full backup presented as incremental is not acceptable.
4. Test real FTP, FTPS, SFTP, SMB and S3 destinations, including connection loss, quota-full,
   permission denial, multi-GB transfers and restoration after server restart.
5. Validate Windows service startup and SMB access under its actual service account.

## Storage configuration

S3 `remote_path`: `bucket/prefix`; `host`: optional full S3 endpoint URL; `username`: access key ID;
`password`: secret access key, encrypted by the existing vault. Region is `AWS_REGION`
(default `us-east-1`). With no explicit credentials the SDK credential chain is used.
The S3 connection check only checks bucket access, not permission to write/delete objects.

SMB must be mounted before starting the server. Use a dedicated test share for acceptance tests.
Remote FTP/SFTP paths are POSIX repository paths and support full paths returned by listings.

## Commands

```
npm ci
npm run build
npm test
npm run test:smoke
npm audit --audit-level=moderate
```
