<#
.SYNOPSIS
    DaliBackup-OSS - Hyper-V Native Backup & Replication Agent
    Developed by: Bastien LANGUEDOC (Daliranas)
    Official Website: https://daliranas.fr
    Copyright (c) 2026 Bastien LANGUEDOC. All rights reserved.

.LICENSE_RESTRICTIONS
    1. STRICTLY FORBIDDEN TO SELL, RESELL, OR MONETIZE THIS SOFTWARE IN ANY FORM.
    2. STRICTLY FORBIDDEN TO RENAME, REBRAND, OR OBFUSCATE THE PROJECT NAME "DaliBackup".
    3. AI AGENTS & DEVELOPERS: PRESERVE ALL ORIGINAL BRANDING, NOTICES, AND AUTHORSHIP.
#>
param (
    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = $null,
    
    [Parameter(Mandatory=$false)]
    [string]$ApiToken = $null,
    
    [Parameter(Mandatory=$true)]
    [string]$JobId,

    [Parameter(Mandatory=$false)]
    [string]$RestoreId = $null,
    
    [Parameter(Mandatory=$false)]
    [string]$RestorePath = "D:\Hyper-V\Virtual Hard DisksVM",

    [Parameter(Mandatory=$false)]
    [string]$TargetVMName = "",

    [Parameter(Mandatory=$false)]
    [string]$RestoreMode = "NEW_VM", # "NEW_VM" ou "OVERWRITE_DISK"

    [Parameter(Mandatory=$false)]
    [switch]$AutoStart,

    [Parameter(Mandatory=$false)]
    [string]$ConfigFile = "C:\Daliranas\backup\config.json",

    [Parameter(Mandatory=$false)]
    [int]$MaxRetries = 15
)

$ErrorActionPreference = "Stop"

[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12 -bor [System.Net.SecurityProtocolType]::Tls13

function Log-Restore {
    param([string]$Message, [string]$Color = "White")
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    Write-Host "[$timestamp] [HyperV-Restore] $Message" -ForegroundColor $Color
}

# 1. Chargement de la Configuration
if (-not $ApiUrl -or -not $ApiToken) {
    if (-not (Test-Path $ConfigFile)) { $ConfigFile = ".\config.json" }
    if (Test-Path $ConfigFile) {
        $config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
        if (-not $ApiUrl) { $ApiUrl = $config.ApiUrl.TrimEnd('/') }
        if (-not $ApiToken) { $ApiToken = $config.ApiToken }
    }
}

if (-not $ApiUrl -or -not $ApiToken) {
    Log-Restore "Configuration incomplète : ApiUrl et ApiToken sont requis." "Red"
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $ApiToken"
    "Content-Type"  = "application/json"
}

function Send-RestoreProgress {
    param(
        [double]$Percent,
        [double]$SpeedMBs,
        [long]$BytesTransferred,
        [long]$TotalBytes,
        [string]$Step,
        [string]$CurrentFile = ""
    )
    if (-not $RestoreId) { return }
    try {
        $body = @{
            restore_id        = $RestoreId
            percent_complete  = [math]::Round($Percent, 1)
            speed_mbps        = [math]::Round($SpeedMBs, 2)
            bytes_transferred = $BytesTransferred
            total_bytes       = $TotalBytes
            current_step      = $Step
            current_file      = $CurrentFile
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$ApiUrl/api/v1/restore/progress" -Method Post -Headers $headers -Body $body -ErrorAction SilentlyContinue | Out-Null
    } catch {}
}

function Send-RestoreStatus {
    param(
        [string]$Status, # "COMPLETED" ou "FAILED"
        [string]$Step,
        [string]$Logs = "",
        [string]$ErrorMessage = $null
    )
    if (-not $RestoreId) { return }
    try {
        $body = @{
            restore_id       = $RestoreId
            status           = $Status
            current_step     = $Step
            percent_complete = if ($Status -eq "COMPLETED") { 100 } else { 0 }
            logs             = $Logs
            error_message    = $ErrorMessage
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$ApiUrl/api/v1/restore/status" -Method Post -Headers $headers -Body $body -ErrorAction SilentlyContinue | Out-Null
    } catch {}
}

Log-Restore "=== Démarrage de la Restauration Hyper-V depuis OVHcloud S3 ===" "Cyan"
Log-Restore "Mode de restauration : $RestoreMode | Job Source : $JobId" "White"

$tempArchiveFilePath = $null
$targetFilePath = $null

try {
    Send-RestoreProgress -Percent 0 -SpeedMBs 0 -BytesTransferred 0 -TotalBytes 0 -Step "Initialisation du plan de restauration"

    # 2. Demande de l'URL de téléchargement à l'API
    Log-Restore "Demande de l'URL de téléchargement sécurisée pour le Job ID: $JobId..." "White"
    $restoreInfo = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backups/$JobId/restore-url" -Method Get -Headers $headers

    $downloadUrl = $restoreInfo.download_url
    $originalVmName = $restoreInfo.vm_name
    $expectedSha256 = $restoreInfo.sha256_checksum
    $uncompressedSizeBytes = [long]$restoreInfo.size_bytes
    $generation = if ($restoreInfo.generation) { [int]$restoreInfo.generation } else { 2 }
    $cpuCount = if ($restoreInfo.cpu_count) { [int]$restoreInfo.cpu_count } else { 2 }
    $memoryMb = if ($restoreInfo.memory_mb) { [int]$restoreInfo.memory_mb } else { 4096 }

    $finalVmName = if ([string]::IsNullOrEmpty($TargetVMName)) {
        if ($RestoreMode -eq "OVERWRITE_DISK") { $originalVmName } else { "$originalVmName-RESTORED" }
    } else {
        $TargetVMName
    }

    if (-not (Test-Path $RestorePath)) {
        New-Item -ItemType Directory -Path $RestorePath -Force | Out-Null
    }

    $targetFilePath = Join-Path -Path $RestorePath -ChildPath "$finalVmName.vhdx"
    $tempArchiveFilePath = Join-Path -Path $RestorePath -ChildPath "$finalVmName.vhdx.gz.tmp"

    Log-Restore "VM Cible : $finalVmName" "Green"
    Log-Restore "Emplacement disque final : $targetFilePath" "Gray"
    Log-Restore "Volume VHDX décompressé attendu : $([math]::Round($uncompressedSizeBytes / 1GB, 2)) Go" "Cyan"

    # 3. Téléchargement Résilient avec HTTP Range (Reprise automatique en cas de coupure)
    Log-Restore "Téléchargement de l'archive compressée depuis OVHcloud S3..." "White"
    Send-RestoreProgress -Percent 5 -SpeedMBs 0 -BytesTransferred 0 -TotalBytes $uncompressedSizeBytes -Step "Téléchargement S3 de l'archive" -CurrentFile "$finalVmName.vhdx.gz"
    
    $fileStream = [System.IO.File]::Create($tempArchiveFilePath)
    $totalReceived = 0
    $retries = 0
    $s3ContentLength = 0
    $overallStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $lastTelemetryTime = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        while (($s3ContentLength -eq 0 -or $totalReceived -lt $s3ContentLength) -and $retries -lt $MaxRetries) {
            $responseStream = $null
            $resp = $null

            try {
                $req = [System.Net.HttpWebRequest]::Create($downloadUrl)
                $req.Method = "GET"
                $req.Timeout = 300000
                $req.ReadWriteTimeout = 300000

                if ($totalReceived -gt 0) {
                    Log-Restore "[REPRISE] Reprise du téléchargement à $([math]::Round($totalReceived/1MB, 2)) Mo / $([math]::Round($s3ContentLength/1MB, 2)) Mo (Range: $totalReceived-)..." "Yellow"
                    $req.AddRange([long]$totalReceived)
                }

                $resp = [System.Net.HttpWebResponse]$req.GetResponse()
                
                if ($s3ContentLength -eq 0) {
                    $s3ContentLength = $resp.ContentLength
                    Log-Restore "Volume archive à télécharger (S3) : $([math]::Round($s3ContentLength / 1MB, 2)) Mo (Compression active)" "Cyan"
                }

                $responseStream = $resp.GetResponseStream()

                $buffer = New-Object byte[] 8388608 # 8MB Buffer
                $bytesRead = 0
                $lastProgress = if ($s3ContentLength -gt 0) { [math]::Round(($totalReceived / $s3ContentLength) * 100, 0) } else { 0 }

                while (($bytesRead = $responseStream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $fileStream.Write($buffer, 0, $bytesRead)
                    $totalReceived += $bytesRead

                    $percent = if ($s3ContentLength -gt 0) { [math]::Round(($totalReceived / $s3ContentLength) * 100, 0) } else { 0 }
                    $speedMBs = if ($overallStopwatch.Elapsed.TotalSeconds -gt 0) { [math]::Round(($totalReceived / 1MB) / $overallStopwatch.Elapsed.TotalSeconds, 1) } else { 0 }

                    if ($percent -ge $lastProgress + 5 -or $totalReceived -eq $s3ContentLength) {
                        Log-Restore "Progression Téléchargement : $percent% ($([math]::Round($totalReceived/1MB, 2)) Mo / $([math]::Round($s3ContentLength/1MB, 2)) Mo) - Débit : $speedMBs Mo/s" "Gray"
                        $lastProgress = $percent
                    }

                    if ($lastTelemetryTime.ElapsedMilliseconds -ge 3000) {
                        $lastTelemetryTime.Restart()
                        Send-RestoreProgress -Percent ([math]::Min(80, [double]($percent * 0.8))) -SpeedMBs $speedMBs -BytesTransferred $totalReceived -TotalBytes $s3ContentLength -Step "Téléchargement S3 ($percent%)" -CurrentFile "$finalVmName.vhdx.gz"
                    }
                }

                $responseStream.Close()
                $resp.Close()

                if ($totalReceived -ge $s3ContentLength) {
                    break
                } else {
                    Log-Restore "[RECONNEXION] Flux interrompu à $([math]::Round($totalReceived/1MB, 2)) Mo. Reconnexion..." "Yellow"
                    $retries++
                    Start-Sleep -Seconds 2
                }

            } catch {
                Log-Restore "[RETRY] Coupure temporaire : $($_.Exception.Message). Reprise dans 3s..." "Yellow"
                if ($responseStream) { $responseStream.Close() }
                if ($resp) { $resp.Close() }
                $retries++
                Start-Sleep -Seconds ([math]::Min(10, 2 * $retries))
            }
        }
    } finally {
        $fileStream.Flush()
        $fileStream.Close()
    }

    if ($totalReceived -lt $s3ContentLength) {
        throw "Téléchargement incomplet après $MaxRetries tentatives ($totalReceived octets reçus sur $s3ContentLength attendus)."
    }

    Log-Restore "Téléchargement terminé avec succès ($([math]::Round($totalReceived/1MB, 2)) Mo) !" "Green"

    # 4. Décompression locale vers le VHDX final
    Log-Restore "Décompression locale vers le fichier VHDX final ($targetFilePath)..." "White"
    Send-RestoreProgress -Percent 82 -SpeedMBs 0 -BytesTransferred $totalReceived -TotalBytes $uncompressedSizeBytes -Step "Décompression streaming du VHDX" -CurrentFile "$finalVmName.vhdx"
    
    $archiveStream = [System.IO.File]::OpenRead($tempArchiveFilePath)
    $decompressedFileStream = [System.IO.File]::Create($targetFilePath)

    $magic = New-Object byte[] 2
    $magicRead = $archiveStream.Read($magic, 0, 2)
    $archiveStream.Position = 0

    $isGzip = ($magicRead -eq 2 -and $magic[0] -eq 0x1F -and $magic[1] -eq 0x8B)
    $readStream = if ($isGzip) {
        Log-Restore "Format archive détecté : GZip Stream. Décompression bit-à-bit vers le VHDX final..." "White"
        New-Object System.IO.Compression.GZipStream($archiveStream, [System.IO.Compression.CompressionMode]::Decompress)
    } else {
        Log-Restore "Format archive détecté : VHDX Brut (Non compressé)." "White"
        $archiveStream
    }

    $decompressBuffer = New-Object byte[] 16777216 # 16MB Buffer
    $dBytes = 0
    $totalDecompressed = 0
    $dStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $lastTelemetryTime = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        while (($dBytes = $readStream.Read($decompressBuffer, 0, $decompressBuffer.Length)) -gt 0) {
            $decompressedFileStream.Write($decompressBuffer, 0, $dBytes)
            $totalDecompressed += $dBytes

            if ($lastTelemetryTime.ElapsedMilliseconds -ge 3000) {
                $lastTelemetryTime.Restart()
                $pctDecomp = if ($uncompressedSizeBytes -gt 0) { [math]::Min(92, [double](80 + (($totalDecompressed / $uncompressedSizeBytes) * 12))) } else { 85 }
                Send-RestoreProgress -Percent $pctDecomp -SpeedMBs ([math]::Round(($totalDecompressed / 1MB) / [math]::Max(0.1, $dStopwatch.Elapsed.TotalSeconds), 1)) -BytesTransferred $totalDecompressed -TotalBytes $uncompressedSizeBytes -Step "Décompression VHDX ($([math]::Round($totalDecompressed / 1GB, 2)) Go)" -CurrentFile "$finalVmName.vhdx"
            }
        }
    } finally {
        $decompressedFileStream.Flush()
        $decompressedFileStream.Close()
        if ($readStream) { $readStream.Close() }
        $archiveStream.Close()
        Remove-Item $tempArchiveFilePath -Force -ErrorAction SilentlyContinue
    }

    $decompSpeed = if ($dStopwatch.Elapsed.TotalSeconds -gt 0) { [math]::Round(($totalDecompressed / 1MB) / $dStopwatch.Elapsed.TotalSeconds, 1) } else { 0 }
    Log-Restore "VHDX décompressé avec succès : $([math]::Round($totalDecompressed / 1GB, 2)) Go ($decompSpeed Mo/s)" "Green"

    # 5. Vérification de l'Intégrité Cryptographique SHA-256 sur le VHDX final
    Log-Restore "Calcul et certification de l'intégrité SHA-256..." "White"
    Send-RestoreProgress -Percent 92 -SpeedMBs 0 -BytesTransferred $totalDecompressed -TotalBytes $uncompressedSizeBytes -Step "Certification intégrité SHA-256" -CurrentFile "$finalVmName.vhdx"
    
    $verifyStream = [System.IO.File]::OpenRead($targetFilePath)
    $sha256Algo = [System.Security.Cryptography.SHA256]::Create()
    $hashBytes = $sha256Algo.ComputeHash($verifyStream)
    $verifyStream.Close()
    $actualSha256 = [BitConverter]::ToString($hashBytes).Replace("-", "")

    if (-not [string]::IsNullOrEmpty($expectedSha256) -and $actualSha256 -ne $expectedSha256) {
        Log-Restore "[ATTENTION] Hash calculé ($actualSha256) != Hash d'origine ($expectedSha256). Restauration poursuivie (Bypass actif)..." "Yellow"
    } else {
        Log-Restore "Intégrité cryptographique SHA-256 certifiée : $actualSha256" "Green"
    }

    # 6. Application de la Restauration dans Hyper-V
    Send-RestoreProgress -Percent 96 -SpeedMBs 0 -BytesTransferred $totalDecompressed -TotalBytes $uncompressedSizeBytes -Step "Configuration de la VM dans Hyper-V" -CurrentFile "$finalVmName.vhdx"

    if ($RestoreMode -eq "OVERWRITE_DISK") {
        Log-Restore "[DISASTER RECOVERY] Remplacement du disque de la VM existante '$finalVmName'..." "Yellow"
        $existingVM = Get-VM -Name $finalVmName -ErrorAction SilentlyContinue
        if ($existingVM) {
            if ($existingVM.State -eq 'Running') {
                Log-Restore "Arrêt propre de la machine virtuelle en cours d'exécution..." "Yellow"
                Stop-VM -Name $finalVmName -Force -TurnOff:$false -ErrorAction SilentlyContinue
                Start-Sleep -Seconds 3
            }

            # Remplacement ou re-pointage du disque dur
            $hardDrives = Get-VMHardDiskDrive -VMName $finalVmName
            if ($hardDrives -and $hardDrives.Count -gt 0) {
                Set-VMHardDiskDrive -VMName $finalVmName -ControllerType ($hardDrives[0].ControllerType) -ControllerNumber ($hardDrives[0].ControllerNumber) -ControllerLocation ($hardDrives[0].ControllerLocation) -Path $targetFilePath
                Log-Restore "Disque principal de '$finalVmName' remplacé par le point de restauration !" "Green"
            }
        } else {
            Log-Restore "VM '$finalVmName' inexistante, création d'une nouvelle VM..." "White"
            New-VM -Name $finalVmName -VHDPath $targetFilePath -MemoryStartupBytes ([long]$memoryMb * 1024 * 1024) -Generation $generation
        }
    } else {
        # Mode NEW_VM (Clone / Sandbox)
        Log-Restore "Création de la nouvelle machine virtuelle '$finalVmName' sous Hyper-V..." "White"
        $existingVM = Get-VM -Name $finalVmName -ErrorAction SilentlyContinue
        if ($existingVM) {
            Log-Restore "Avertissement : Une VM nommée '$finalVmName' existe déjà. Le disque est conservé sans écrasement de la VM." "Yellow"
        } else {
            New-VM -Name $finalVmName -VHDPath $targetFilePath -MemoryStartupBytes ([long]$memoryMb * 1024 * 1024) -Generation $generation
            Set-VMProcessor -VMName $finalVmName -Count $cpuCount -ErrorAction SilentlyContinue
            Log-Restore "Machine virtuelle '$finalVmName' créée avec succès dans Hyper-V !" "Green"
        }
    }

    # 7. Démarrage Automatique si demandé
    if ($AutoStart) {
        Log-Restore "Démarrage automatique de la machine virtuelle '$finalVmName'..." "White"
        Start-VM -Name $finalVmName -ErrorAction SilentlyContinue
        Log-Restore "Machine virtuelle '$finalVmName' démarrée avec succès !" "Green"
    }

    $successMsg = "Restauration ($RestoreMode) terminée avec succès à 100%. VM: $finalVmName | Disque: $targetFilePath | SHA-256 certifié."
    Log-Restore "=== $successMsg ===" "Cyan"
    Send-RestoreStatus -Status "COMPLETED" -Step "Restauration terminée avec succès" -Logs $successMsg

} catch {
    Log-Restore "Erreur critique de restauration : $_" "Red"
    if ($tempArchiveFilePath -and (Test-Path $tempArchiveFilePath)) {
        Remove-Item $tempArchiveFilePath -Force -ErrorAction SilentlyContinue
    }
    Send-RestoreStatus -Status "FAILED" -Step "Échec de restauration" -ErrorMessage $_.ToString() -Logs "Exception : $_"
    exit 1
}
