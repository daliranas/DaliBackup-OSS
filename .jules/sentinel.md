## 2025-02-21 - Path Traversal in File Upload Headers
**Vulnerability:** The HTTP header `x-backup-filename` was read directly and passed to the backend storage engines without being sanitized, allowing an attacker to spoof the filename with directory traversals (e.g., `../../../etc/passwd`).
**Learning:** Even internal API endpoints intended for agent use must treat HTTP headers as strictly untrusted user input, especially when used to assemble file paths on disk.
**Prevention:** Always sanitize any filename derived from untrusted user input using `path.basename()` before combining it with base directories, ensuring no directory traversal tokens are accepted.
