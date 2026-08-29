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
import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { db, logActivity } from '../config/database';
import { imapEngine } from '../mail/imapEngine';
import { encryptSecret, decryptSecret } from '../utils/cryptoVault';
import { requireAuth } from '../auth/singleUserAuth';

const router = Router();

// Toutes les routes d'administration mail requièrent l'authentification
router.use(requireAuth);

/**
 * Test immédiat d'une connexion IMAP (avant enregistrement)
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { host, port, secure, username, password } = req.body;
    if (!host || !username) {
      return res.status(400).json({ error: 'Le serveur hôte et le nom d utilisateur/e-mail sont requis.' });
    }

    const testResult = await imapEngine.testConnection({
      name: 'Test',
      host,
      port: Number(port) || (secure ? 993 : 143),
      secure: Boolean(secure),
      username,
      password
    });

    if (testResult.success) {
      res.json(testResult);
    } else {
      res.status(400).json(testResult);
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Liste tous les comptes mails configurés
 */
router.get('/sources', (req: Request, res: Response) => {
  try {
    const sources = db.prepare(`
      SELECT id, name, host, port, secure, username, folders_filter, status, last_seen, created_at 
      FROM mail_sources 
      ORDER BY created_at DESC
    `).all();

    res.json(sources);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Ajout ou modification d'une source e-mail IMAP
 */
router.post('/sources', async (req: Request, res: Response) => {
  try {
    const { id, name, host, port, secure, username, password, folders_filter } = req.body;

    if (!name || !host || !username) {
      return res.status(400).json({ error: 'Nom, serveur hôte et identifiant requis.' });
    }

    const sourceId = id || `mail-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const encryptedPass = password ? encryptSecret(password) : null;

    if (id) {
      const existing = db.prepare('SELECT password_encrypted FROM mail_sources WHERE id = ?').get(id) as any;
      if (!existing) return res.status(404).json({ error: 'Compte mail introuvable.' });

      const finalPass = encryptedPass || existing.password_encrypted;

      db.prepare(`
        UPDATE mail_sources 
        SET name = ?, host = ?, port = ?, secure = ?, username = ?, password_encrypted = ?, folders_filter = ?
        WHERE id = ?
      `).run(
        name,
        host,
        Number(port) || (secure ? 993 : 143),
        secure !== false ? 1 : 0,
        username,
        finalPass,
        folders_filter || '*',
        id
      );

      logActivity('INFO', 'MailAdmin', `Compte e-mail '${name}' mis à jour.`);
      res.json({ success: true, message: 'Compte mail mis à jour avec succès.', sourceId: id });
    } else {
      if (!encryptedPass) {
        return res.status(400).json({ error: 'Le mot de passe de la boîte mail est requis.' });
      }

      db.prepare(`
        INSERT INTO mail_sources (id, name, host, port, secure, username, password_encrypted, folders_filter, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ONLINE')
      `).run(
        sourceId,
        name,
        host,
        Number(port) || (secure ? 993 : 143),
        secure !== false ? 1 : 0,
        username,
        encryptedPass,
        folders_filter || '*'
      );

      logActivity('SUCCESS', 'MailAdmin', `Nouveau compte e-mail '${name}' (${username}@${host}) configuré.`);
      res.json({ success: true, message: 'Compte mail ajouté avec succès.', sourceId });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Suppression d'un compte mail
 */
router.delete('/sources/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const source = db.prepare('SELECT * FROM mail_sources WHERE id = ?').get(id) as any;
    if (!source) return res.status(404).json({ error: 'Compte mail introuvable.' });

    db.prepare('DELETE FROM mail_sources WHERE id = ?').run(id);
    db.prepare('DELETE FROM mail_sync_state WHERE job_id IN (SELECT id FROM backup_jobs WHERE vm_id = ?)').run(id);

    logActivity('WARNING', 'MailAdmin', `Compte e-mail '${source.name}' supprimé.`);
    res.json({ success: true, message: 'Compte mail supprimé.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Liste dynamique des dossiers d'un compte mail
 */
router.get('/folders/:sourceId', async (req: Request, res: Response) => {
  try {
    const { sourceId } = req.params;
    const folders = await imapEngine.listFolders(sourceId);
    res.json(folders);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * Déclenchement de la restauration d'une boîte mail
 */
router.post('/restore/:restorePointId', async (req: Request, res: Response) => {
  try {
    const { restorePointId } = req.params;
    const { targetSourceId, folderPrefix } = req.body;

    const result = await imapEngine.restoreMailbox(restorePointId, { targetSourceId, folderPrefix });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
