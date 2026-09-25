/**
 * Which of this deployment's dependencies reach beyond the machine.
 *
 * A field kit on a warship or in a border post has no internet. The header
 * status reports "air-gapped" only when that is actually true of the running
 * configuration: the database, the chain RPC and any cache must all be on this
 * machine or its private network. The web client itself loads nothing from the
 * internet (its fonts are bundled), so it adds no dependency here.
 */
import { env } from './env.js';

const PRIVATE_HOST =
  /^(localhost|127\.\d+\.\d+\.\d+|::1|\[::1\]|0\.0\.0\.0|10\.\d+\.\d+\.\d+|192\.168\.\d+\.\d+|172\.(1[6-9]|2\d|3[01])\.\d+\.\d+|host\.docker\.internal)$/i;

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return null;
  }
}

/** A single-label host (e.g. "db", "chain") is a service on the local network. */
const isLocal = (host) => Boolean(host) && (PRIVATE_HOST.test(host) || !host.includes('.'));

export function networkProfile() {
  const deps = [];
  const dbHost = hostOf(process.env.DATABASE_URL || '');
  deps.push({ name: 'Database', host: dbHost || 'unknown', local: isLocal(dbHost) });

  if (env.chainMode === 'sepolia') {
    deps.push({
      name: 'Blockchain RPC (Sepolia)',
      host: hostOf(env.sepoliaRpcUrl) || 'unset',
      local: false,
    });
  } else if (env.chainMode === 'local') {
    const h = hostOf(env.localRpcUrl);
    deps.push({ name: 'Blockchain RPC (local Hardhat)', host: h || 'unset', local: isLocal(h) });
  }

  if (process.env.REDIS_URL) {
    const h = hostOf(process.env.REDIS_URL);
    deps.push({ name: 'Cache (Redis)', host: h || 'unknown', local: isLocal(h) });
  }

  const wan = deps.filter((d) => !d.local);
  return { airGapped: wan.length === 0, wan, deps };
}
