# 🪟 Microsoft Hyper-V Agent Deployment Guide — DaliBackup-OSS

## 1. Overview
The **DaliBackup Hyper-V Agent** runs natively on Windows Server (2016, 2019, 2022, 2025) and Hyper-V Server. The supported distribution is one self-contained executable which registers an unattended Windows Scheduled Task.

## 2. Prerequisites
- Windows Server 2016 / 2019 / 2022 / 2025 with Hyper-V role enabled.
- PowerShell 5.1 or PowerShell 7+.
- Administrator privileges.

## 3. Installation Steps

### Step 1: Download the single-file agent
Download `DaliBackup-HyperV-Agent-vX.Y.Z.exe` from the [Official GitHub Releases](https://github.com/daliranas/DaliBackup-OSS/releases) and copy it to `C:\DaliBackup\Agent\`.

### Step 2: Install Windows Background Service
Open PowerShell as Administrator and run:
```powershell
cd C:\DaliBackup\Agent
.\DaliBackup-HyperV-Agent-vX.Y.Z.exe -ServerUrl "https://dalibackup.local:3443" -ApiToken "dalibkp_oss_YOUR_AGENT_TOKEN_HERE"
```

The scheduled task `DaliBackup-HyperV-Daemon` is now registered and will start automatically on boot. No sidecar PowerShell scripts or `config.json` are needed.

To uninstall it, run the same executable as Administrator with `-Action uninstall`.
