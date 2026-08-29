# 🐧 Proxmox VE Integration & vzdump Hook Guide — DaliBackup-OSS

## 1. Overview
DaliBackup-OSS orchestrates backups on **Proxmox VE 7.x, 8.x, and 9.x** (QEMU Virtual Machines and LXC Containers) using two complementary methods:
1. **Direct REST API 2.0 Integration** (Token ID / Secret).
2. **Native `vzdump` Hook Script** for post-backup cataloging and offsite replication.

## 2. Setting up Proxmox REST API 2.0 Credentials
1. In the Proxmox Web GUI, go to **Datacenter $\to$ Permissions $\to$ API Tokens**.
2. Add a new token for `root@pam` or a dedicated backup user (e.g. `dalibackup@pve`).
3. Set Role: `PVEAdmin` or custom role with `VM.Backup`, `VM.Audit`, `VM.Config.Disk`, `Datastore.Audit`.
4. In DaliBackup-OSS Web Console:
   - Navigate to **Hypervisors $\to$ Add Node**.
   - Select Type: `PROXMOX`.
   - Enter Host: `https://pve1.local:8006`.
   - Enter Token ID (`root@pam!dalibackup`) and Token Secret.
   - Secrets are automatically encrypted at rest with AES-256-GCM via CryptoVault.

## 3. Installing the Native `vzdump` Hook Script
To trigger cataloging and notifications directly from Proxmox VE jobs:
1. Download `vzdump-hook-dalibackup.sh` to `/var/lib/vz/snippets/` on each Proxmox node.
2. Make it executable:
   ```bash
   chmod +x /var/lib/vz/snippets/vzdump-hook-dalibackup.sh
   ```
3. Set the environment variables in `/etc/default/dalibackup-hook`:
   ```bash
   DALIBACKUP_SERVER="https://dalibackup.local:3443"
   DALIBACKUP_TOKEN="dalibkp_oss_YOUR_TOKEN_HERE"
   ```
4. Attach the hook script to your Proxmox backup jobs in `/etc/pve/vzdump.cron` or GUI.
