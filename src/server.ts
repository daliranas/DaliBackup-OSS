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
import http from 'http';
import https from 'https';
import express, { Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();

import { initDatabase, db, logActivity } from './config/database';
import { getOrCreateSslCertificates } from './config/sslManager';
import { authRouter } from './routes/authRoutes';
import { backupRouter } from './routes/backupRoutes';
import { restoreRouter } from './routes/restoreRoutes';
import { storageRouter } from './routes/storageRoutes';
import { hypervisorRouter } from './routes/hypervisorRoutes';
import { scheduler } from './scheduler/backupScheduler';

const app = express();
const PORT = process.env.PORT || 3000;
const SSL_PORT = process.env.SSL_PORT || 3443;
const HOST = process.env.HOST || '0.0.0.0';

// Initialiser la base SQLite et tables
initDatabase();

// Middlewares
app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Fichiers statiques UI
app.use(express.static(path.join(__dirname, '../public')));

import mailRouter from './routes/mailRoutes';

// API Routes
app.use('/api/auth', authRouter);
app.use('/api', backupRouter);
app.use('/api/restore-points', restoreRouter);
app.use('/api/storage-targets', storageRouter);
app.use('/api/hypervisors', hypervisorRouter);
app.use('/api/mail', mailRouter);

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    service: 'DaliBackup-OSS',
    version: '1.0.0-oss',
    timestamp: new Date().toISOString()
  });
});

// Route explicite /wizard avec verrouillage post-installation
app.get('/wizard', (req: Request, res: Response) => {
  const settings = db.prepare('SELECT is_setup_completed FROM system_settings WHERE id = 1').get() as any;
  const admin = db.prepare('SELECT id FROM admin_user WHERE id = 1').get() as any;

  if (settings?.is_setup_completed && admin) {
    // Si l'installation est déjà terminée, interdire le wizard et rediriger vers la console
    return res.redirect('/?locked=wizard');
  }

  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Fallback SPA
app.get('*', (req: Request, res: Response) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialiser le planificateur de tâches
scheduler.initScheduler();

// Démarrage des serveurs selon la configuration SSL
try {
  const settings = db.prepare('SELECT ssl_enabled, ssl_mode FROM system_settings WHERE id = 1').get() as any;
  const isSslActive = Boolean(settings?.ssl_enabled || process.env.SSL_ENABLED === 'true');

  if (isSslActive) {
    // 1. Démarrer le serveur HTTPS principal avec l'application
    const sslCerts = getOrCreateSslCertificates();
    const httpsServer = https.createServer({
      key: sslCerts.key,
      cert: sslCerts.cert
    }, app);

    httpsServer.listen(Number(SSL_PORT), HOST, () => {
      console.log(`====================================================`);
      console.log(`🔐 DaliBackup-OSS HTTPS sécurisé sur https://${HOST}:${SSL_PORT}`);
      console.log(`📜 Certificat actif : CN=DaliBackup, O=Daliranas`);
      logActivity('SUCCESS', 'SSL', `Serveur DaliBackup-OSS HTTPS démarré sur le port ${SSL_PORT}`);
    });

    // 2. Démarrer également le serveur HTTP pour un accès direct fluide sans blocage de certificat
    const httpServer = http.createServer(app);
    httpServer.listen(Number(PORT), HOST, () => {
      console.log(`🚀 DaliBackup-OSS HTTP actif sur http://${HOST}:${PORT}`);
      console.log(`🔒 Mode Single-User actif | Base SQLite prête`);
      console.log(`====================================================`);
      logActivity('INFO', 'System', `Serveur DaliBackup-OSS HTTP démarré sur le port ${PORT}`);
    });
  } else {
    // Mode HTTP standard sans SSL
    const httpServer = http.createServer(app);
    httpServer.listen(Number(PORT), HOST, () => {
      console.log(`====================================================`);
      console.log(`🚀 DaliBackup-OSS actif sur http://${HOST}:${PORT}`);
      console.log(`🔒 Mode Single-User actif | Base SQLite prête`);
      console.log(`====================================================`);
      logActivity('INFO', 'System', `Serveur DaliBackup-OSS HTTP démarré sur le port ${PORT}`);
    });
  }
} catch (err: any) {
  console.error('❌ [Serveur] Erreur fatale au démarrage:', err.message);
  logActivity('ERROR', 'System', `Erreur fatale au démarrage: ${err.message}`);
  process.exit(1);
}
