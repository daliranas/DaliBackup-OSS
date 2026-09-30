import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import esbuild from 'esbuild';
import postject from 'postject';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const buildDir = path.join(root, 'build', 'server-sea');
const bundle = path.join(root, 'dist', 'sea-server.cjs');
const configPath = path.join(buildDir, 'sea-config.json');
const blobPath = path.join(buildDir, 'server.blob');
const version = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8')).version;
const output = path.join(root, 'release-assets', `DaliBackup-Server-v${version}-win-x64.exe`);

await fs.mkdir(buildDir, { recursive: true });
await fs.mkdir(path.dirname(bundle), { recursive: true });
await esbuild.build({
  entryPoints: [path.join(root, 'src', 'sea-entry.ts')],
  outfile: bundle,
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node22',
  // ssh2 has an optional native accelerator; its JavaScript fallback is bundled.
  external: ['*.node'],
  logLevel: 'info'
});

if (process.argv.includes('--bundle-only')) {
  console.log(`Server bundle created: ${bundle}`);
  process.exit(0);
}

if (process.platform !== 'win32' || process.arch !== 'x64') {
  throw new Error('Build the Windows x64 executable on a Windows x64 host.');
}
if (!process.versions.node.startsWith('22.')) {
  throw new Error('The release executable must be built with Node.js 22.x.');
}

const assets = Object.fromEntries(
  (await fs.readdir(path.join(root, 'public'))).map(name => [
    `public/${name}`, path.join(root, 'public', name)
  ])
);
await fs.writeFile(configPath, JSON.stringify({
  main: bundle,
  output: blobPath,
  disableExperimentalSEAWarning: true,
  useSnapshot: false,
  useCodeCache: false,
  assets
}, null, 2));

execFileSync(process.execPath, ['--experimental-sea-config', configPath], { stdio: 'inherit' });
await fs.mkdir(path.dirname(output), { recursive: true });
await fs.copyFile(process.execPath, output);
await postject.inject(output, 'NODE_SEA_BLOB', await fs.readFile(blobPath), {
  sentinelFuse: 'NODE_SEA_FUSE_fce680ab2cc467b6e072b8b5df1996b2'
});
console.log(`Standalone server created: ${output}`);
