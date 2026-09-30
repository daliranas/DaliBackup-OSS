<#
.SYNOPSIS
    Builds the self-contained DaliBackup Hyper-V agent executable.

.DESCRIPTION
    Downloads PS2EXE for the current user when necessary and embeds the single
    DaliAgent-HyperV.ps1 worker in DaliBackup-HyperV-Agent.exe.  The resulting
    executable has no sidecar PowerShell files and can install its own Windows
    scheduled task.
#>
[CmdletBinding()]
param(
    [string]$OutputPath = (Join-Path $PSScriptRoot "DaliBackup-HyperV-Agent.exe")
)

$ErrorActionPreference = "Stop"
$sourcePath = Join-Path $PSScriptRoot "DaliAgent-HyperV.ps1"

if (-not (Test-Path -LiteralPath $sourcePath)) {
    throw "Source agent not found: $sourcePath"
}

if (-not (Get-Command Invoke-ps2exe -ErrorAction SilentlyContinue)) {
    Install-Module -Name ps2exe -Scope CurrentUser -Repository PSGallery -Force -AllowClobber
}

Import-Module ps2exe -Force
$outputDirectory = Split-Path -Parent $OutputPath
if ($outputDirectory -and -not (Test-Path -LiteralPath $outputDirectory)) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
}

Invoke-ps2exe -InputFile $sourcePath -OutputFile $OutputPath -x64 -requireAdmin -title "DaliBackup Hyper-V Agent" -product "DaliBackup-OSS"
Write-Host "Executable created: $OutputPath" -ForegroundColor Green
