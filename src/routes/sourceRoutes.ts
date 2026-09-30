import { Router, Response } from 'express';
import crypto from 'crypto';
import path from 'path';
import { db, logActivity } from '../config/database';
import { requireAuth, AuthenticatedRequest } from '../auth/singleUserAuth';
import { encryptSecret } from '../utils/cryptoVault';
import { getBackupSource, testBackupSource } from '../sources/sourceEngine';

export const sourceRouter = Router();
const TYPES = new Set(['MYSQL', 'POSTGRES', 'MSSQL', 'FTP', 'FTPS', 'SFTP', 'SMB']);

sourceRouter.get('/', requireAuth, (_req: AuthenticatedRequest, res: Response): void => {
  res.json({ sources: db.prepare(`SELECT id, name, type, host, port, username, database_name, source_path,
    server_backup_path, created_at FROM backup_sources ORDER BY created_at DESC`).all() });
});

sourceRouter.post('/', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { name, type, host, port, username, password, private_key, database_name, source_path, server_backup_path } = req.body;
  if (typeof name !== 'string' || !name.trim() || name.length > 200 || !TYPES.has(type)) {
    res.status(400).json({ error: 'Nom et type de source valides requis.' }); return;
  }
  if (type !== 'SMB' && (typeof host !== 'string' || !host.trim())) {
    res.status(400).json({ error: 'Hôte de la source requis.' }); return;
  }
  if (['MYSQL', 'POSTGRES', 'MSSQL'].includes(type) && (typeof database_name !== 'string' || !database_name.trim())) {
    res.status(400).json({ error: 'Nom de la base requis.' }); return;
  }
  if (['MYSQL', 'POSTGRES', 'MSSQL'].includes(type) && (!/^[\p{L}\p{N}_.-]{1,128}$/u.test(database_name) || database_name.startsWith('-'))) {
    res.status(400).json({ error: 'Nom de base invalide.' }); return;
  }
  if (['FTP', 'FTPS', 'SFTP', 'SMB'].includes(type) && (typeof source_path !== 'string' || !source_path.trim())) {
    res.status(400).json({ error: 'Chemin du dossier source requis.' }); return;
  }
  if (type === 'MSSQL' && (!source_path || !server_backup_path)) {
    res.status(400).json({ error: 'Pour MSSQL, renseignez le dossier accessible à DaliBackup et le dossier de sauvegarde côté SQL Server.' }); return;
  }
  if ((type === 'SMB' || type === 'MSSQL') && !path.isAbsolute(source_path)) {
    res.status(400).json({ error: 'Le dossier accessible à DaliBackup doit être un chemin absolu ou UNC valide sur ce serveur.' }); return;
  }
  if (type === 'SMB' && (username || password || private_key)) {
    res.status(400).json({ error: 'SMB utilise un partage monté avec les droits du compte DaliBackup ; aucun identifiant SMB n’est stocké ici.' }); return;
  }
  if (port != null && (!Number.isInteger(Number(port)) || Number(port) < 1 || Number(port) > 65535)) {
    res.status(400).json({ error: 'Port invalide.' }); return;
  }
  const id = `src-${crypto.randomUUID()}`;
  db.prepare(`INSERT INTO backup_sources
    (id, name, type, host, port, username, password_encrypted, private_key_encrypted, database_name, source_path, server_backup_path)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .run(id, name.trim(), type, host || null, port ? Number(port) : null, username || null,
      password ? encryptSecret(String(password)) : null, private_key ? encryptSecret(String(private_key)) : null,
      database_name || null, source_path || null, server_backup_path || null);
  logActivity('INFO', 'Sources', `Source ${type} créée : ${name.trim()}`);
  res.json({ id, success: true });
});

sourceRouter.post('/:id/test', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const source = getBackupSource(req.params.id);
    await testBackupSource(source);
    res.json({ success: true, message: 'Source accessible.' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

sourceRouter.delete('/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const referenced = db.prepare("SELECT COUNT(*) AS count FROM backup_jobs WHERE vm_id = ? AND hypervisor_type IN ('DATABASE', 'FOLDER')").get(req.params.id) as any;
  if (referenced.count) { res.status(409).json({ error: 'Source utilisée par un job.' }); return; }
  db.prepare('DELETE FROM backup_sources WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});
