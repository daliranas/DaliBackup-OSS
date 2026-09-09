## 2025-02-28 - [Path Traversal in FTP & SFTP Storage Providers]
**Vulnerability:** In `FtpProvider` and `SftpProvider`, remote paths for file operations were being created using `path.posix.join(this.config.remote_path, remoteFilePath)`. This allowed an attacker to supply a `remoteFilePath` containing `../` sequences or starting with a leading slash to construct absolute paths, allowing reads, writes, and deletions of arbitrary files outside the intended FTP/SFTP directory.
**Learning:** `path.posix.join` is not safe for processing untrusted inputs when trying to enforce a directory jail because it happily concatenates `../` and handles absolute paths by overriding the base path entirely.
**Prevention:** Always implement a strictly validated `getSecurePath` helper. Strip leading slashes from user input, resolve the combined path against a pseudo-root (like `/`), and rigorously ensure the resulting path starts with the securely normalized base path directory string.

## 2025-02-28 - [Path Traversal in x-backup-filename Header]
**Vulnerability:** The HTTP header `x-backup-filename` was read directly and used to construct a file path in the Hyper-V upload endpoint without any sanitization.
**Learning:** Even custom HTTP headers can be a vector for path traversal attacks if they provide filename hints that are later used in storage operations.
**Prevention:** Always use `path.basename()` to sanitize filenames extracted from untrusted sources like HTTP headers before passing them to storage layers.
