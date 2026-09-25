/**
 * Air-gapped tactical field kit — the whole system on one offline machine.
 *
 *   npm run offline
 *
 * Starts, in order:
 *   1. a local Hardhat chain on 127.0.0.1:8545, and deploys the contract to it
 *   2. a dedicated PostgreSQL database on this machine (created, migrated and
 *      seeded with the demo accounts the first time)
 *   3. the web app, built once, served by the API from a single port
 *
 * Nothing it starts talks to the internet: the chain and database are local,
 * the fonts are bundled, and the header reports "Air-gapped · offline" only
 * because the server verifies exactly that. Pull the network cable and every
 * feature keeps working.
 *
 * Settings come from .env (secrets such as MASTER_KEY_HEX) with .env.offline
 * layered over it — see .env.offline.example. The field kit keeps its own
 * database and data folder, so it never touches the online deployment's data.
 */
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
import { ContractFactory, JsonRpcProvider, Wallet } from 'ethers';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const log = (msg) => console.log(`  [field-kit] ${msg}`);

// ---- configuration --------------------------------------------------------
const base = dotenv.config({ path: path.join(ROOT, '.env') }).parsed || {};
const offlineFile = path.join(ROOT, '.env.offline');
const over = fs.existsSync(offlineFile) ? dotenv.parse(fs.readFileSync(offlineFile)) : {};
const cfg = { ...base, ...over };

// Hardhat's first default account. Publicly known and only ever valid on a
// local development chain, which is the only place the field kit uses it.
const HARDHAT_KEY_0 = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const env = {
  ...process.env,
  ...cfg,
  NODE_ENV: 'production',
  DATABASE_URL:
    cfg.OFFLINE_DATABASE_URL || 'postgresql://postgres@127.0.0.1:5432/provenance_fieldkit',
  CHAIN_MODE: 'local',
  LOCAL_RPC_URL: 'http://127.0.0.1:8545',
  LOCAL_PRIVATE_KEY: HARDHAT_KEY_0,
  LOCAL_CONTRACT_ADDRESS: '', // taken from deployments/localhost.json after deploy
  SEPOLIA_RPC_URL: '',
  REDIS_URL: '',
  PINATA_JWT: '',
  CIPHER_DIR: cfg.OFFLINE_CIPHER_DIR || './data-fieldkit/cipher',
  MARKED_DIR: cfg.OFFLINE_MARKED_DIR || './data-fieldkit/marked',
  PORT: cfg.OFFLINE_PORT || '4000',
  CORS_ORIGIN: `http://localhost:${cfg.OFFLINE_PORT || '4000'}`,
  SERVE_CLIENT: '1',
};

// Hard guard: the field kit creates, migrates and (first time) seeds its
// database, and seeding wipes it. It must never be pointed at a shared or
// cloud database, so anything but this machine or a single-label service name
// on the local network is refused outright.
const dbHost = new URL(env.DATABASE_URL).hostname;
if (!/^(localhost|127(\.\d+){3}|::1|\[::1\])$/i.test(dbHost) && dbHost.includes('.')) {
  console.error(
    `  [field-kit] Refusing to use database host "${dbHost}": OFFLINE_DATABASE_URL must be local.`
  );
  process.exit(1);
}

const children = [];
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...opts,
  });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')} failed (${r.status})`);
}
function start(name, cmd, args) {
  const c = spawn(cmd, args, { cwd: ROOT, env, shell: process.platform === 'win32' });
  c.stdout.on(
    'data',
    (d) => process.env.FIELDKIT_VERBOSE && process.stdout.write(`  [${name}] ${d}`)
  );
  c.stderr.on('data', (d) => process.stderr.write(`  [${name}] ${d}`));
  children.push(c);
  return c;
}
const stopAll = () => children.forEach((c) => c.kill());
process.on('SIGINT', () => {
  stopAll();
  process.exit(0);
});
process.on('exit', stopAll);

async function waitFor(check, what, ms = 60000) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await check().catch(() => false)) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`timed out waiting for ${what}`);
}

/** Stop with a plain explanation instead of a stack trace. */
function fail(message, fix) {
  console.error(`\n  [field-kit] ${message}`);
  if (fix) console.error(`  [field-kit] ${fix}`);
  console.error('');
  stopAll();
  process.exit(1);
}

/** Whether something is already listening on a local port. */
const portBusy = (port) =>
  new Promise((resolve) => {
    const probe = net.createServer();
    probe.once('error', () => resolve(true));
    probe.once('listening', () => probe.close(() => resolve(false)));
    probe.listen(Number(port), '0.0.0.0');
  });

const chainUp = () =>
  fetch('http://127.0.0.1:8545', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }),
    signal: AbortSignal.timeout(2000),
  })
    .then((r) => r.ok)
    .catch(() => false);

// ---- 0. already running? port free? --------------------------------------------
const kitUp = await fetch(`http://127.0.0.1:${env.PORT}/api/health`, {
  signal: AbortSignal.timeout(2000),
})
  .then((r) => r.ok)
  .catch(() => false);
if (kitUp) {
  log(`already running — open http://localhost:${env.PORT}`);
  log('(to restart it, stop it with Ctrl+C where it was started, then run this again)');
  process.exit(0);
}
if (await portBusy(env.PORT)) {
  fail(
    `port ${env.PORT} is in use by another program.`,
    'Close it, or choose another port with OFFLINE_PORT=... in .env.offline.'
  );
}

// ---- 1. local chain ---------------------------------------------------------
if (await chainUp()) {
  log('using the local chain already running on 127.0.0.1:8545');
} else {
  if (await portBusy(8545)) {
    fail(
      'port 8545 (the local chain) is in use by a program that is not a blockchain node.',
      'Close that program and run this again.'
    );
  }
  log('starting local Hardhat chain on 127.0.0.1:8545 ...');
  start('chain', npx, ['hardhat', 'node', '--hostname', '127.0.0.1']);
  await waitFor(chainUp, 'the local chain').catch(() =>
    fail('the local chain did not start.', 'Run `npx hardhat node` on its own to see why.')
  );
}

// Deploy the compiled contract kept in the repository rather than compiling
// it: compiling needs the Solidity compiler, which Hardhat downloads from the
// internet the first time — exactly what an air-gapped machine cannot do.
log('deploying DecryptionProvenance to the local chain ...');
const compiled = JSON.parse(
  fs.readFileSync(path.join(ROOT, 'contracts', 'compiled', 'DecryptionProvenance.json'), 'utf8')
);
const provider = new JsonRpcProvider('http://127.0.0.1:8545');
const deployer = new Wallet(HARDHAT_KEY_0, provider);
const contract = await new ContractFactory(compiled.abi, compiled.bytecode, deployer).deploy();
await contract.waitForDeployment();
const deployTx = contract.deploymentTransaction();
const deployReceipt = await deployTx.wait();
const deployed = {
  network: 'localhost',
  address: await contract.getAddress(),
  deployer: deployer.address,
  txHash: deployTx.hash,
  blockNumber: deployReceipt.blockNumber,
  deployedAt: new Date().toISOString(),
};
fs.mkdirSync(path.join(ROOT, 'deployments'), { recursive: true });
fs.writeFileSync(
  path.join(ROOT, 'deployments', 'localhost.json'),
  JSON.stringify(deployed, null, 2)
);
provider.destroy();
env.LOCAL_CONTRACT_ADDRESS = deployed.address;
log(`contract at ${deployed.address}`);

// ---- 2. local database ------------------------------------------------------
const dbUrl = new URL(env.DATABASE_URL);
const dbName = dbUrl.pathname.replace(/^\//, '');
const admin = new URL(env.DATABASE_URL);
admin.pathname = '/postgres';
const client = new pg.Client({ connectionString: admin.toString() });
await client
  .connect()
  .catch((err) =>
    fail(
      `cannot reach PostgreSQL at ${dbUrl.host} (${err.code || err.message}).`,
      err.code === '28P01'
        ? 'The user name or password in OFFLINE_DATABASE_URL (.env.offline) is wrong.'
        : 'Start PostgreSQL (Windows: Services → postgresql → Start), or point OFFLINE_DATABASE_URL in .env.offline at it.'
    )
  );
const exists =
  (await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [dbName])).rowCount > 0;
if (!exists) {
  log(`creating database "${dbName}" ...`);
  await client.query(`CREATE DATABASE "${dbName.replace(/"/g, '')}"`);
}
await client.end();
log('applying migrations ...');
run(npx, ['prisma', 'migrate', 'deploy'], { stdio: 'ignore' });

const db = new pg.Client({ connectionString: env.DATABASE_URL });
await db.connect();
const users = Number((await db.query('SELECT count(*) FROM "User"')).rows[0].count);
await db.end();
// A fresh chain has none of an old database's receipts, so the demo data is
// re-seeded together with each new chain rather than left half-anchored.
if (users === 0 || process.argv.includes('--reseed')) {
  log('seeding demo accounts and documents ...');
  run('node', ['prisma/seed.js'], { stdio: 'ignore' });
} else {
  log(`database has ${users} accounts (pass --reseed to reset it)`);
}

// ---- 3. web app -------------------------------------------------------------
const dist = path.join(ROOT, 'client', 'dist', 'index.html');
// Rebuild whenever any client source is newer than the last build, so the kit
// never serves a stale UI (an old build could still point at a font CDN).
const newest = (dir) =>
  fs.readdirSync(dir, { withFileTypes: true }).reduce((m, e) => {
    const p = path.join(dir, e.name);
    return Math.max(m, e.isDirectory() ? newest(p) : fs.statSync(p).mtimeMs);
  }, 0);
const clientSrc = Math.max(
  newest(path.join(ROOT, 'client', 'src')),
  ...['index.html', 'tailwind.config.js', 'vite.config.js', 'package.json'].map(
    (f) => fs.statSync(path.join(ROOT, 'client', f)).mtimeMs
  )
);
const stale = !fs.existsSync(dist) || fs.statSync(dist).mtimeMs < clientSrc;
if (stale || process.argv.includes('--rebuild')) {
  log('building the web app (once) ...');
  run(npx, ['vite', 'build'], { cwd: path.join(ROOT, 'client'), stdio: 'ignore' });
}

log('starting the API + web app ...');
const api = start('api', 'node', ['server/index.js']);
await waitFor(async () => (await fetch(`http://127.0.0.1:${env.PORT}/api/health`)).ok, 'the API');
const health = await (await fetch(`http://127.0.0.1:${env.PORT}/api/health`)).json();

console.log('');
console.log('  ────────────────────────────────────────────────────────────');
console.log(`  FIELD KIT READY   http://localhost:${env.PORT}`);
console.log(
  `  STATUS            ${health.network?.airGapped ? '100% AIR-GAPPED & OFFLINE (zero WAN dependencies)' : 'NOT air-gapped: ' + health.network?.wan.map((d) => d.name).join(', ')}`
);
console.log(`  chain             local Hardhat, block ${health.chain?.blockNumber}`);
console.log(`  database          ${dbName} on ${dbUrl.host}`);
console.log('  sign in           admin@example.gov / admin123');
console.log('  stop              Ctrl+C');
console.log('  ────────────────────────────────────────────────────────────');
console.log('');
api.on('exit', (code) => {
  log(`API stopped (${code})`);
  stopAll();
  process.exit(code ?? 0);
});
