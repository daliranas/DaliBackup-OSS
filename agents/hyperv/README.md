# 🪟 DaliBackup — Microsoft Hyper-V Native Agent (CLIENTS-HV-BACKUP-S3)

[![Platform](https://img.shields.io/badge/Hyper--V-Windows%20Server%202016%20%7C%202019%20%7C%202022%20%7C%202025-0078D4?logo=windows)](https://www.microsoft.com/windows-server)
[![PowerShell](https://img.shields.io/badge/PowerShell-5.1%20%7C%207.x-blue?logo=powershell)](https://microsoft.com/powershell)
[![Compression](https://img.shields.io/badge/Compression-Zstandard%20(zstd)-blue)](#)
[![Security](https://img.shields.io/badge/Integrity-SHA--256-brightgreen)](#)

Agent client natif Windows PowerShell / C# haute performance pour l'exécution des sauvegardes, snapshots VSS à chaud, suivi des blocs modifiés (RCT) et réplication sécurisée des **machines virtuelles Hyper-V (VHDX)** vers le Control Plane DaliBackup S3.

---

## ⚡ Caractéristiques Principales

- **Découverte Automatique Hyper-V** : Détection en direct des VMs, vCPUs, RAM et disques VHDX via WMI et le module PowerShell `Hyper-V`.
- **Technologie RCT (Resilient Change Tracking)** : Sauvegardes incrémentielles ultra-rapides en ne transférant que les blocs modifiés depuis la dernière sauvegarde.
- **Application-Aware & VSS** : Cohérence applicative garantie (Active Directory, SQL Server, Exchange, SharePoint) via Microsoft VSS (Volume Shadow Copy).
- **Compression Multi-Thread Zstandard (`zstd`)** : Taux de compression élevé avec débit maximal.
- **SureBoot Sandbox Verification** : Validation automatisée des points de restauration par montage instantané dans un commutateur virtuel isolé.
- **Téléversement Direct S3 en Flux Continu** : Transfert chiffré TLS 1.3 vers le stockage souverain sans intermédiaire.
- **Service Windows Résilient (NSSM)** : Fonctionnement en tâche de fond 24/7 avec redémarrage automatique.

---

## 🚀 Installation sur l'Hôte Windows Hyper-V

Ouvrez une invite **PowerShell en tant qu'Administrateur** :

```powershell
# 1. Cloner ou télécharger le dépôt
git clone git@github.com:daliranas/CLIENTS-HV-BACKUP-S3.git C:\DaliBackup
cd C:\DaliBackup

# 2. Installer les prérequis (Zstandard compression engine)
.\Install-Zstandard.ps1

# 3. Installer et enregistrer le service Windows d'arrière-plan
.\Install-DaliBackupService.ps1
```

---

## ⚙️ Configuration (`config.json`)

Créez ou modifiez le fichier `C:\DaliBackup\config.json` :

```json
{
  "api_url": "https://backup.daliranas.fr",
  "api_token": "dalibkp_live_votre_token_secret_ici",
  "temp_dir": "C:\\DaliBackup\\Temp",
  "max_parallel_jobs": 2,
  "enable_rct": true
}
```

Démarrez ensuite le service Windows :
```powershell
Start-Service DaliBackupService
Get-Service DaliBackupService
```

---

## 🛠️ Scripts & Modules Inclus

- `HyperVBackupAgent.ps1` : Moteur principal d'exécution des sauvegardes (Full & Incremental RCT).
- `HyperVRestoreAgent.ps1` : Agent de restauration instantanée et attachement à chaud de VMs.
- `SureBootSandboxVerification.ps1` : Module de vérification en bac à sable automatisé.
- `DatabaseBackupEngine.ps1` : Moteur de sauvegarde dédié pour bases de données (SQL Server).
- `FastCloneHelper.ps1` : Accélération des copies de blocs via ReFS Block Cloning.
- `CleanupSnapshots.ps1` : Purge automatique des snapshots et fichiers temporaires orphelins.

---

## 🔄 Procédure de Restauration Instantanée

Pour restaurer une machine virtuelle depuis une archive S3 :

```powershell
# Restauration automatique d'une VM avec création d'une nouvelle instance Hyper-V
.\HyperVRestoreAgent.ps1 -S3Key "backups/DALIRANAS/vm-101/backup_20260828.vhdx.zst" -TargetVmName "DALIRANAS-SRV-RESTORE"
```

---

## 📄 Licence
Propriétaire & Souverain — © 2026 Daliranas / Avenqelis GIE. Tous droits réservés.
