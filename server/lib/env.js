import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..', '..');

const bool = (v, fallback = false) => {
  if (v === undefined || v === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(v));
};
const num = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};
const abs = (p, fallback) => path.resolve(ROOT, p || fallback);

export const env = {
  // ---------- server ----------
  port: num(process.env.PORT, 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  // ---------- crypto ----------
  masterKeyHex: process.env.MASTER_KEY_HEX || '00'.repeat(32),
  refSalt: process.env.REF_SALT || 'sih26237-do-not-change-me',

  // ---------- watermark ----------
  watermarkDelta: num(process.env.WATERMARK_DELTA, 12),
  watermarkSeed: process.env.WATERMARK_SEED || 'sih26237-coefficient-permutation-seed',

  // ---------- chain ----------
  chainMode: (process.env.CHAIN_MODE || 'local').toLowerCase(), // local | sepolia | off
  localRpcUrl: process.env.LOCAL_RPC_URL || 'http://127.0.0.1:8545',
  localContractAddress: process.env.LOCAL_CONTRACT_ADDRESS || '',
  localPrivateKey: process.env.LOCAL_PRIVATE_KEY || '',
  sepoliaRpcUrl: process.env.SEPOLIA_RPC_URL || '',
  sepoliaContractAddress: process.env.SEPOLIA_CONTRACT_ADDRESS || '',
  sepoliaPrivateKey: process.env.SEPOLIA_PRIVATE_KEY || '',

  // ---------- storage ----------
  cipherDir: abs(process.env.CIPHER_DIR, './data/cipher'),
  markedDir: abs(process.env.MARKED_DIR, './data/marked'),
  maxUploadMb: num(process.env.MAX_UPLOAD_MB, 25),

  // ---------- search ----------
  bktreeMaxDist: num(process.env.BKTREE_MAX_DIST, 12),
};

export const masterKey = () => Buffer.from(env.masterKeyHex, 'hex');

/**
 * Startup warnings for configuration that will fail later rather than now.
 */
export function warnAboutConfig(log = console.warn) {
  if (env.masterKeyHex === '00'.repeat(32)) {
    log('[config] MASTER_KEY_HEX is all zeroes — acceptable locally, never in production.');
  }
  if (env.chainMode === 'local' && !env.localContractAddress) {
    log('[config] CHAIN_MODE=local but LOCAL_CONTRACT_ADDRESS is empty.');
    log('[config]   -> npm run chain:node   (terminal 1)');
    log('[config]   -> npm run chain:deploy:local   (terminal 2), then paste the address.');
  }
  if (env.chainMode === 'sepolia' && !env.sepoliaContractAddress) {
    log('[config] CHAIN_MODE=sepolia but SEPOLIA_CONTRACT_ADDRESS is empty.');
  }
  if (env.chainMode === 'off') {
    log('[config] CHAIN_MODE=off — receipts will NOT be anchored on chain.');
  }
}
