# 📬 Universal IMAP Mailbox Backup Guide — DaliBackup-OSS

## 1. Overview
DaliBackup-OSS includes a universal, incremental **IMAP Email Backup Engine**. It connects to any standard IMAP/IMAPS server (Microsoft Exchange, Microsoft 365 / Office 365, Google Workspace, Zimbra, Dovecot, Postfix, OVH, Infomaniak, cPanel) and synchronizes entire mailboxes into compressed `.tar.gz` archive bundles containing `.eml` raw message files and folder hierarchies.

## 2. Key Capabilities
- **UID High-Water Mark Synchronization** : Stores `last_uid` in `mail_sync_state` per folder (`INBOX`, `Sent`, `Archive`, `Drafts`, custom folders) ensuring only newly arrived messages are downloaded.
- **CryptoVault Storage** : IMAP passwords and tokens are encrypted with AES-256-GCM at rest.
- **Standard `.eml` Format** : Restorable into Microsoft Outlook, Mozilla Thunderbird, Apple Mail, or roundcube.
- **Automatic Retention** : Enforces retention policies per mailbox job.

## 3. How to Configure an Email Backup Job
1. In DaliBackup-OSS Web Console, go to **E-mail Backup $\to$ Add Mailbox Source**.
2. Fill in:
   - **Host** : `imap.mailserver.com` (Port `993` with SSL/TLS).
   - **Username** : `contact@entreprise.com`.
   - **Password** : User mailbox password or App-Specific Password.
3. Configure Schedule (`0 3 * * *` for 3:00 AM daily) and Retention Count (e.g. `30` restore points).
4. Save and run immediate initial sync!
