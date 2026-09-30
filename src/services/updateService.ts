import { version as currentVersion } from '../../package.json';

const RELEASE_API = 'https://api.github.com/repos/daliranas/DaliBackup-OSS/releases/latest';
const CACHE_MS = 30 * 60 * 1000;
const MAX_RESPONSE_BYTES = 256 * 1024;

export interface UpdateStatus {
  currentVersion: string;
  latestVersion: string;
  updateAvailable: boolean;
  releaseUrl: string;
  publishedAt: string | null;
  serverArchiveUrl: string | null;
  checksumUrl: string | null;
}

let cached: UpdateStatus | null = null;
let cacheUntil = 0;

export function compareVersions(a: string, b: string): number {
  const parse = (value: string): number[] => {
    if (!/^v?\d+\.\d+\.\d+$/.test(value)) throw new Error('Version GitHub invalide.');
    return value.replace(/^v/, '').split('.').map(Number);
  };
  const left = parse(a);
  const right = parse(b);
  for (let index = 0; index < 3; index++) {
    if (left[index] !== right[index]) return Math.sign(left[index] - right[index]);
  }
  return 0;
}

export async function getUpdateStatus(force = false): Promise<UpdateStatus> {
  if (!force && cached && Date.now() < cacheUntil) return cached;

  const response = await fetch(RELEASE_API, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': `DaliBackup-OSS/${currentVersion}`,
      'X-GitHub-Api-Version': '2022-11-28'
    },
    signal: AbortSignal.timeout(8000)
  });
  if (!response.ok) throw new Error(`GitHub a répondu HTTP ${response.status}.`);

  const length = Number(response.headers.get('content-length') || 0);
  if (length > MAX_RESPONSE_BYTES) throw new Error('Réponse GitHub trop volumineuse.');
  const body = await response.text();
  if (Buffer.byteLength(body) > MAX_RESPONSE_BYTES) throw new Error('Réponse GitHub trop volumineuse.');

  const release = JSON.parse(body);
  const tag = release?.tag_name;
  if (typeof tag !== 'string') throw new Error('Release GitHub invalide.');
  const latestVersion = tag.replace(/^v/, '');
  compareVersions(latestVersion, currentVersion);

  const releaseUrl = `https://github.com/daliranas/DaliBackup-OSS/releases/tag/${tag}`;
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const trustedAsset = (name: string): string | null => {
    const asset = assets.find((entry: any) => entry?.name === name);
    const url = asset?.browser_download_url;
    if (typeof url !== 'string') return null;
    const expected = `https://github.com/daliranas/DaliBackup-OSS/releases/download/${tag}/${name}`;
    return url === expected ? url : null;
  };

  cached = {
    currentVersion,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, currentVersion) > 0,
    releaseUrl,
    publishedAt: typeof release.published_at === 'string' ? release.published_at : null,
    serverArchiveUrl: trustedAsset(`dalibackup-oss-server-${tag}.tar.gz`),
    checksumUrl: trustedAsset('SHA256SUMS.txt')
  };
  cacheUntil = Date.now() + CACHE_MS;
  return cached;
}
