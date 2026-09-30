import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import assert from 'assert';
import request from 'supertest';
import express from 'express';
import { execFileSync } from 'child_process';

async function main() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'dalibackup-source-test-'));
  const sourceDir = path.join(root, 'source');
  const storageDir = path.join(root, 'storage');
  await fs.mkdir(sourceDir);
  await fs.mkdir(storageDir);
  process.env.DATABASE_FILE = path.join(root, 'test.db');
  const { db, initDatabase } = await import('../src/config/database');
  const { runSourceBackup } = await import('../src/sources/sourceEngine');
  const { restoreRouter } = await import('../src/routes/restoreRoutes');
  const { generateUserToken } = await import('../src/auth/singleUserAuth');
  db.exec("CREATE TABLE legacy_marker (value TEXT); INSERT INTO legacy_marker VALUES ('preserved')");
  initDatabase();
  assert.strictEqual((db.prepare('SELECT value FROM legacy_marker').get() as any).value, 'preserved');
  await fs.access(`${process.env.DATABASE_FILE}.pre-v1.1.3.bak`);
  db.prepare("INSERT INTO admin_user (id,username,password_hash) VALUES (1,'admin','test')").run();
  const auth = `Bearer ${generateUserToken({ id: 1, username: 'admin', email: 'admin@dalibackup.local' })}`;
  const app = express(); app.use('/api/restore-points', restoreRouter);
  const oldPath = process.env.PATH;
  try {
    db.prepare("INSERT INTO backup_sources (id,name,type,source_path) VALUES ('src-test','Folder','SMB',?)").run(sourceDir);
    db.prepare("INSERT INTO storage_targets (id,name,type,remote_path) VALUES ('st-test','Local','NFS',?)").run(storageDir);
    db.prepare("INSERT INTO backup_jobs (id,name,hypervisor_type,vm_id,vm_name,storage_target_id,retention_count) VALUES ('job-test','Files','FOLDER','src-test','Folder','st-test',2)").run();
    await fs.writeFile(path.join(sourceDir, 'one.txt'), 'version one');
    await fs.writeFile(path.join(sourceDir, 'deleted.txt'), 'gone');
    const full = await runSourceBackup('job-test');
    assert.strictEqual(full.success, true, full.error);
    await fs.writeFile(path.join(sourceDir, 'one.txt'), 'version two is longer');
    await fs.unlink(path.join(sourceDir, 'deleted.txt'));
    const incremental = await runSourceBackup('job-test');
    assert.strictEqual(incremental.success, true, incremental.error);
    const point = db.prepare('SELECT * FROM restore_points WHERE id = ?').get(incremental.restorePointId) as any;
    const metadata = JSON.parse(point.vm_metadata);
    assert.strictEqual(metadata.full, false);
    assert.deepStrictEqual(metadata.changed, ['one.txt']);
    assert.deepStrictEqual(metadata.deleted, ['deleted.txt']);
    assert.strictEqual(metadata.previous_point_id, full.restorePointId);
    const chain = await request(app).get(`/api/restore-points/${incremental.restorePointId}/chain`).set('Authorization', auth);
    assert.strictEqual(chain.status, 200);
    assert.deepStrictEqual(chain.body.chain.map((row: any) => row.id), [full.restorePointId, incremental.restorePointId]);
    const archives = chain.body.chain.map((row: any) => path.join(storageDir, row.file_path));
    const restored = path.join(root, 'restored');
    execFileSync(process.execPath, [path.join(process.cwd(), 'scripts/restore-folder-chain.mjs'), restored, ...archives]);
    assert.strictEqual(await fs.readFile(path.join(restored, 'one.txt'), 'utf8'), 'version two is longer');
    await assert.rejects(fs.access(path.join(restored, 'deleted.txt')));
    const prematureDelete = await request(app).delete(`/api/restore-points/${full.restorePointId}`).set('Authorization', auth);
    assert.strictEqual(prematureDelete.status, 409);
    const deleteLatest = await request(app).delete(`/api/restore-points/${incremental.restorePointId}`).set('Authorization', auth);
    assert.strictEqual(deleteLatest.status, 200);
    const next = await runSourceBackup('job-test');
    assert.strictEqual(next.success, true, next.error);
    const nextPoint = db.prepare('SELECT vm_metadata FROM restore_points WHERE id = ?').get(next.restorePointId) as any;
    assert.strictEqual(JSON.parse(nextPoint.vm_metadata).full, true, 'a deleted latest delta requires a new full base');

    if (process.platform !== 'win32') {
      const binDir = path.join(root, 'bin');
      await fs.mkdir(binDir);
      const fakeDump = `#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const tool = path.basename(process.argv[1]);
if (tool === 'sqlcmd') {
  const query = process.argv[process.argv.indexOf('-Q') + 1];
  const file = query.match(/TO DISK = N'([^']+)'/)[1];
  fs.writeFileSync(file, 'BACKUP DATABASE TEST');
} else process.stdout.write('CREATE TABLE test (id int);\\n');
`;
      for (const tool of ['pg_dump', 'mysqldump', 'sqlcmd']) {
        const file = path.join(binDir, tool);
        await fs.writeFile(file, fakeDump, { mode: 0o755 });
      }
      process.env.PATH = `${binDir}${path.delimiter}${oldPath}`;
      for (const type of ['POSTGRES', 'MYSQL', 'MSSQL']) {
        const sourceId = `src-${type}`;
        const jobId = `job-${type}`;
        db.prepare(`INSERT INTO backup_sources (id,name,type,host,username,password_encrypted,database_name,source_path,server_backup_path)
          VALUES (?, ?, ?, 'localhost', 'tester', NULL, 'sample', ?, ?)`)
          .run(sourceId, type, type, sourceDir, sourceDir);
        db.prepare(`INSERT INTO backup_jobs (id,name,hypervisor_type,vm_id,vm_name,storage_target_id)
          VALUES (?, ?, 'DATABASE', ?, ?, 'st-test')`).run(jobId, type, sourceId, type);
        const result = await runSourceBackup(jobId);
        assert.strictEqual(result.success, true, `${type}: ${result.error}`);
        const point = db.prepare('SELECT file_path, vm_metadata FROM restore_points WHERE id = ?').get(result.restorePointId) as any;
        assert.strictEqual(JSON.parse(point.vm_metadata).database_type, type);
        await fs.access(path.join(storageDir, point.file_path));
      }
      assert.deepStrictEqual((await fs.readdir(sourceDir)).sort(), ['one.txt']);
    }
    console.log('Source backup passed: folder full/delta/restore/delete safety and simulated SQL dump pipelines.');
  } finally {
    process.env.PATH = oldPath;
    db.close();
    await fs.rm(root, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
