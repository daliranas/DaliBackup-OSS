const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const https = require('node:https');
const { spawn } = require('node:child_process');
const { once } = require('node:events');

async function freePort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  await new Promise(resolve => server.close(resolve));
  return port;
}

function request(client, port, url) {
  return new Promise((resolve, reject) => {
    const req = client.get({ hostname: '127.0.0.1', port, path: url, rejectUnauthorized: false }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.setTimeout(5000, () => req.destroy(new Error(`Request timed out: ${url}`)));
  });
}

async function main() {
  const bundleMode = process.argv.includes('--bundle');
  if (!bundleMode && process.platform !== 'win32') throw new Error('The executable smoke test requires Windows.');
  const sourceExe = path.resolve(process.argv[2] || '');
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'dalibackup-sea-test-'));
  const install = path.join(temp, 'install');
  await fs.mkdir(install);
  const exe = path.join(install, 'DaliBackup-Server.exe');
  if (!bundleMode) await fs.copyFile(sourceExe, exe);

  const port = await freePort();
  const tlsPort = await freePort();
  const env = { ...process.env, HOST: '127.0.0.1', PORT: String(port), SSL_PORT: String(tlsPort) };
  delete env.DATABASE_FILE;
  delete env.DALIBACKUP_DATA_DIR;
  delete env.DEFAULT_LOCAL_STORAGE_PATH;
  if (bundleMode) env.DALIBACKUP_DATA_DIR = path.join(install, 'data');
  const child = spawn(bundleMode ? process.execPath : exe, bundleMode ? [sourceExe] : [], {
    cwd: temp, env, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']
  });
  let logs = '';
  let spawnError;
  child.on('error', error => { spawnError = error; });
  child.stdout.on('data', chunk => { logs += chunk.toString(); });
  child.stderr.on('data', chunk => { logs += chunk.toString(); });

  try {
    const deadline = Date.now() + 30000;
    while (!logs.includes(`:${tlsPort}`)) {
      if (spawnError || child.exitCode !== null || Date.now() > deadline) throw new Error(`Server did not start: ${spawnError?.message || logs}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const health = await request(https, tlsPort, '/api/health');
    assert.equal(health.status, 200);
    assert.equal(JSON.parse(health.body).version, '1.1.2-oss');
    const ui = await request(https, tlsPort, '/');
    assert.equal(ui.status, 200);
    assert.match(ui.body, /DaliBackup/);
    const script = await request(https, tlsPort, '/app.js');
    assert.equal(script.status, 200);
    assert.match(script.body, /loadUpdateStatus/);
    assert.equal((await request(https, tlsPort, '/logo.svg')).status, 200);
    assert.equal((await request(https, tlsPort, '/api/updates/status')).status, 401);
    const redirect = await request(http, port, '/api/health');
    assert.equal(redirect.status, 308);
    assert.equal(redirect.headers.location, `https://127.0.0.1:${tlsPort}/api/health`);
    await fs.access(path.join(install, 'data', 'dalibackup.db'));
    await fs.access(path.join(install, 'data', 'ssl', 'cert.pem'));
    console.log(`${bundleMode ? 'Bundled server' : 'Windows server EXE'} passed: UI/API, HTTPS, redirect and persistent data.`);
  } finally {
    const exited = child.exitCode === null ? once(child, 'exit') : Promise.resolve();
    child.kill();
    await exited;
    await fs.rm(temp, { recursive: true, force: true });
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
