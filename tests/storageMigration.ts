import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dalibackup-migration-'));
process.env.DATABASE_FILE = path.join(dir, 'old.db');
const old = new DatabaseSync(process.env.DATABASE_FILE);
old.exec(`CREATE TABLE storage_targets (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL CHECK (type IN ('NFS', 'SFTP', 'FTP')),
 host TEXT, port INTEGER, username TEXT, password TEXT, private_key TEXT,
 remote_path TEXT NOT NULL, is_default INTEGER DEFAULT 0,
 created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO storage_targets (id, name, type, password, remote_path) VALUES ('old', 'existing', 'SFTP', 'encrypted-secret', '/backup');`);
old.close();
const { db, initDatabase } = require('../src/config/database');
try {
  initDatabase();
  initDatabase();
  assert.equal(db.prepare("SELECT password FROM storage_targets WHERE id = 'old'").get().password, 'encrypted-secret');
  for (const type of ['SMB', 'S3', 'FTPS']) {
    db.prepare('INSERT INTO storage_targets (id, name, type, remote_path) VALUES (?, ?, ?, ?)').run(type, type, type, 'test');
  }
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  console.log('Legacy storage migration passed: credentials preserved, new types, idempotent initialization.');
} finally {
  db.close();
  fs.rmSync(dir, { recursive: true, force: true });
}
