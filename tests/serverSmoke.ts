import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import http from 'node:http';
import https from 'node:https';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

async function freePort(): Promise<number> {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = (server.address() as net.AddressInfo).port;
  await new Promise<void>(resolve => server.close(() => resolve()));
  return port;
}
async function run() {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'dalibackup-smoke-'));
  const port = await freePort();
  const tlsPort = await freePort();
  const child = spawn(process.execPath, [path.resolve('dist/server.js')], {
    cwd: temp, env: { ...process.env, PATH: '', HOST: '127.0.0.1', PORT: String(port),
      SSL_PORT: String(tlsPort), SSL_ENABLED: 'true', DATABASE_FILE: path.join(temp, 'db.sqlite'),
      DEFAULT_LOCAL_STORAGE_PATH: path.join(temp, 'backups') }, stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  child.stdout.on('data', chunk => { logs += chunk.toString(); });
  child.stderr.on('data', chunk => { logs += chunk.toString(); });
  try {
    const deadline = Date.now() + 20000;
    while (!logs.includes(`:${port}`)) {
      if (child.exitCode !== null || Date.now() > deadline) throw new Error(`Server did not start: ${logs}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    for (const secure of [false, true]) {
      const body = await new Promise<string>((resolve, reject) => {
        const request = (secure ? https : http).get({ hostname: '127.0.0.1',
          port: secure ? tlsPort : port, path: '/api/health', rejectUnauthorized: false }, res => {
          let body = ''; res.on('data', chunk => body += chunk); res.on('end', () => resolve(body));
        });
        request.on('error', reject);
        request.setTimeout(5000, () => request.destroy(new Error('Health request timed out')));
      });
      assert.equal(JSON.parse(body).status, 'HEALTHY');
    }
    console.log('Compiled server smoke passed: HTTP and HTTPS health, certificate generation without external OpenSSL.');
  } finally {
    const exited = child.exitCode === null ? once(child, 'exit') : Promise.resolve();
    child.kill(); await exited;
    await fs.rm(temp, { recursive: true, force: true });
  }
}
run().catch(err => { console.error(err); process.exitCode = 1; });
