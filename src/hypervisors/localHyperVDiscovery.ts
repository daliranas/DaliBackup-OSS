import { execFile } from 'child_process';
import os from 'os';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);
const CACHE_DURATION_MS = 30_000;

export interface LocalHyperVVm {
  id: string;
  name: string;
  state: string;
}

export interface LocalHyperVDiscoveryResult {
  available: boolean;
  hostname: string;
  vms: LocalHyperVVm[];
  reason?: string;
}

let cachedResult: LocalHyperVDiscoveryResult | null = null;
let cacheExpiresAt = 0;

/** Detects Hyper-V only on the machine running DaliBackup, never remotely. */
export async function discoverLocalHyperV(force = false): Promise<LocalHyperVDiscoveryResult> {
  const hostname = os.hostname();
  if (!force && cachedResult && Date.now() < cacheExpiresAt) return cachedResult;

  if (process.platform !== 'win32') {
    return cache({ available: false, hostname, vms: [], reason: 'Le serveur DaliBackup ne tourne pas sous Windows.' });
  }

  const command = [
    "$ErrorActionPreference = 'Stop'",
    '[Console]::OutputEncoding = [Text.UTF8Encoding]::new()',
    'Import-Module Hyper-V -ErrorAction Stop',
    '$vms = @(Get-VM -ErrorAction Stop)',
    "if ($vms.Count -eq 0) { '[]' } else { $vms | Select-Object @{Name='id';Expression={$_.Id.ToString()}}, @{Name='name';Expression={$_.Name}}, @{Name='state';Expression={$_.State.ToString()}} | ConvertTo-Json -Compress }"
  ].join('; ');

  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoLogo', '-NoProfile', '-NonInteractive', '-Command', command
    ], { windowsHide: true, timeout: 15_000, maxBuffer: 1024 * 1024 });
    const parsed = stdout.trim() ? JSON.parse(stdout) : [];
    const vms = (Array.isArray(parsed) ? parsed : [parsed]).map((vm: any) => ({
      id: String(vm.id), name: String(vm.name), state: String(vm.state)
    }));
    return cache({ available: true, hostname, vms });
  } catch {
    return cache({
      available: false,
      hostname,
      vms: [],
      reason: 'Le rôle ou le module Hyper-V est indisponible pour le compte qui exécute DaliBackup.'
    });
  }
}

function cache(result: LocalHyperVDiscoveryResult): LocalHyperVDiscoveryResult {
  cachedResult = result;
  cacheExpiresAt = Date.now() + CACHE_DURATION_MS;
  return result;
}
