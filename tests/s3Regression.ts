import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { AddressInfo } from 'node:net';
import { Readable } from 'node:stream';
import { randomBytes } from 'node:crypto';
import { S3Provider } from '../src/storage/s3Provider';

// Local protocol fixture, not a claim of AWS/MinIO deployment certification.
async function run() {
  const objects = new Map<string, Buffer>();
  let denyDelete = false;
  const server = createServer(async (req, res) => {
    const url = new URL(req.url!, 'http://localhost');
    const key = decodeURIComponent(url.pathname.slice('/test-bucket/'.length));
    res.setHeader('Content-Type', 'application/xml');
    if (req.method === 'HEAD') { res.end(); return; }
    if (req.method === 'PUT') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      objects.set(key, Buffer.concat(chunks));
      res.setHeader('ETag', '"test-etag"'); res.end(); return;
    }
    if (req.method === 'DELETE') {
      if (denyDelete) { res.statusCode = 403; res.end('<Error><Code>AccessDenied</Code></Error>'); return; }
      objects.delete(key); res.statusCode = 204; res.end(); return;
    }
    if (url.searchParams.has('list-type')) {
      const keys = [...objects.keys()].filter(k => k.startsWith(url.searchParams.get('prefix') || ''));
      const page = Number(url.searchParams.get('continuation-token') || 0);
      const item = keys[page];
      const truncated = page + 1 < keys.length;
      res.end(`<ListBucketResult><IsTruncated>${truncated}</IsTruncated>${truncated ? `<NextContinuationToken>${page + 1}</NextContinuationToken>` : ''}${item ? `<Contents><Key>${item}</Key><Size>${objects.get(item)!.length}</Size><LastModified>2026-01-01T00:00:00Z</LastModified></Contents>` : ''}</ListBucketResult>`);
      return;
    }
    if (!objects.has(key)) { res.statusCode = 404; res.end('<Error><Code>NoSuchKey</Code></Error>'); return; }
    res.setHeader('Content-Length', objects.get(key)!.length);
    res.end(objects.get(key));
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const provider = new S3Provider({ id: 's3', name: 's3', type: 'S3',
    host: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    username: 'fixture', password: 'fixture', remote_path: 'test-bucket/prefix' });
  try {
    assert.equal((await provider.testConnection()).success, true);
    const payload = randomBytes(512 * 1024);
    const result = await provider.uploadStream('disk.vhdx', Readable.from(payload));
    assert.equal(result.bytesWritten, payload.length);
    const chunks: Buffer[] = [];
    for await (const chunk of await provider.downloadStream(result.path)) chunks.push(Buffer.from(chunk));
    assert.deepEqual(Buffer.concat(chunks), payload);
    await provider.uploadStream('second.vhdx', Readable.from('second'));
    assert.equal((await provider.listBackups()).length, 2, 'all S3 pages must be listed');
    await assert.rejects(provider.downloadStream('../escape'));
    await assert.rejects(provider.downloadStream('missing'));
    denyDelete = true;
    await assert.rejects(provider.deleteFile(result.path));
    denyDelete = false;
    await provider.deleteFile(result.path);
    assert.equal((await provider.listBackups()).length, 1);
    console.log('S3 HTTP fixture passed: upload/download equality, pagination, missing object, access denial, delete.');
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
}
run().catch(err => { console.error(err); process.exitCode = 1; });
