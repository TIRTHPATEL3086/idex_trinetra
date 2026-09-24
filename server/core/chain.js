import fs from 'node:fs';
import path from 'node:path';
import { JsonRpcProvider, Wallet, Contract } from 'ethers';
import { env, ROOT } from '../lib/env.js';
import { chainError } from '../lib/errors.js';

/**
 * ethers v6 wrapper around the DecryptionProvenance contract.
 *
 * CHAIN_MODE decides everything:
 *   local   -> hardhat node on 127.0.0.1:8545, no network dependency.
 *   sepolia -> public testnet, yields a verifiable Etherscan link.
 *   off     -> writes are skipped and flagged; the rest of the pipeline runs.
 *
 * A dead RPC must not take the whole service down, so every call degrades
 * instead of throwing where it safely can. `logDecryption` is the one exception: if the
 * chain write genuinely fails in a chain-enabled mode, we refuse to release a
 * marked file — there must never be a marked copy without a receipt.
 */

// Minimal ABI — the methods the backend actually calls.
export const ABI = [
  'function logDecryption(bytes32 receiptId, bytes32 assetRef, bytes32 userRef, bytes32 contentSha, bytes32 payloadCommit) external',
  'function logDecryptionWithSignature(bytes32 receiptId, bytes32 assetRef, bytes32 userRef, bytes32 contentSha, bytes32 payloadCommit, bytes32 sigCommit) external',
  'function getReceipt(bytes32 receiptId) external view returns (tuple(bytes32 assetRef, bytes32 userRef, bytes32 contentSha, bytes32 payloadCommit, uint64 timestamp, bool exists, bytes32 signatureCommit))',
  'function hasReceipt(bytes32 receiptId) external view returns (bool)',
  'function receiptsOfAsset(bytes32 assetRef) external view returns (bytes32[])',
  'function totalReceipts() external view returns (uint256)',
  'event DecryptionLogged(bytes32 indexed receiptId, bytes32 indexed assetRef, bytes32 indexed userRef, bytes32 contentSha, bytes32 payloadCommit, uint64 timestamp)',
  'event DecryptionLoggedWithSignature(bytes32 indexed receiptId, bytes32 indexed assetRef, bytes32 indexed userRef, bytes32 contentSha, bytes32 payloadCommit, bytes32 signatureCommit, uint64 timestamp)',
];

let cached = null;

/** Fall back to deployments/<network>.json when the env var is not set yet. */
function addressFromDeployment(network) {
  try {
    const file = path.join(ROOT, 'deployments', `${network}.json`);
    if (!fs.existsSync(file)) return '';
    return JSON.parse(fs.readFileSync(file, 'utf8')).address || '';
  } catch {
    return '';
  }
}

export function chainConfig() {
  if (env.chainMode === 'sepolia') {
    return {
      mode: 'sepolia',
      rpcUrl: env.sepoliaRpcUrl,
      privateKey: env.sepoliaPrivateKey,
      address: env.sepoliaContractAddress || addressFromDeployment('sepolia'),
      explorer: 'https://sepolia.etherscan.io',
    };
  }
  if (env.chainMode === 'local') {
    return {
      mode: 'local',
      rpcUrl: env.localRpcUrl,
      privateKey: env.localPrivateKey,
      address: env.localContractAddress || addressFromDeployment('localhost'),
      explorer: null,
    };
  }
  return { mode: 'off', rpcUrl: null, privateKey: null, address: '', explorer: null };
}

/** Lazily build provider/wallet/contract. Returns null when chain is off. */
export function getContract() {
  const cfg = chainConfig();
  if (cfg.mode === 'off') return null;
  if (!cfg.rpcUrl || !cfg.address || !cfg.privateKey) return null;

  if (cached && cached.address === cfg.address && cached.mode === cfg.mode) {
    return cached;
  }
  const provider = new JsonRpcProvider(cfg.rpcUrl);
  const wallet = new Wallet(cfg.privateKey, provider);
  const contract = new Contract(cfg.address, ABI, wallet);
  cached = { ...cfg, provider, wallet, contract };
  return cached;
}

/** True when a real write is possible right now. */
export function isChainEnabled() {
  return getContract() !== null;
}

/**
 * Write one receipt. Step 8 of the decrypt orchestration — it runs BEFORE the
 * watermark is embedded, so a failure here means nothing is ever released.
 *
 * @returns {Promise<{ txHash:string|null, blockNumber:number|null,
 *                     etherscanUrl:string|null, chainMode:string,
 *                     skipped:boolean, reason?:string }>}
 */
export async function logDecryption({
  receiptId,
  assetRef,
  userRef,
  contentSha,
  payloadCommit,
  signatureCommit,
}) {
  const c = getContract();

  if (!c) {
    const cfg = chainConfig();
    if (cfg.mode === 'off') {
      return {
        txHash: null,
        blockNumber: null,
        etherscanUrl: null,
        chainMode: 'off',
        skipped: true,
        reason: 'CHAIN_MODE=off — receipt not anchored',
      };
    }
    throw chainError(
      `Chain mode "${cfg.mode}" is configured but not usable. ` +
        `Check RPC url, contract address and private key in .env.`,
      { chainMode: cfg.mode }
    );
  }

  try {
    let tx;
    if (signatureCommit && typeof c.contract.logDecryptionWithSignature === 'function') {
      try {
        tx = await c.contract.logDecryptionWithSignature(
          receiptId,
          assetRef,
          userRef,
          contentSha,
          payloadCommit,
          signatureCommit
        );
      } catch {
        // Fall back to 5-param classical signature if contract on Sepolia does not have 6-param method
        tx = await c.contract.logDecryption(
          receiptId,
          assetRef,
          userRef,
          contentSha,
          payloadCommit
        );
      }
    } else {
      tx = await c.contract.logDecryption(receiptId, assetRef, userRef, contentSha, payloadCommit);
    }

    const receipt = await tx.wait();
    return {
      txHash: tx.hash,
      blockNumber: Number(receipt.blockNumber),
      etherscanUrl: buildEtherscanUrl(tx.hash),
      chainMode: c.mode,
      skipped: false,
    };
  } catch (err) {
    throw chainError(`Chain write failed: ${err.shortMessage || err.message}`, {
      chainMode: c.mode,
    });
  }
}

/**
 * Cross-check during /api/trace. Never throws — an unreachable RPC simply
 * means `verified: false`, which lowers confidence rather than breaking trace.
 */
/**
 * Receipts as returned by the first deployment, before `signatureCommit` was
 * added. A contract deployed from that version returns six fields, which the
 * current ABI cannot decode, so reads fall back to this shape.
 */
const LEGACY_READ_ABI = [
  'function getReceipt(bytes32 receiptId) external view returns (tuple(bytes32 assetRef, bytes32 userRef, bytes32 contentSha, bytes32 payloadCommit, uint64 timestamp, bool exists))',
  'function hasReceipt(bytes32 receiptId) external view returns (bool)',
];

async function readReceipt(contract, receiptId) {
  if (!(await contract.hasReceipt(receiptId))) return null;
  const r = await contract.getReceipt(receiptId);
  return {
    assetRef: r.assetRef,
    userRef: r.userRef,
    contentSha: r.contentSha,
    payloadCommit: r.payloadCommit,
    timestamp: Number(r.timestamp),
    signatureCommit: r.signatureCommit ?? null,
  };
}

/** The contracts a receipt may live on: the current one, then a legacy one. */
function readTargets(c) {
  const targets = [c.contract, new Contract(c.address, LEGACY_READ_ABI, c.provider)];
  const legacy = c.mode === 'sepolia' ? env.sepoliaLegacyContractAddress : '';
  if (legacy && legacy.toLowerCase() !== c.address.toLowerCase()) {
    targets.push(new Contract(legacy, LEGACY_READ_ABI, c.provider));
  }
  return targets;
}

export async function getReceipt(receiptId) {
  const c = getContract();
  if (!c) return { verified: false, receipt: null, reason: 'chain unavailable' };

  let lastError = null;
  for (const contract of readTargets(c)) {
    try {
      const receipt = await readReceipt(contract, receiptId);
      if (receipt) return { verified: true, receipt };
    } catch (err) {
      lastError = err; // wrong shape for this deployment — try the next
    }
  }
  return {
    verified: false,
    receipt: null,
    reason: lastError ? lastError.shortMessage || lastError.message : 'no such receipt on chain',
  };
}

export async function receiptsOfAsset(assetRefHex) {
  const c = getContract();
  if (!c) return [];
  try {
    return await c.contract.receiptsOfAsset(assetRefHex);
  } catch {
    return [];
  }
}

/** Only Sepolia has a public explorer; local and off return null. */
export function buildEtherscanUrl(txHash) {
  if (!txHash) return null;
  const cfg = chainConfig();
  return cfg.explorer ? `${cfg.explorer}/tx/${txHash}` : null;
}

export function buildAddressUrl(address) {
  if (!address) return null;
  const cfg = chainConfig();
  return cfg.explorer ? `${cfg.explorer}/address/${address}` : null;
}

/** Connection summary for /api/health. */
export async function chainStatus() {
  const cfg = chainConfig();
  const c = getContract();
  if (!c) {
    return { mode: cfg.mode, connected: false, address: cfg.address || null, blockNumber: null };
  }
  try {
    const blockNumber = await c.provider.getBlockNumber();
    return { mode: cfg.mode, connected: true, address: cfg.address, blockNumber };
  } catch (err) {
    return {
      mode: cfg.mode,
      connected: false,
      address: cfg.address,
      blockNumber: null,
      error: err.shortMessage || err.message,
    };
  }
}
