# 🚨 Disaster Recovery (PRA) & Instant VM Restore — DaliBackup-OSS

## 1. Overview
DaliBackup-OSS provides hardware-accurate, automated Disaster Recovery (Plan de Reprise d'Activité / PRA) for Hyper-V and Proxmox VE environments.

## 2. Instant Disaster Recovery Workflow (Hyper-V)

```
[ Admin UI: 1-Click Restore ] 
              │
              ▼
[ Generate Restore Task & Order ] 
              │
              ▼
[ Agent Fetches Hardware Manifest (CPU, RAM, Disks, Adapters, Gen) ]
              │
              ▼
[ Agent Streams & Decompresses Disks with Bit-by-Bit SHA-256 Check ]
              │
              ▼
[ Hyper-V Rebuilds VM, Configures Controllers, Attaches Disks & Powers On ]
```

### Key Safety Mechanisms:
1. **Multi-Disk Reassembly** : Recreates exact SCSI/IDE controller IDs, locations, and disk topologies.
2. **SHA-256 Verification with Non-Fatal Warnings** : Verifies block hashes while allowing non-blocking attach in disaster situations where minor disk header stamps fluctuate.
3. **SureBoot Option** : Boots the restored VM isolated from the production network for automated recovery validation.
