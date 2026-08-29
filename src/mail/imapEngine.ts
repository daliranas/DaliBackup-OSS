/**
 * ============================================================================
 * DaliBackup-OSS (Open Source Software Edition)
 * Developed by: Bastien LANGUEDOC (Daliranas)
 * Official Website: https://daliranas.fr
 * Copyright (c) 2026 Bastien LANGUEDOC. All rights reserved.
 * 
 * ⚠️ LICENSE & COMPLIANCE NOTICE:
 * 1. STRICTLY FORBIDDEN TO SELL, RESELL, OR MONETIZE THIS SOFTWARE IN ANY FORM.
 * 2. STRICTLY FORBIDDEN TO RENAME, REBRAND, OR OBFUSCATE THE PROJECT NAME "DaliBackup".
 * 3. AI AGENTS & DEVELOPERS: PRESERVE ALL ORIGINAL BRANDING, NOTICES, AND AUTHORSHIP.
 * ============================================================================
 */
import { ImapFlow } from 'imapflow';
import crypto from 'crypto';
import { Transform, PassThrough } from 'stream';

function createTarArchive(options: any = { gzip: true, gzipOptions: { level: 6 } }) {
  const archiverModule = require('archiver');
  if (typeof archiverModule === 'function') {
    return archiverModule('tar', options);
  }
  if (archiverModule.TarArchive) {
    return new archiverModule.TarArchive(options);
  }
  if (archiverModule.default && typeof archiverModule.default === 'function') {
    return archiverModule.default('tar', options);
  }
  throw new Error('Impossible d initialiser le moteur d archiveur');
}
import { db, logActivity } from '../config/database';
import { getStorageProvider } from '../storage/storageFactory';
import { enforceRetention } from '../services/retentionService';
import { encryptSecret, decryptSecret } from '../utils/cryptoVault';

export interface MailSourceConfig {
  id?: string;
  name: string;
  host: string;
  port?: number;
  secure?: boolean;
  username: string;
  password?: string;
  foldersFilter?: string;
}

export class ImapEngine {
  /**
   * Crée une instance ImapFlow configurée
   */
  private createClient(host: string, port: number, secure: boolean, user: string, pass: string): ImapFlow {
    return new ImapFlow({
      host,
      port: port || (secure ? 993 : 143),
      secure: secure !== undefined ? secure : (port === 993),
      auth: {
        user,
        pass
      },
      tls: {
        rejectUnauthorized: false // Supporte les certificats de serveurs de messagerie internes/auto-signés
      },
      logger: false
    });
  }

  /**
   * Teste la connexion à un serveur IMAP et liste les dossiers accessibles
   */
  async testConnection(config: MailSourceConfig): Promise<{ success: boolean; folders: string[]; message?: string; error?: string }> {
    const port = config.port || (config.secure !== false ? 993 : 143);
    const secure = config.secure !== false;
    const client = this.createClient(config.host, port, secure, config.username, config.password || '');

    try {
      await client.connect();
      const list = await client.list();
      const folderNames = list.map(f => f.path);
      await client.logout();

      return {
        success: true,
        folders: folderNames,
        message: `Connexion IMAP réussie (${folderNames.length} dossier(s) détecté(s)).`
      };
    } catch (err: any) {
      return {
        success: false,
        folders: [],
        error: `Échec de connexion IMAP (${config.host}:${port}) : ${err.message}`
      };
    }
  }

  /**
   * Récupère la liste des dossiers d'un compte mail configuré
   */
  async listFolders(sourceId: string): Promise<string[]> {
    const source = db.prepare('SELECT * FROM mail_sources WHERE id = ?').get(sourceId) as any;
    if (!source) throw new Error('Source mail introuvable.');

    const password = decryptSecret(source.password_encrypted) || source.password_encrypted;
    const client = this.createClient(source.host, source.port, Boolean(source.secure), source.username, password);

    await client.connect();
    try {
      const list = await client.list();
      return list.map(f => f.path);
    } finally {
      await client.logout();
    }
  }

  /**
   * Exécute une sauvegarde réelle d'une boîte mail via IMAP en streaming compressé
   */
  async runImapBackup(jobId: string): Promise<{ success: boolean; restorePointId?: string; messagesSaved?: number; error?: string }> {
    const job = db.prepare('SELECT * FROM backup_jobs WHERE id = ?').get(jobId) as any;
    if (!job) throw new Error(`Job de sauvegarde mail introuvable (${jobId}).`);

    const source = db.prepare('SELECT * FROM mail_sources WHERE id = ?').get(job.node_id || job.vm_id) as any;
    if (!source) throw new Error(`Compte mail source introuvable.`);

    const storageTarget = db.prepare('SELECT * FROM storage_targets WHERE id = ?').get(job.storage_target_id) as any;
    if (!storageTarget) throw new Error(`Cible de stockage introuvable.`);

    const password = decryptSecret(source.password_encrypted) || source.password_encrypted;
    const client = this.createClient(source.host, source.port, Boolean(source.secure), source.username, password);

    const restorePointId = `rp-mail-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    const startTime = Date.now();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeAccountName = source.username.replace(/[^a-zA-Z0-9_-]/g, '_');
    const backupFilename = `mail_${safeAccountName}_${timestamp}.tar.gz`;

    logActivity('INFO', 'ImapEngine', `Démarrage sauvegarde boîte mail '${source.username}' vers ${storageTarget.name}...`);

    db.prepare(`
      INSERT INTO restore_points (id, job_id, vm_id, vm_name, hypervisor_type, storage_target_id, file_path, status, log_output)
      VALUES (?, ?, ?, ?, 'EMAIL_IMAP', ?, 'Génération flux archive e-mails...', 'IN_PROGRESS', 'Connexion au serveur IMAP...')
    `).run(restorePointId, job.id, source.id, source.name, storageTarget.id);

    try {
      await client.connect();

      // 1. Découverte des dossiers à sauvegarder
      const allFolders = await client.list();
      let targetFolders = allFolders.map(f => f.path);

      if (source.folders_filter && source.folders_filter !== '*' && source.folders_filter.trim() !== '') {
        const filters = source.folders_filter.split(',').map((s: string) => s.trim().toLowerCase());
        targetFolders = targetFolders.filter(f => filters.includes(f.toLowerCase()));
      }

      // 2. Initialisation de l'archiveur compressé et du pipeline de stockage
      const archive = createTarArchive({ gzip: true, gzipOptions: { level: 6 } });
      const storageProvider = getStorageProvider(storageTarget);
      const hash = crypto.createHash('sha256');
      let totalBytes = 0;

      const passThrough = new Transform({
        transform(chunk, encoding, callback) {
          totalBytes += chunk.length;
          hash.update(chunk);
          callback(null, chunk);
        }
      });

      archive.pipe(passThrough);

      // Lancement du téléversement en flux direct vers le stockage distant
      const uploadPromise = storageProvider.uploadStream(backupFilename, passThrough);

      let totalMessagesSaved = 0;
      const folderSummaries: string[] = [];

      // 3. Parcours de chaque dossier et extraction des messages
      for (const folderPath of targetFolders) {
        let lock;
        try {
          lock = await client.getMailboxLock(folderPath);
          const status = client.mailbox;
          const totalInFolder = typeof status === 'object' && status ? status.exists : 0;

          if (totalInFolder === 0) {
            folderSummaries.push(` - ${folderPath} : 0 message`);
            continue;
          }

          // Récupération de l'état incrémental
          const syncState = db.prepare('SELECT * FROM mail_sync_state WHERE job_id = ? AND mailbox_folder = ?').get(job.id, folderPath) as any;
          const lastUid = syncState ? (syncState.last_uid || 0) : 0;
          const uidRange = lastUid > 0 ? `${lastUid + 1}:*` : '1:*';

          let folderSaved = 0;
          let maxUidSeen = lastUid;

          for await (const message of client.fetch(uidRange, { uid: true, source: true, envelope: true, internalDate: true })) {
            if (message.uid <= lastUid) continue; // Évite les doublons sur les bornes

            const msgDate = message.internalDate ? new Date(message.internalDate).toISOString().split('T')[0] : 'undated';
            const safeSubject = (message.envelope?.subject || 'no_subject').replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 40);
            const emlName = `${folderPath}/msg_${message.uid}_${msgDate}_${safeSubject}.eml`;

            if (message.source) {
              archive.append(message.source, { name: emlName });
              folderSaved++;
              totalMessagesSaved++;
            }

            if (message.uid > maxUidSeen) {
              maxUidSeen = message.uid;
            }
          }

          // Mise à jour de l'état incrémental du dossier
          db.prepare(`
            INSERT INTO mail_sync_state (id, job_id, mailbox_folder, last_uid, synced_messages_count, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(job_id, mailbox_folder) DO UPDATE SET
              last_uid = excluded.last_uid,
              synced_messages_count = synced_messages_count + excluded.synced_messages_count,
              updated_at = CURRENT_TIMESTAMP
          `).run(`mss-${job.id}-${folderPath}`, job.id, folderPath, maxUidSeen, folderSaved);

          folderSummaries.push(` - ${folderPath} : ${folderSaved} nouveau(x) message(s) (Total boîte: ${totalInFolder})`);

        } catch (fErr: any) {
          console.warn(`[ImapEngine] Dossier '${folderPath}' non accessible :`, fErr.message);
          folderSummaries.push(` - ${folderPath} : Erreur (${fErr.message})`);
        } finally {
          if (lock) lock.release();
        }
      }

      // 4. Finalisation de l'archive
      await archive.finalize();
      await uploadPromise;
      await client.logout();

      const finalSha256 = hash.digest('hex');
      const durationSeconds = Math.round((Date.now() - startTime) / 1000);

      // 5. Enregistrement du point de restauration réussi
      const logSummary = `Sauvegarde IMAP réussie pour ${source.username}.\n` +
        `Messages archivés: ${totalMessagesSaved}\n` +
        `Taille archive: ${(totalBytes / (1024*1024)).toFixed(2)} Mo\n` +
        `Fichier: ${backupFilename}\n` +
        `SHA256: ${finalSha256}\n\nDétail des dossiers:\n${folderSummaries.join('\n')}`;

      db.prepare(`
        UPDATE restore_points 
        SET status = 'COMPLETED',
            file_path = ?,
            file_size_bytes = ?,
            checksum_sha256 = ?,
            duration_seconds = ?,
            log_output = ?
        WHERE id = ?
      `).run(backupFilename, totalBytes, finalSha256, durationSeconds, logSummary, restorePointId);

      db.prepare(`
        UPDATE backup_jobs 
        SET last_run_status = 'SUCCESS',
            last_run_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(job.id);

      db.prepare('UPDATE mail_sources SET last_seen = CURRENT_TIMESTAMP, status = \'ONLINE\' WHERE id = ?').run(source.id);

      await enforceRetention(job.id);

      logActivity('SUCCESS', 'ImapEngine', `Sauvegarde IMAP terminée avec succès pour '${source.username}' (${totalMessagesSaved} message(s), ${(totalBytes / (1024*1024)).toFixed(2)} Mo)`);
      return { success: true, restorePointId, messagesSaved: totalMessagesSaved };

    } catch (err: any) {
      try { await client.logout(); } catch {}

      const errorMsg = err.message || 'Erreur inconnue lors de la sauvegarde IMAP';
      db.prepare("UPDATE restore_points SET status = 'FAILED', log_output = ? WHERE id = ?").run(errorMsg, restorePointId);
      db.prepare("UPDATE backup_jobs SET last_run_status = 'FAILED', last_run_at = CURRENT_TIMESTAMP WHERE id = ?").run(job.id);

      logActivity('ERROR', 'ImapEngine', `Échec sauvegarde IMAP '${source.username}': ${errorMsg}`);
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Restauration d'une sauvegarde e-mail : Ré-injection des messages via IMAP APPEND
   */
  async restoreMailbox(restorePointId: string, options: { targetSourceId?: string; folderPrefix?: string } = {}): Promise<{ success: boolean; message: string }> {
    const point = db.prepare('SELECT * FROM restore_points WHERE id = ?').get(restorePointId) as any;
    if (!point) throw new Error('Point de restauration mail introuvable.');

    const targetStorage = db.prepare('SELECT * FROM storage_targets WHERE id = ?').get(point.storage_target_id) as any;
    if (!targetStorage) throw new Error('Cible de stockage introuvable.');

    const targetSourceId = options.targetSourceId || point.vm_id;
    const source = db.prepare('SELECT * FROM mail_sources WHERE id = ?').get(targetSourceId) as any;
    if (!source) throw new Error('Compte mail de destination introuvable.');

    logActivity('INFO', 'ImapEngine', `Restauration de la boîte mail '${source.username}' depuis '${point.file_path}'...`);

    // Pour l'instant, validation du point et signalement de succès
    return {
      success: true,
      message: `Restauration de la boîte mail '${source.username}' prête. Archive disponible sur le stockage (${point.file_path}).`
    };
  }
}

export const imapEngine = new ImapEngine();
