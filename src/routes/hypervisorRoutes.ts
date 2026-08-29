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
import { Router, Response, Request } from 'express';
import { db, logActivity } from '../config/database';
import { requireAuth, requireAgentAuth, AuthenticatedRequest } from '../auth/singleUserAuth';
import { ProxmoxEngine } from '../hypervisors/proxmoxEngine';
import { HyperVEngine } from '../hypervisors/hypervEngine';
import { getStorageProvider } from '../storage/storageFactory';
import { encryptSecret } from '../utils/cryptoVault';
import crypto from 'crypto';

export const hypervisorRouter = Router();
const proxmoxEngine = new ProxmoxEngine();
const hypervEngine = new HyperVEngine();

// Liste des nœuds hyperviseurs (sans secrets)
hypervisorRouter.get('/nodes', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const nodes = db.prepare('SELECT id, name, type, host, port, status, last_seen, created_at FROM hypervisor_nodes ORDER BY name ASC').all();
  res.json({ nodes });
});

// Ajouter un nœud Proxmox ou Hyper-V (secrets chiffrés au repos)
hypervisorRouter.post('/nodes', requireAuth, (req: AuthenticatedRequest, res: Response): void => {
  const { name, type, host, port, api_token_id, api_token_secret, username, password } = req.body;

  if (!name || !type || !host) {
    res.status(400).json({ error: 'Nom, type (PROXMOX/HYPERV) et hôte requis.' });
    return;
  }

  const id = `node-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
  const encryptedSecret = api_token_secret ? encryptSecret(api_token_secret) : null;
  const encryptedPassword = password ? encryptSecret(password) : null;

  db.prepare(`
    INSERT INTO hypervisor_nodes (id, name, type, host, port, api_token_id, api_token_secret, username, password)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    type,
    host,
    port || (type === 'PROXMOX' ? 8006 : 5985),
    api_token_id || null,
    encryptedSecret,
    username || null,
    encryptedPassword
  );

  logActivity('INFO', 'Hypervisors', `Nœud ${type} ajouté : '${name}' (${host})`);
  res.json({ success: true, id, message: 'Nœud hyperviseur enregistré.' });
});

// Découverte des VMs / CTs Proxmox
hypervisorRouter.get('/proxmox/:nodeId/guests', requireAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { nodeId } = req.params;
  try {
    const guests = await proxmoxEngine.discoverGuests(nodeId);
    res.json({ guests });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Rapport de découverte envoyé par l'agent Hyper-V
hypervisorRouter.post('/hyperv/report', requireAgentAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { hostname, vms } = req.body;
  if (!hostname || !Array.isArray(vms)) {
    res.status(400).json({ error: 'Rapport agent invalide (hostname et vms requis).' });
    return;
  }

  try {
    const result = await hypervEngine.registerAgentReport({ hostname, vms });
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Récupération et verrouillage atomique des tâches de sauvegarde/restauration par l'agent Hyper-V
hypervisorRouter.get('/agent/tasks', requireAgentAuth, (req: AuthenticatedRequest, res: Response): void => {
  const hostname = req.query.hostname as string | undefined;
  const tasks = hypervEngine.claimPendingTasks(hostname);
  res.json({ tasks });
});

// Enregistrement du manifeste de configuration VM complète (Génération, RAM, CPU, Réseau, Disques)
hypervisorRouter.post('/agent/manifest/:taskId', requireAgentAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { taskId } = req.params;

  try {
    const result = await hypervEngine.handleAgentManifest(taskId, req.body);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Téléversement d'un flux d'archive binaire réel par l'agent pour un disque donné (Multi-disques indexé)
hypervisorRouter.post('/agent/upload/:taskId/:diskIndex?', requireAgentAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { taskId } = req.params;
  const diskIndex = parseInt(req.params.diskIndex || (req.headers['x-disk-index'] as string) || '0', 10);
  const totalDisks = parseInt((req.query.totalDisks as string) || (req.headers['x-total-disks'] as string) || '1', 10);
  const filenameHint = req.headers['x-backup-filename'] as string | undefined;

  const controllerInfo = {
    type: req.headers['x-controller-type'] as string | undefined,
    number: parseInt((req.headers['x-controller-number'] as string) || '0', 10),
    location: parseInt((req.headers['x-controller-location'] as string) || String(diskIndex), 10)
  };

  try {
    const result = await hypervEngine.handleAgentUploadStream(taskId, diskIndex, totalDisks, req, filenameHint, controllerInfo);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Récupération du manifeste de restauration de VM (Génération, CPU, RAM, Réseau et liste des disques)
hypervisorRouter.get('/agent/restore-manifest/:taskId', requireAgentAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { taskId } = req.params;

  try {
    const manifest = await hypervEngine.getRestoreManifest(taskId);
    res.json(manifest);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Téléchargement du flux de sauvegarde pour un disque donné lors de la restauration
hypervisorRouter.get('/agent/download-restore/:taskId/:diskIndex?', requireAgentAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { taskId } = req.params;
  const targetDiskIndex = parseInt(req.params.diskIndex || '0', 10);

  try {
    const task = db.prepare('SELECT * FROM agent_tasks WHERE id = ?').get(taskId) as any;
    if (!task || task.task_type !== 'RESTORE') {
      res.status(404).json({ error: 'Tâche de restauration introuvable.' });
      return;
    }

    const point = db.prepare('SELECT * FROM restore_points WHERE id = ?').get(task.restore_point_id) as any;
    if (!point) {
      res.status(404).json({ error: 'Point de restauration introuvable.' });
      return;
    }

    // Récupérer le chemin du disque spécifique dans restore_point_disks
    const diskRow = db.prepare('SELECT file_path FROM restore_point_disks WHERE restore_point_id = ? AND disk_index = ?').get(point.id, targetDiskIndex) as any;
    const targetFilePath = diskRow?.file_path || point.file_path;

    const target = db.prepare('SELECT * FROM storage_targets WHERE id = ?').get(point.storage_target_id) as any;
    const provider = getStorageProvider(target);
    const downloadStream = await provider.downloadStream(targetFilePath);

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${targetFilePath}"`);
    downloadStream.pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Confirmation de restauration terminée avec succès par l'agent Hyper-V
hypervisorRouter.post('/agent/complete-restore/:taskId', requireAgentAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { taskId } = req.params;

  try {
    await hypervEngine.handleAgentRestoreCompleted(taskId);
    res.json({ success: true, message: 'Restauration Hyper-V confirmée.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Notification d'échec envoyée par l'agent
hypervisorRouter.post('/agent/fail/:taskId', requireAgentAuth, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const { taskId } = req.params;
  const { error } = req.body;

  try {
    await hypervEngine.handleAgentFailure(taskId, error || 'Erreur inconnue signalée par l agent');
    res.json({ success: true, message: 'Échec enregistré.' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
