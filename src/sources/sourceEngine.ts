import fs from 'fs/promises';
import fsSync from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { spawn } from 'child_process';
import { pipeline } from 'stream/promises';
import { createGzip } from 'zlib';
import { db, logActivity } from '../config/database';
import { decryptSecret } from '../utils/cryptoVault';
import { getStorageProvider } from '../storage/storageFactory';
import { enforceRetention } from '../services/retentionService';
import { FolderSource, FolderSourceConfig, SourceFile } from './folderSource';

export interface BackupSource {
  id: string;
  name: string;
  type: 'MYSQL' | 'POSTGRES' | 'MSSQL' | 'FTP' | 'FTPS' | 'SFTP' | 'SMB';
  database_name?: string;
  server_backup_path?: string;
  password?: string;
  private_key?: string;
  source_path: string;
  host?: string;
  port?: number;
  username?: string;
}

export function getBackupSource(id: string): BackupSource {
  const row = db.prepare('SELECT * FROM backup_sources WHERE id = ?').get(id) as any;
  if (!row) throw new Error('Source de sauvegarde introuvable.');
  return { ...row, password: row.password_encrypted ? decryptSecret(row.password_encrypted) : undefined,
    private_key: row.private_key_encrypted ? decryptSecret(row.private_key_encrypted) : undefined };
}

async function runCommand(command: string, args: string[], env: NodeJS.ProcessEnv, output?: string, gzip = false): Promise<void> {
  const child = spawn(command, args, { env: { ...process.env, ...env }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', chunk => { stderr = (stderr + chunk.toString()).slice(-8192); });
  const streamed = output
    ? (gzip ? pipeline(child.stdout, createGzip({ level: 6 }), fsSync.createWriteStream(output, { flags: 'wx' }))
      : pipeline(child.stdout, fsSync.createWriteStream(output, { flags: 'wx' })))
    : pipeline(child.stdout, fsSync.createWriteStream(os.devNull));
  const exited = new Promise<void>((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error(`${command} a échoué (${code}) : ${stderr.trim()}`)));
  });
  await Promise.all([streamed, exited]);
}

export async function testBackupSource(source: BackupSource): Promise<void> {
  if (['FTP', 'FTPS', 'SFTP', 'SMB'].includes(source.type)) {
    const folder = new FolderSource(source as FolderSourceConfig);
    try { await folder.connect(); await folder.listFiles(100_000); } finally { await folder.close(); }
    return;
  }
  if (source.type === 'POSTGRES') {
    await runCommand('pg_dump', ['--host', source.host!, '--port', String(source.port || 5432), '--username', source.username || '',
      '--dbname', source.database_name!, '--schema-only', '--no-password'], { PGPASSWORD: source.password || '' });
  } else if (source.type === 'MYSQL') {
    const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'dalibackup-mysql-test-'));
    try {
      const optionFile = await writeMysqlOptions(source, temp);
      await runCommand('mysqldump', [`--defaults-extra-file=${optionFile}`, '--no-data', '--databases', source.database_name!], {});
    } finally { await fs.rm(temp, { recursive: true, force: true }); }
  } else {
    await runCommand('sqlcmd', ['-S', `${source.host}${source.port ? `,${source.port}` : ''}`, '-U', source.username || '',
      '-b', '-Q', 'SELECT 1;'], { SQLCMDPASSWORD: source.password || '' });
    await fs.access(source.source_path!, fsSync.constants.W_OK);
  }
}

async function writeMysqlOptions(source: BackupSource, temp: string): Promise<string> {
  const optionFile = path.join(temp, 'mysql.cnf');
  const quote = (value: string) => `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  for (const value of [source.host, source.username, source.password]) {
    if (value && /[\r\n]/.test(value)) throw new Error('Identifiant MySQL invalide.');
  }
  await fs.writeFile(optionFile, `[client]\nhost=${quote(source.host!)}\nport=${source.port || 3306}\nuser=${quote(source.username || '')}\npassword=${quote(source.password || '')}\n`, { mode: 0o600 });
  return optionFile;
}

async function createDatabaseDump(source: BackupSource, temp: string): Promise<{ file: string; format: string }> {
  const name = source.database_name || '';
  if (!/^[\p{L}\p{N}_.-]{1,128}$/u.test(name) || name.startsWith('-')) throw new Error('Nom de base invalide pour le client de sauvegarde.');
  if (source.type === 'POSTGRES') {
    const file = path.join(temp, 'database.sql.gz');
    await runCommand('pg_dump', ['--host', source.host!, '--port', String(source.port || 5432),
      '--username', source.username || '', '--dbname', name, '--format=plain', '--no-password'],
      { PGPASSWORD: source.password || '' }, file, true);
    return { file, format: 'sql.gz' };
  }
  if (source.type === 'MYSQL') {
    const file = path.join(temp, 'database.sql.gz');
    const optionFile = await writeMysqlOptions(source, temp);
    await runCommand('mysqldump', [`--defaults-extra-file=${optionFile}`, '--single-transaction', '--routines', '--triggers', '--events', '--databases', name], {}, file, true);
    return { file, format: 'sql.gz' };
  }
  const filename = `dalibackup-${crypto.randomUUID()}.bak`;
  const serverPath = (source.server_backup_path || '').includes('\\')
    ? path.win32.join(source.server_backup_path!, filename)
    : path.posix.join(source.server_backup_path!, filename);
  const accessible = path.join(source.source_path!, filename);
  const escapedName = name.replace(/]/g, ']]');
  const escapedPath = serverPath.replace(/'/g, "''");
  const query = `BACKUP DATABASE [${escapedName}] TO DISK = N'${escapedPath}' WITH COPY_ONLY, COMPRESSION, CHECKSUM, INIT;`;
  try {
    await runCommand('sqlcmd', ['-S', `${source.host}${source.port ? `,${source.port}` : ''}`, '-U', source.username || '', '-b', '-Q', query],
      { SQLCMDPASSWORD: source.password || '' });
    await fs.access(accessible, fsSync.constants.R_OK);
  } catch (error) {
    await fs.rm(accessible, { force: true }).catch(() => {});
    throw error;
  }
  return { file: accessible, format: 'bak' };
}

function archiveFactory(): any {
  const module = require('archiver');
  const options = { gzip: true, gzipOptions: { level: 6 } };
  if (typeof module === 'function') return module('tar', options);
  if (module.TarArchive) return new module.TarArchive(options);
  if (typeof module.default === 'function') return module.default('tar', options);
  throw new Error('Impossible de créer une archive tar.gz.');
}

async function createFolderArchive(source: BackupSource, job: any, pointId: string, temp: string): Promise<{
  file: string; metadata: any; state: SourceFile[];
}> {
  const folder = new FolderSource(source as FolderSourceConfig);
  try {
    await folder.connect();
    const state = await folder.listFiles();
    if (process.platform === 'win32') {
      const lower = new Set<string>();
      for (const file of state) {
        const key = file.path.toLowerCase();
        if (lower.has(key)) throw new Error(`Collision de noms insensible à la casse dans la source : ${file.path}`);
        lower.add(key);
      }
    }
    const priorRows = db.prepare('SELECT path, size_bytes, modified_at FROM source_file_state WHERE job_id = ?').all(job.id) as any[];
    const prior = new Map(priorRows.map(row => [row.path, row]));
    const previousPoint = db.prepare("SELECT id, vm_metadata FROM restore_points WHERE job_id = ? AND status = 'COMPLETED' ORDER BY created_at DESC, rowid DESC LIMIT 1").get(job.id) as any;
    const previousMetadata = previousPoint?.vm_metadata ? JSON.parse(previousPoint.vm_metadata) : null;
    const full = !previousPoint || !previousMetadata || priorRows.length === 0 ||
      Number(previousMetadata.chain_depth || 0) >= Math.max(1, Math.min(Number(job.retention_count || 7) - 1, 6));
    const changed = full ? state : state.filter(file => {
      const old = prior.get(file.path);
      return !old || old.size_bytes !== file.size || old.modified_at !== file.modified || file.modified === 0;
    });
    const current = new Set(state.map(file => file.path));
    const deleted = full ? [] : [...prior.keys()].filter(name => !current.has(name));
    const metadata = { kind: 'folder-incremental-v1', point_id: pointId, full, base_point_id: full ? pointId : previousMetadata.base_point_id,
      previous_point_id: full ? null : previousPoint.id, chain_depth: full ? 0 : Number(previousMetadata.chain_depth || 0) + 1,
      changed: changed.map(file => file.path), deleted, total_files: state.length };
    const staged = path.join(temp, 'files');
    for (const file of changed) {
      const destination = path.join(staged, ...file.path.split('/'));
      await folder.copyTo(file.path, destination);
      const stat = await fs.stat(destination);
      if (stat.size !== file.size) throw new Error(`Le fichier source a changé pendant la sauvegarde : ${file.path}`);
      if (file.modified > 0) await fs.utimes(destination, new Date(), new Date(file.modified));
    }
    const archivePath = path.join(temp, 'folder.tar.gz');
    const archive = archiveFactory();
    const output = fsSync.createWriteStream(archivePath, { flags: 'wx' });
    const finished = new Promise<void>((resolve, reject) => {
      output.on('finish', resolve); output.on('error', reject); archive.on('error', reject);
    });
    archive.pipe(output);
    archive.append(JSON.stringify(metadata, null, 2), { name: 'manifest.json' });
    for (const file of changed) archive.file(path.join(staged, ...file.path.split('/')), { name: `files/${file.path}` });
    await archive.finalize();
    await finished;
    return { file: archivePath, metadata, state };
  } finally { await folder.close(); }
}

async function sha256(file: string): Promise<string> {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fsSync.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function runSourceBackup(jobId: string): Promise<any> {
  const job = db.prepare('SELECT * FROM backup_jobs WHERE id = ?').get(jobId) as any;
  if (!job || !['DATABASE', 'FOLDER'].includes(job.hypervisor_type)) throw new Error('Job de source introuvable.');
  const source = getBackupSource(job.vm_id);
  const database = ['MYSQL', 'POSTGRES', 'MSSQL'].includes(source.type);
  if ((job.hypervisor_type === 'DATABASE') !== database) throw new Error('Type de source incompatible avec le job.');
  const storage = getStorageProvider(job.storage_target_id);
  const pointId = `rp-src-${crypto.randomUUID()}`;
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'dalibackup-source-'));
  let externalDump: string | null = null;
  let remoteFilename: string | null = null;
  const started = Date.now();
  db.prepare(`INSERT INTO restore_points (id, job_id, vm_id, vm_name, hypervisor_type, storage_target_id, file_path, status)
    VALUES (?, ?, ?, ?, ?, ?, 'En préparation', 'IN_PROGRESS')`).run(pointId, job.id, source.id, source.name, job.hypervisor_type, job.storage_target_id);
  try {
    const result = database ? await createDatabaseDump(source, temp) : await createFolderArchive(source, job, pointId, temp);
    if (source.type === 'MSSQL') externalDump = result.file;
    const extension = database ? (result as { file: string; format: string }).format : 'tar.gz';
    const filename = `sources/${source.id}/${pointId}.${extension}`;
    remoteFilename = filename;
    const size = (await fs.stat(result.file)).size;
    const digest = await sha256(result.file);
    await storage.uploadLocalFile(result.file, filename);
    db.exec('BEGIN');
    try {
      if (!database) {
        db.prepare('DELETE FROM source_file_state WHERE job_id = ?').run(job.id);
        const insert = db.prepare('INSERT INTO source_file_state (job_id, path, size_bytes, modified_at) VALUES (?, ?, ?, ?)');
        for (const file of (result as any).state as SourceFile[]) insert.run(job.id, file.path, file.size, file.modified);
      }
      db.prepare(`UPDATE restore_points SET file_path = ?, file_size_bytes = ?, checksum_sha256 = ?,
        duration_seconds = ?, vm_metadata = ?, status = 'COMPLETED', log_output = ? WHERE id = ?`)
        .run(filename, size, digest, Math.round((Date.now() - started) / 1000),
          database ? JSON.stringify({ kind: 'database-full-v1', database_type: source.type, format: extension }) : JSON.stringify((result as any).metadata),
          database ? `Dump complet ${source.type} compressé.` : `Archive ${((result as any).metadata.full ? 'complète' : 'incrémentale')} : ${(result as any).metadata.changed.length} fichier(s) modifié(s), ${(result as any).metadata.deleted.length} supprimé(s).`, pointId);
      db.prepare("UPDATE backup_jobs SET last_run_status = 'SUCCESS', last_run_at = CURRENT_TIMESTAMP WHERE id = ?").run(job.id);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
    try {
      await enforceRetention(job.id);
    } catch (retentionError: any) {
      logActivity('WARNING', 'Sources', `Rétention différée pour ${source.name} : ${retentionError.message}`);
    }
    logActivity('SUCCESS', 'Sources', `Sauvegarde ${source.type} terminée : ${source.name}`);
    return { success: true, restorePointId: pointId, bytesWritten: size };
  } catch (error: any) {
    if (remoteFilename) await storage.deleteFile(remoteFilename).catch(() => {});
    db.prepare("UPDATE restore_points SET status = 'FAILED', log_output = ? WHERE id = ?").run(error.message, pointId);
    db.prepare("UPDATE backup_jobs SET last_run_status = 'FAILED', last_run_at = CURRENT_TIMESTAMP WHERE id = ?").run(job.id);
    logActivity('ERROR', 'Sources', `Sauvegarde ${source.name} échouée : ${error.message}`);
    return { success: false, error: error.message, restorePointId: pointId };
  } finally {
    if (externalDump) await fs.rm(externalDump, { force: true }).catch(error => {
      logActivity('WARNING', 'Sources', `Nettoyage du dump MSSQL temporaire impossible : ${error.message}`);
    });
    await fs.rm(temp, { recursive: true, force: true });
  }
}
