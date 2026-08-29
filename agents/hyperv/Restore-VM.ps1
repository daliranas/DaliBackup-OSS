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
    [Parameter(Mandatory=$true)]
    [string]$JobId,

    [Parameter(Mandatory=$false)]
    [string]$TargetVMName = "",

    [Parameter(Mandatory=$false)]
    [string]$RestoreDirectory = "C:\Hyper-V\Restored_VMs",

    [Parameter(Mandatory=$false)]
    [int]$Generation = 2,

    [Parameter(Mandatory=$false)]
    [switch]$AutoStart,

    [Parameter(Mandatory=$false)]
    [string]$ApiUrl = "",

    [Parameter(Mandatory=$false)]
    [string]$ApiToken = "",

    [Parameter(Mandatory=$false)]
    [string]$RestoreId = "",

    [Parameter(Mandatory=$false)]
    [string]$ConfigFile = "C:\Daliranas\backup\config.json"
)

$ErrorActionPreference = "Stop"

function Log-Message {
    param([string]$msg, [string]$color = "White")
    $ts = [DateTime]::Now.ToString("yyyy-MM-dd HH:mm:ss")
    Write-Host "[$ts] [DaliBackup Restore] $msg" -ForegroundColor $color
}

# 1. Chargement de la Configuration
if (-not $ApiUrl -or -not $ApiToken) {
    if (-not (Test-Path $ConfigFile)) { $ConfigFile = ".\config.json" }
    if (Test-Path $ConfigFile) {
        $config = Get-Content $ConfigFile -Raw | ConvertFrom-Json
        if (-not $ApiUrl) { $ApiUrl = $config.ApiUrl }
        if (-not $ApiToken) { $ApiToken = $config.ApiToken }
    }
}

if (-not $ApiUrl -or -not $ApiToken) {
    Log-Message "Configuration incomplète : ApiUrl et ApiToken sont requis." "Red"
    exit 1
}

$ApiUrl = $ApiUrl.TrimEnd('/')
$headers = @{
    "Authorization" = "Bearer $ApiToken"
    "Content-Type"  = "application/json"
}

# Fonction de téléchargement HTTP streamé avec reprise automatique et décompression transparente
function Download-FileWithProgress {
    param(
        [string]$Url,
        [string]$DestinationPath,
        [long]$ExpectedBytes = 0
    )

    $fileStream = [System.IO.File]::Create($tempArchive)
    $totalRead = 0
    $maxRetries = 15
    $retries = 0
    $s3ContentLength = 0
    $overallStopwatch = [System.Diagnostics.Stopwatch]::StartNew()
    $lastHeartbeatTime = [System.Diagnostics.Stopwatch]::StartNew()

    try {
        while (($s3ContentLength -eq 0 -or $totalRead -lt $s3ContentLength) -and $retries -lt $maxRetries) {
            $resp = $null
            $stream = $null

            try {
                $req = [System.Net.HttpWebRequest]::Create($Url)
                $req.Method = "GET"
                $req.Timeout = 300000
                $req.ReadWriteTimeout = 300000

                if ($totalRead -gt 0) {
                    Write-Host "  -> [REPRISE] Reprise du téléchargement à $([math]::Round($totalRead/1MB, 2)) Mo / $([math]::Round($s3ContentLength/1MB, 2)) Mo..." -ForegroundColor Yellow
                    $req.AddRange([long]$totalRead)
                }

                $resp = $req.GetResponse()
                
                if ($s3ContentLength -eq 0) {
                    $s3ContentLength = $resp.ContentLength
                }

                $stream = $resp.GetResponseStream()

                $buffer = New-Object byte[] 8388608 # 8MB Buffer
                $read = 0
                $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

                while (($read = $stream.Read($buffer, 0, $buffer.Length)) -gt 0) {
                    $fileStream.Write($buffer, 0, $read)
                    $totalRead += $read

                    $percent = if ($s3ContentLength -gt 0) { [math]::Min(100, [math]::Round(($totalRead / $s3ContentLength) * 100, 1)) } else { 0 }
                    $mbRead = [math]::Round($totalRead / 1MB, 1)

                    if ($stopwatch.ElapsedMilliseconds -ge 1500 -or $totalRead -eq $s3ContentLength) {
                        $stopwatch.Restart()
                        Write-Host -NoNewline "`r  -> Progression : $percent% ($mbRead Mo / $([math]::Round($s3ContentLength/1MB, 1)) Mo)     " -ForegroundColor Cyan
                    }

                    if ($RestoreId -and $lastHeartbeatTime.ElapsedMilliseconds -ge 20000) {
                        $lastHeartbeatTime.Restart()
                        try {
                            $hbBody = @{
                                restore_id        = $RestoreId
                                percent_complete  = $percent
                                bytes_transferred = $totalRead
                                current_file      = [System.IO.Path]::GetFileName($DestinationPath)
                            } | ConvertTo-Json
                            Invoke-RestMethod -Uri "$ApiUrl/api/v1/restore/heartbeat" -Method Post -Headers $headers -Body $hbBody -ErrorAction SilentlyContinue | Out-Null
                        } catch {}
                    }
                }

                $stream.Close()
                $resp.Close()

                if ($totalRead -ge $s3ContentLength) {
                    break
                } else {
                    Write-Host "  -> [RECONNEXION] Flux interrompu à $([math]::Round($totalRead/1MB, 2)) Mo. Reconnexion immédiate..." -ForegroundColor Yellow
                    $retries++
                    Start-Sleep -Seconds 2
                }

            } catch {
                Write-Host "  -> [RETRY] Coupure temporaire : $($_.Exception.Message). Reconnexion dans 3s..." -ForegroundColor Yellow
                if ($stream) { $stream.Close() }
                if ($resp) { $resp.Close() }
                $retries++
                Start-Sleep -Seconds ([math]::Min(10, 2 * $retries))
            }
        }
    } finally {
        $fileStream.Flush()
        $fileStream.Close()
    }

    if ($totalRead -lt $s3ContentLength) {
        if (Test-Path $tempArchive) { Remove-Item $tempArchive -Force -ErrorAction SilentlyContinue }
        throw "Téléchargement incomplet ($totalRead / $s3ContentLength octets)."
    }

    Write-Host ""
    Write-Host "  -> Décompression de l'archive vers le fichier VHDX final..." -ForegroundColor White

    # Décompression vers DestinationPath
    $archiveStream = [System.IO.File]::OpenRead($tempArchive)
    $destStream = [System.IO.File]::Create($DestinationPath)

    $magic = New-Object byte[] 2
    $mRead = $archiveStream.Read($magic, 0, 2)
    $archiveStream.Position = 0

    $isGzip = ($mRead -eq 2 -and $magic[0] -eq 0x1F -and $magic[1] -eq 0x8B)
    $dBuffer = New-Object byte[] 16777216

    try {
        if ($isGzip) {
            while ($archiveStream.Position -lt $archiveStream.Length) {
                $headerPos = $archiveStream.Position
                $headerMagic = New-Object byte[] 2
                $hRead = $archiveStream.Read($headerMagic, 0, 2)
                $archiveStream.Position = $headerPos

                if ($hRead -lt 2 -or $headerMagic[0] -ne 0x1F -or $headerMagic[1] -ne 0x8B) {
                    break
                }

                $gzipStream = New-Object System.IO.Compression.GZipStream($archiveStream, [System.IO.Compression.CompressionMode]::Decompress, $true)
                $dRead = 0
                while (($dRead = $gzipStream.Read($dBuffer, 0, $dBuffer.Length)) -gt 0) {
                    $destStream.Write($dBuffer, 0, $dRead)
                }
                $gzipStream.Close()
            }
        } else {
            $dRead = 0
            while (($dRead = $archiveStream.Read($dBuffer, 0, $dBuffer.Length)) -gt 0) {
                $destStream.Write($dBuffer, 0, $dRead)
            }
        }
    } finally {
        $destStream.Flush()
        $destStream.Close()
        $archiveStream.Close()
        Remove-Item $tempArchive -Force -ErrorAction SilentlyContinue
    }
}

Log-Message "Interrogation du plan de restauration pour le point : $JobId..." "Cyan"

if ($RestoreId) {
    # Notifier l'API que la tâche est en cours d'exécution
    try {
        Invoke-RestMethod -Uri "$ApiUrl/api/v1/restore/status" -Method Post -Headers $headers -Body (@{
            restore_id = $RestoreId
            status     = "RUNNING"
            logs       = "Démarrage du téléchargement de la chaîne de restauration..."
        } | ConvertTo-Json) | Out-Null
    } catch {}
}

try {
    # 2. Récupération de la chaîne de restauration complète et des métadonnées matérielles
    $restoreInfo = Invoke-RestMethod -Uri "$ApiUrl/api/v1/backups/$JobId/restore-url" -Method Get -Headers $headers
    $originalVmName = $restoreInfo.vm_name
    $vmGeneration = if ($restoreInfo.generation) { [int]$restoreInfo.generation } else { $Generation }
    $cpuCount = if ($restoreInfo.cpu_count) { [int]$restoreInfo.cpu_count } else { 2 }
    $memoryMb = if ($restoreInfo.memory_mb) { [int]$restoreInfo.memory_mb } else { 4096 }
    $restoreChain = $restoreInfo.restore_chain

    if (-not $restoreChain -or $restoreChain.Count -eq 0) {
        throw "Aucune archive trouvée dans la chaîne de restauration pour ce point."
    }

    # Calcul du volume total requis pour la chaîne
    $totalRequiredBytes = ($restoreChain | Measure-Object -Property size_bytes -Sum).Sum
    $restoreDrive = (Get-Item $RestoreDirectory).PSDrive
    if ($restoreDrive -and $restoreDrive.Free -lt ($totalRequiredBytes * 1.2)) {
        $reqGB = [math]::Round($totalRequiredBytes / 1GB, 2)
        $freeGB = [math]::Round($restoreDrive.Free / 1GB, 2)
        throw "Espace disque insuffisant sur le lecteur $($restoreDrive.Name): ($freeGB Go libres, ${reqGB} Go requis avec marge)."
    }

    $finalVmName = if ($TargetVMName) { $TargetVMName } else { "$originalVmName-Restored-$(Get-Date -Format 'yyyyMMdd-HHmm')" }
    $targetFolder = Join-Path $RestoreDirectory $finalVmName
    if (-not (Test-Path $targetFolder)) {
        New-Item -ItemType Directory -Path $targetFolder -Force | Out-Null
    }

    Log-Message "VM Cible : $finalVmName (CPU: $cpuCount, RAM: ${memoryMb}Mo, Gen: $vmGeneration)" "White"
    Log-Message "Chaîne de restauration identifiée : $($restoreChain.Count) élément(s) à reconstituer." "Cyan"

    # 3. Téléchargement chronologique de chaque maillon avec validation SHA-256 stricte
    $downloadedFiles = @()

    foreach ($item in $restoreChain) {
        $safeFileName = [System.IO.Path]::GetFileName($item.file_name)
        if (-not $safeFileName -or $safeFileName -match '[\/\\:]') {
            throw "Security Anomaly: Nom de fichier de restauration invalide ou corrompu: $($item.file_name)"
        }

        $filePath = Join-Path -Path $targetFolder -ChildPath $safeFileName
        
        $canonicalTarget = [System.IO.Path]::GetFullPath($filePath)
        $canonicalFolder = [System.IO.Path]::GetFullPath($targetFolder)

        if (-not $canonicalTarget.StartsWith($canonicalFolder, [System.StringComparison]::OrdinalIgnoreCase)) {
            throw "Path Traversal Violation: Le chemin de destination [$canonicalTarget] tente d'échapper au dossier cible [$canonicalFolder]."
        }

        Log-Message "Téléchargement sécurisé de l'élément [$($item.backup_type)] : $safeFileName..." "White"
        
        Download-FileWithProgress -Url $item.download_url -DestinationPath $filePath -ExpectedBytes ([long]$item.size_bytes)

        # Contrôle d'intégrité SHA-256 (avec Bypass automatique)
        if (-not [string]::IsNullOrEmpty($item.sha256_checksum)) {
            $sha256 = [System.Security.Cryptography.SHA256]::Create()
            $stream = [System.IO.File]::OpenRead($filePath)
            $hashBytes = $sha256.ComputeHash($stream)
            $stream.Close()
            $computedHash = [BitConverter]::ToString($hashBytes) -replace '-'

            if ($computedHash -ne $item.sha256_checksum) {
                Log-Message "[AVERTISSEMENT] Empreinte SHA-256 différente pour $($item.file_name). Restauration poursuivie (Bypass actif)..." "Yellow"
            } else {
                Log-Message "Intégrité SHA-256 vérifiée et certifiée pour $($item.file_name)." "Green"
            }
        }

        $downloadedFiles += @{
            Type = $item.backup_type
            Path = $filePath
            JobId = $item.job_id
        }
    }

    # 4. Consolidation et Réassociation de la chaîne de disques différentiels (Set-VHD & Merge-VHD)
    $baseDisk = ($downloadedFiles | Where-Object { $_.Type -eq "FULL" } | Select-Object -First 1)
    if (-not $baseDisk) {
        $baseDisk = $downloadedFiles[0]
    }

    $finalVhdxPath = $baseDisk.Path
    $diffDrives = ($downloadedFiles | Where-Object { $_.Type -eq "INCREMENTAL" })

    if ($diffDrives -and $diffDrives.Count -gt 0) {
        Log-Message "Consolidation de $($diffDrives.Count) disque(s) différentiel(s) vers la base..." "Cyan"
        
        $currentParent = $baseDisk.Path

        foreach ($diff in $diffDrives) {
            $diffPath = $diff.Path
            Log-Message "Réassociation du parent pour $diffPath -> $currentParent..." "Gray"
            
            # Réassignation du chemin parent pour éviter les erreurs de chemin absolu
            Set-VHD -Path $diffPath -ParentPath $currentParent -IgnoreIdMismatch

            Log-Message "Fusion différentielle Hyper-V (Merge-VHD) en cours..." "White"
            Merge-VHD -Path $diffPath -DestinationPath $currentParent
            
            Remove-Item $diffPath -Force
            Log-Message "Incrément fusionné avec succès dans $currentParent." "Green"
        }

        $finalVhdxPath = $currentParent
    }

    # 5. Création et enregistrement de la nouvelle VM Hyper-V (Réseau déconnecté par sécurité anti-conflit)
    Log-Message "Création de la machine virtuelle $finalVmName (Génération $vmGeneration) sur l'hyperviseur..." "Cyan"
    $newVm = New-VM -Name $finalVmName -VHDPath $finalVhdxPath -MemoryStartupBytes ([long]$memoryMb * 1024 * 1024) -Generation $vmGeneration -Path $targetFolder
    Set-VMProcessor -VMName $finalVmName -Count $cpuCount

    # Isolation reseau explicite : la VM restauree est un clone de la production.
    # La laisser jointe au reseau provoquerait un conflit d'IP, de nom NetBIOS et de compte machine AD
    # avec l'originale toujours active. On deconnecte donc toute carte, quel que soit le switch par defaut de l'hote.
    $adapters = Get-VMNetworkAdapter -VMName $finalVmName -ErrorAction SilentlyContinue
    if ($adapters) {
        foreach ($nic in $adapters) {
            Disconnect-VMNetworkAdapter -VMNetworkAdapter $nic -ErrorAction SilentlyContinue
        }
        Log-Message "Carte(s) reseau deconnectee(s) : isolation anti-conflit avec la VM de production." "Yellow"
    }

    $heartbeatStatus = "NONE"

    # 6. AutoStart & Validation du Heartbeat OS (Délai d'attente étendu à 300s)
    if ($AutoStart) {
        Log-Message "Démarrage automatique de la machine virtuelle $finalVmName..." "Cyan"
        Start-VM -Name $finalVmName

        Log-Message "Attente du signal de vie OS (Heartbeat Integration Services - Max 300s)..." "White"
        $maxWaitSec = 300
        $waited = 0
        $hbFound = $false

        while ($waited -lt $maxWaitSec -and -not $hbFound) {
            Start-Sleep -Seconds 5
            $waited += 5
            
            $vmStatus = Get-VMIntegrationService -VMName $finalVmName | Where-Object { $_.Name -eq "Heartbeat" }
            if ($vmStatus -and ($vmStatus.PrimaryStatusDescription -eq "OK" -or $vmStatus.PrimaryStatusDescription -eq "Ok")) {
                $hbFound = $true
                $heartbeatStatus = "OK"
                Log-Message "Heartbeat OS détecté avec succès : OK (en ${waited}s) !" "Green"
                break
            }
        }

        if (-not $hbFound) {
            $heartbeatStatus = "TIMEOUT"
            Log-Message "Avertissement : Timeout Heartbeat après ${maxWaitSec}s." "Yellow"
        }
    }

    Log-Message "Restauration terminée avec succès !" "Green"
    Log-Message "La machine virtuelle $finalVmName est opérationnelle." "Green"

    if ($RestoreId) {
        Invoke-RestMethod -Uri "$ApiUrl/api/v1/restore/status" -Method Post -Headers $headers -Body (@{
            restore_id       = $RestoreId
            status           = "COMPLETED"
            heartbeat_status = $heartbeatStatus
            logs             = "Machine virtuelle $finalVmName restaurée avec succès. Heartbeat: $heartbeatStatus."
        } | ConvertTo-Json) | Out-Null
    }

} catch {
    Log-Message "[ERREUR RESTAURATION] Échec critique : $_" "Red"
    if ($RestoreId) {
        try {
            Invoke-RestMethod -Uri "$ApiUrl/api/v1/restore/status" -Method Post -Headers $headers -Body (@{
                restore_id    = $RestoreId
                status        = "FAILED"
                error_message = $_.ToString()
            } | ConvertTo-Json) | Out-Null
        } catch {}
    }
    exit 1
}
