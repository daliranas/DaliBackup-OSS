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
import { Router, Response } from 'express';
import { db, logActivity } from '../config/database';
import { requireAuth, AuthenticatedRequest } from '../auth/singleUserAuth';
import { scheduler } from '../scheduler/backupScheduler';
import crypto from 'crypto';

export const backupRouter = Router();

// Statistiques globales pour le Dashboard
backupRouter.get('/stats', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const totalJobs = (db.prepare('SELECT COUNT(*) as c FROM backup_jobs').get() as any)?.c || 0;
    const activeJobs = (db.prepare('SELECT COUNT(*) as c FROM backup_jobs WHERE is_enabled = 1').get() as any)?.c || 0;
    const totalRestorePoints = (db.prepare("SELECT COUNT(*) as c FROM restore_points WHERE status = 'COMPLETED'").get() as any)?.c || 0;
    const totalBytes = (db.prepare("SELECT SUM(file_size_bytes) as s FROM restore_points WHERE status = 'COMPLETED'").get() as any)?.s || 0;
    
    const nodesCount = (db.prepare('SELECT COUNT(*) as c FROM hypervisor_nodes').get() as any)?.c || 0;
    const storageTargetsCount = (db.prepare('SELECT COUNT(*) as c FROM storage_targets').get() as any)?.c || 0;

    const recentJobs = db.prepare(`
      SELECT bj.id, bj.name, bj.vm_name, bj.hypervisor_type, bj.last_run_status, bj.last_run_at, st.name as storage_name
      FROM backup_jobs bj
      LEFT JOIN storage_targets st ON bj.storage_target_id = st.id
      ORDER BY bj.last_run_at DESC LIMIT 5
    `).all();

    res.json({
      totalJobs,
      activeJobs,
      totalRestorePoints,
      totalStorageBytes: totalBytes,
      nodesCount,
      storageTargetsCount,
      recentJobs
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Liste des jobs
backupRouter.get('/jobs', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  try {
    const jobs = db.prepare(`
      SELECT bj.*, st.name as storage_target_name, st.type as storage_target_type, hn.name as node_name
      FROM backup_jobs bj
      LEFT JOIN storage_targets st ON bj.storage_target_id = st.id
      LEFT JOIN hypervisor_nodes hn ON bj.node_id = hn.id
      ORDER BY bj.created_at DESC
    `).all();

    res.json({ jobs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Créer un job de sauvegarde
backupRouter.post('/jobs', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { name, hypervisor_type, node_id, vm_id, vm_name, storage_target_id, schedule_cron, compression, mode, retention_count } = req.body;

  if (!name || !hypervisor_type || !vm_id || !storage_target_id) {
    res.status(400).json({ error: 'Nom, hyperviseur, VM et cible de stockage sont requis.' });
    return;
  }

  const id = `job-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;

  db.prepare(`
    INSERT INTO backup_jobs (id, name, hypervisor_type, node_id, vm_id, vm_name, storage_target_id, schedule_cron, compression, mode, retention_count)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, name, hypervisor_type, node_id || null, vm_id, vm_name || vm_id, storage_target_id, schedule_cron || null, compression || 'zstd', mode || 'snapshot', retention_count || 7);

  scheduler.refreshSchedules();
  logActivity('INFO', 'BackupJobs', `Nouveau job créé : '${name}' pour ${vm_name} (${hypervisor_type})`);

  res.json({ success: true, id, message: 'Job de sauvegarde créé avec succès.' });
});

// Déclencher manuellement un job
backupRouter.post('/jobs/:id/run', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { id } = req.params;

  try {
    const result = await scheduler.triggerJobNow(id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Supprimer un job
backupRouter.delete('/jobs/:id', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { id } = req.params;
  db.prepare('DELETE FROM backup_jobs WHERE id = ?').run(id);
  scheduler.refreshSchedules();
  logActivity('WARNING', 'BackupJobs', `Job supprimé : ${id}`);
  res.json({ success: true, message: 'Job supprimé.' });
});

// Journaux d'activité
backupRouter.get('/logs', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const logs = db.prepare('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 100').all();
  res.json({ logs });
});
