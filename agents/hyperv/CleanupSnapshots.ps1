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
Write-Host "Nettoyage des checkpoints de backup résiduels..." -ForegroundColor Cyan

Get-VM | ForEach-Object {
    $vmName = $_.Name
    Get-VMSnapshot -VMName $vmName | Where-Object { $_.Name -like "BKP-SNAPSHOT-*" } | ForEach-Object {
        Write-Host "Suppression et fusion du snapshot : $($_.Name) sur $vmName" -ForegroundColor Yellow
        Remove-VMSnapshot -VMName $vmName -Name $_.Name -ErrorAction SilentlyContinue
    }
}

Write-Host "Nettoyage terminé !" -ForegroundColor Green
