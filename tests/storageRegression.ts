import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import { NfsProvider } from '../src/storage/nfsProvider';
import { remotePath } from '../src/storage/remotePath';

async function run() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dalibackup-storage-'));
  const provider = new NfsProvider({ id: 'test', name: 'test', type: 'NFS', remote_path: root });
  try {
    assert.equal(remotePath('/backups', 'vm/file.gz'), '/backups/vm/file.gz');
    assert.equal(remotePath('/backups', '/backups/vm/file.gz'), '/backups/vm/file.gz');
    assert.throws(() => remotePath('/backups', '../outside'));
    assert.throws(() => remotePath('/backups', '/backups-other/file'));
    const original = Buffer.from('complete backup\0with binary data');
    const result = await provider.uploadStream('vm.bin', Readable.from(original));
    assert.equal(result.bytesWritten, original.length);
    const chunks: Buffer[] = [];
    for await (const chunk of await provider.downloadStream(result.path)) chunks.push(Buffer.from(chunk));
    assert.deepEqual(Buffer.concat(chunks), original);
    const broken = Readable.from((async function* () { yield 'partial'; throw new Error('connection lost'); })());
    await assert.rejects(provider.uploadStream('vm.bin', broken), /connection lost/);
    assert.deepEqual(await fs.readFile(path.join(root, 'vm.bin')), original);
    assert.deepEqual(await fs.readdir(root), ['vm.bin']);
    await assert.rejects(provider.uploadStream('../escape', Readable.from('bad')), /escapes/);
    await assert.rejects(provider.deleteFile(root), /root/);
    await fs.mkdir(path.join(root, 'directory'));
    await assert.rejects(provider.deleteFile('directory'));
    if (process.platform !== 'win32') {
      await fs.symlink(os.tmpdir(), path.join(root, 'outside'));
      await assert.rejects(provider.downloadStream('outside/anything'), /symlink/);
    }
    assert.equal((await provider.listBackups()).length, 1);
    const capacity = await provider.getFreeSpace();
    assert.ok(capacity.totalBytes > 0 && capacity.freeBytes <= capacity.totalBytes);
    assert.equal(await provider.deleteFile(result.path), true);
    assert.equal(await provider.deleteFile(result.path), false);
    console.log('Storage regressions passed: round-trip, interrupted overwrite, cleanup, traversal, symlink, deletion and capacity.');
  } finally { await fs.rm(root, { recursive: true, force: true }); }
}
run().catch(err => { console.error(err); process.exitCode = 1; });
