import assert from 'node:assert/strict';
import { compareVersions, getUpdateStatus } from '../src/services/updateService';

async function run(): Promise<void> {
  assert.equal(compareVersions('v1.1.2', '1.1.0'), 1);
  assert.equal(compareVersions('1.1.2', 'v1.1.2'), 0);
  assert.equal(compareVersions('1.1.0', '1.1.2'), -1);
  assert.throws(() => compareVersions('1.1.2-preview', '1.1.2'));

  const originalFetch = globalThis.fetch;
  let requests = 0;
  const tag = 'v1.1.4';
  const archive = `dalibackup-oss-server-${tag}.tar.gz`;
  try {
    globalThis.fetch = async () => {
      requests++;
      return new Response(JSON.stringify({
        tag_name: tag,
        published_at: '2026-10-01T00:00:00Z',
        assets: [
          { name: archive, browser_download_url: `https://github.com/daliranas/DaliBackup-OSS/releases/download/${tag}/${archive}` },
          { name: 'SHA256SUMS.txt', browser_download_url: `https://github.com/daliranas/DaliBackup-OSS/releases/download/${tag}/SHA256SUMS.txt` }
        ]
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    };
    const status = await getUpdateStatus(true);
    assert.equal(status.currentVersion, '1.1.3');
    assert.equal(status.latestVersion, '1.1.4');
    assert.equal(status.updateAvailable, true);
    assert.ok(status.serverArchiveUrl?.endsWith(archive));
    assert.ok(status.checksumUrl?.endsWith('SHA256SUMS.txt'));
    await getUpdateStatus();
    assert.equal(requests, 1, 'a cached check must not call GitHub again');
  } finally {
    globalThis.fetch = originalFetch;
  }
  console.log('Update service passed: version comparison, trusted release assets and cache.');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
