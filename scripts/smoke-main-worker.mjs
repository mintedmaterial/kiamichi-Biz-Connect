import { spawn, spawnSync } from 'node:child_process';
import { once } from 'node:events';
import { mkdirSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(scriptDir, '..');
const wranglerPath = resolve(rootDir, 'node_modules', 'wrangler', 'bin', 'wrangler.js');
const statePath = resolve(rootDir, '.wrangler', 'kbc-smoke');
const env = { ...process.env, WRANGLER_SEND_METRICS: 'false' };

function runWrangler(args) {
  const result = spawnSync(process.execPath, [wranglerPath, ...args], { cwd: rootDir, encoding: 'utf8', env });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Wrangler command failed with status ${result.status ?? 'unknown'}`);
}

function getFreePort() {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') return reject(new Error('Could not allocate a local smoke-test port'));
      server.close(() => resolvePort(address.port));
    });
  });
}

async function waitForServer(url, child, logs) {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) throw new Error(`Wrangler dev exited early (${child.exitCode}).\n${logs.value}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {}
    await new Promise((resolveWait) => setTimeout(resolveWait, 500));
  }
  throw new Error(`Timed out waiting for ${url}.\n${logs.value}`);
}

rmSync(statePath, { recursive: true, force: true });
mkdirSync(statePath, { recursive: true });
let child;
try {
  runWrangler(['d1', 'execute', 'kiamichi-biz-connect-db', '--local', '--persist-to', statePath, '--file', './schema.sql']);
  runWrangler(['d1', 'execute', 'kiamichi-biz-connect-db', '--local', '--persist-to', statePath, '--command', "INSERT OR IGNORE INTO businesses (name, slug, description, category_id, city, state, is_active) VALUES ('Smoke Listing', 'smoke-listing', 'Deterministic smoke-test business.', (SELECT id FROM categories WHERE slug = 'home-services' LIMIT 1), 'Atoka', 'OK', 1);"]);

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const logs = { value: '' };
  child = spawn(process.execPath, [wranglerPath, 'dev', '--local', '--ip', '127.0.0.1', '--port', String(port), '--persist-to', statePath], { cwd: rootDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', (chunk) => { logs.value += chunk.toString(); });
  child.stderr.on('data', (chunk) => { logs.value += chunk.toString(); });
  await waitForServer(`${baseUrl}/health`, child, logs);

  const healthResponse = await fetch(`${baseUrl}/health`);
  const health = await healthResponse.json();
  if (health.status !== 'healthy' || health.worker !== 'kiamichi-biz-connect') throw new Error(`Unexpected health payload: ${JSON.stringify(health)}`);

  const homepageResponse = await fetch(`${baseUrl}/`);
  const homepageHtml = await homepageResponse.text();
  if (!homepageResponse.ok || !homepageHtml.includes('Find Local Businesses')) throw new Error(`Homepage smoke failed (${homepageResponse.status})`);

  const listingResponse = await fetch(`${baseUrl}/business/smoke-listing`);
  const listingHtml = await listingResponse.text();
  if (!listingResponse.ok || !listingHtml.includes('Smoke Listing')) throw new Error(`Listing smoke failed (${listingResponse.status})`);
  console.log(`Smoke passed: ${baseUrl}/health, /, /business/smoke-listing`);
} finally {
  if (child) {
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else if (child.exitCode === null) child.kill('SIGTERM');
    if (child.exitCode === null) await Promise.race([once(child, 'exit'), new Promise((resolvePromise) => setTimeout(resolvePromise, 5_000))]);
  }
  try {
    rmSync(statePath, { recursive: true, force: true, maxRetries: 50, retryDelay: 200 });
  } catch (error) {
    if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'EBUSY') throw error;
    console.warn(`Smoke state cleanup deferred: ${error.message}`);
  }
}
