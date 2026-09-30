import fs from 'node:fs/promises';
import { createReadStream, createWriteStream } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createGunzip } from 'node:zlib';
import { pipeline } from 'node:stream/promises';
import tar from 'tar-stream';
import { fileURLToPath } from 'node:url';

function safeRelative(name) {
  if (typeof name !== 'string' || !name || name.includes('\\') || name.includes(':') || name.startsWith('/')) {
    throw new Error(`Chemin dangereux dans la chaîne : ${name}`);
  }
  const parts = name.split('/');
  if (parts.some(part => !part || part === '.' || part === '..')) throw new Error(`Chemin dangereux dans la chaîne : ${name}`);
  return parts;
}

async function unpackArchive(archivePath, staging) {
  const extract = tar.extract();
  let manifest = null;
  const extracted = new Set();
  extract.on('entry', (header, stream, next) => {
    const handle = async () => {
      const name = header.name.replace(/\/$/, '');
      const parts = safeRelative(name);
      if (header.type === 'directory') { for await (const _ of stream) {} return; }
      if (header.type !== 'file') throw new Error(`Entrée archive non autorisée : ${name}`);
      if (name === 'manifest.json') {
        if (manifest) throw new Error('Manifeste dupliqué.');
        const chunks = [];
        let size = 0;
        for await (const chunk of stream) {
          size += chunk.length;
          if (size > 32 * 1024 * 1024) throw new Error('Manifeste trop volumineux.');
          chunks.push(chunk);
        }
        manifest = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      } else {
        if (parts[0] !== 'files' || parts.length < 2 || extracted.has(parts.slice(1).join('/'))) throw new Error(`Fichier archive invalide : ${name}`);
        const relative = parts.slice(1).join('/');
        extracted.add(relative);
        const target = path.join(staging, ...parts);
        await fs.mkdir(path.dirname(target), { recursive: true });
        await pipeline(stream, createWriteStream(target, { flags: 'wx' }));
      }
    };
    void handle().then(() => next(), error => extract.destroy(error));
  });
  await pipeline(createReadStream(archivePath), createGunzip(), extract);
  if (!manifest || manifest.kind !== 'folder-incremental-v1' || typeof manifest.point_id !== 'string' ||
      !Array.isArray(manifest.changed) || !Array.isArray(manifest.deleted)) {
    throw new Error('Manifeste DaliBackup invalide.');
  }
  const declared = new Set(manifest.changed);
  if (declared.size !== manifest.changed.length || declared.size !== extracted.size || [...declared].some(name => !extracted.has(name))) {
    throw new Error('Fichiers de l’archive différents du manifeste.');
  }
  for (const name of [...manifest.changed, ...manifest.deleted]) safeRelative(name);
  return manifest;
}

export async function restoreFolderChain(archives, destination) {
  if (!archives.length) throw new Error('Au moins une archive est requise.');
  const existing = await fs.stat(destination).catch(error => error.code === 'ENOENT' ? null : Promise.reject(error));
  if (existing) {
    if (!existing.isDirectory() || (await fs.readdir(destination)).length) throw new Error('Le dossier de restauration doit être nouveau ou vide.');
  } else await fs.mkdir(destination, { recursive: true });
  let previousId = null;
  for (const [index, archive] of archives.entries()) {
    const staging = await fs.mkdtemp(path.join(os.tmpdir(), 'dalibackup-restore-'));
    try {
      const manifest = await unpackArchive(archive, staging);
      if (index === 0 && !manifest.full) throw new Error('La chaîne doit commencer par une archive complète.');
      if (index > 0 && (manifest.full || manifest.previous_point_id !== previousId)) throw new Error('Ordre ou continuité de chaîne invalide.');
      for (const relative of manifest.deleted) {
        await fs.rm(path.join(destination, ...safeRelative(relative)), { force: true });
      }
      for (const relative of manifest.changed) {
        const target = path.join(destination, ...safeRelative(relative));
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.copyFile(path.join(staging, 'files', ...safeRelative(relative)), target);
      }
      previousId = manifest.point_id;
    } finally {
      await fs.rm(staging, { recursive: true, force: true });
    }
  }
  return { files: (await fs.readdir(destination)).length, lastPointId: previousId };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [destination, ...archives] = process.argv.slice(2);
  if (!destination || !archives.length) {
    console.error('Usage: node scripts/restore-folder-chain.mjs <dossier-vide> <archive-complete.tar.gz> [increment-1.tar.gz ...]');
    process.exitCode = 2;
  } else {
    restoreFolderChain(archives, destination).then(result => console.log(`Restauration terminée : ${result.lastPointId}`))
      .catch(error => { console.error(error.message); process.exitCode = 1; });
  }
}
