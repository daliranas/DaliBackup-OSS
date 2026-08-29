# 🪟 Microsoft Hyper-V Agent Deployment Guide — DaliBackup-OSS

## 1. Overview
The **DaliBackup Hyper-V Agent** runs natively on Windows Server (2016, 2019, 2022, 2025) and Hyper-V Server. It operates as an unattended background Windows Service using NSSM (Non-Sucking Service Manager) or Scheduled Tasks.

## 2. Prerequisites
- Windows Server 2016 / 2019 / 2022 / 2025 with Hyper-V role enabled.
- PowerShell 5.1 or PowerShell 7+.
- Administrator privileges.

## 3. Installation Steps

### Step 1: Download the Hyper-V Agent Package
Download the latest `dalibackup-hyperv-agents-v1.0.0.zip` from the [Official GitHub Releases](https://github.com/daliranas/DaliBackup-OSS/releases).

Extract the files to `C:\DaliBackup\Agent\`.

### Step 2: Configure `config.json`
Edit `C:\DaliBackup\Agent\config.json`:
```json
{
  "serverUrl": "https://dalibackup.local:3443",
  "agentToken": "dalibkp_oss_YOUR_AGENT_TOKEN_HERE",
  "hostname": "SRV-HYPERV-01",
  "pollIntervalSeconds": 30,
  "chunkSizeBytes": 4194304,
  "vssTimeoutMinutes": 15,
  "enableSslVerification": false
}
```

### Step 3: Install Windows Background Service
Open PowerShell as Administrator and run:
```powershell
Set-ExecutionPolicy RemoteSigned -Scope Process -Force
cd C:\DaliBackup\Agent
.\Setup-NSSM-Service.ps1 -Install
```

The service `DaliBackupHyperVAgent` is now registered and will start automatically on boot.
