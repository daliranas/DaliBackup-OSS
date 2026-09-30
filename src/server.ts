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
import { getAsset, isSea } from 'node:sea';
import { version as PACKAGE_VERSION } from '../package.json';

dotenv.config();

import { initDatabase, db, logActivity } from './config/database';
import { getOrCreateSslCertificates } from './config/sslManager';
import { authRouter } from './routes/authRoutes';
import { backupRouter } from './routes/backupRoutes';
import { restoreRouter } from './routes/restoreRoutes';
import { storageRouter } from './routes/storageRoutes';
import { hypervisorRouter } from './routes/hypervisorRoutes';
import { sourceRouter } from './routes/sourceRoutes';
import { scheduler } from './scheduler/backupScheduler';
import { updateRouter } from './routes/updateRoutes';

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

// A single Express application is shared by both listeners.  Once SSL is
// enabled, the HTTP listener must never serve the UI or API in clear text.
// Keep this check dynamic so saving the setting takes effect immediately.
app.use((req: Request, res: Response, next) => {
  if ((req.socket as { encrypted?: boolean }).encrypted) return next();

  const settings = db.prepare('SELECT ssl_enabled FROM system_settings WHERE id = 1').get() as any;
  if (!settings?.ssl_enabled && process.env.SSL_ENABLED !== 'true') return next();

  const host = req.hostname.includes(':') ? `[${req.hostname}]` : req.hostname;
  const httpsPort = Number(SSL_PORT);
  const port = httpsPort === 443 ? '' : `:${httpsPort}`;
  return res.redirect(308, `https://${host}${port}${req.originalUrl}`);
});

// The Windows single-file executable embeds the UI in its Node SEA assets.
// Source and Docker builds still serve the normal public directory.
const publicDirectory = path.join(__dirname, '../public');
const embeddedAssets: Record<string, { key: string; type: string }> = {
  '/': { key: 'public/index.html', type: 'html' },
  '/index.html': { key: 'public/index.html', type: 'html' },
  '/app.js': { key: 'public/app.js', type: 'js' },
  '/logo.svg': { key: 'public/logo.svg', type: 'svg' }
};

if (isSea()) {
  app.use((req: Request, res: Response, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    const asset = embeddedAssets[req.path];
    if (!asset) return next();
    res.type(asset.type).send(Buffer.from(getAsset(asset.key)));
  });
} else {
  app.use(express.static(publicDirectory));
}

function sendUiIndex(res: Response): void {
  if (isSea()) {
    res.type('html').send(Buffer.from(getAsset('public/index.html')));
  } else {
    res.sendFile(path.join(publicDirectory, 'index.html'));
  }
}

import mailRouter from './routes/mailRoutes';

// API Routes
app.use('/api/auth', authRouter);
app.use('/api', backupRouter);
app.use('/api/restore-points', restoreRouter);
app.use('/api/storage-targets', storageRouter);
app.use('/api/hypervisors', hypervisorRouter);
app.use('/api/sources', sourceRouter);
app.use('/api/mail', mailRouter);
app.use('/api/updates', updateRouter);

const APP_VERSION = `${PACKAGE_VERSION}-oss`;

// Health Check
app.get('/api/health', (req: Request, res: Response) => {
  res.json({
    status: 'HEALTHY',
    service: 'DaliBackup-OSS',
    version: APP_VERSION,
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

  sendUiIndex(res);
});

// Fallback SPA
app.get('/{*path}', (req: Request, res: Response) => {
  sendUiIndex(res);
});

// Initialiser le planificateur de tâches
scheduler.initScheduler();

// HTTPS is always listening so switching SSL on from the settings UI can take
// effect without a process restart.  When SSL is disabled, HTTP remains
// available; when it is enabled, the middleware above upgrades every request.
async function startServers(): Promise<void> {
try {
  const settings = db.prepare('SELECT ssl_enabled, ssl_mode FROM system_settings WHERE id = 1').get() as any;
  const isSslActive = Boolean(settings?.ssl_enabled || process.env.SSL_ENABLED === 'true');
  const sslCerts = await getOrCreateSslCertificates();
  const httpsServer = https.createServer({
    key: sslCerts.key,
    cert: sslCerts.cert
  }, app);

  httpsServer.listen(Number(SSL_PORT), HOST, () => {
    console.log(`====================================================`);
    console.log(`🔐 DaliBackup-OSS HTTPS disponible sur https://${HOST}:${SSL_PORT}`);
    console.log(`📜 Certificat actif : CN=DaliBackup, O=Daliranas`);
    logActivity('SUCCESS', 'SSL', `Serveur DaliBackup-OSS HTTPS démarré sur le port ${SSL_PORT}`);
  });

  const httpServer = http.createServer(app);
  httpServer.listen(Number(PORT), HOST, () => {
    console.log(`🚀 DaliBackup-OSS HTTP actif sur http://${HOST}:${PORT}${isSslActive ? ' (redirection HTTPS activée)' : ''}`);
    console.log(`🔒 Mode Single-User actif | Base SQLite prête`);
    console.log(`====================================================`);
    logActivity('INFO', 'System', `Serveur DaliBackup-OSS HTTP démarré sur le port ${PORT}`);
  });
} catch (err: any) {
  console.error('❌ [Serveur] Erreur fatale au démarrage:', err.message);
  logActivity('ERROR', 'System', `Erreur fatale au démarrage: ${err.message}`);
  process.exit(1);
}
}
void startServers();
