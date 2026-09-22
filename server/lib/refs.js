import { keccak256, toUtf8Bytes, concat, hexlify, randomBytes } from 'ethers';
import { env } from './env.js';

/**
 * Everything that reaches the blockchain passes through here first.
 *
 * RULE: no name, department, filename or device label ever goes on chain.
 * Only keccak256(<id> || salt). The plaintext identity lives in PostgreSQL.
 * This is the answer to the "isn't a public chain a privacy violation?"
 * question, and it has to be true in code, not just in the slide deck.
 */

const salted = (prefix, value) => keccak256(toUtf8Bytes(`${prefix}:${value}:${env.refSalt}`));

/** keccak256(assetId || salt) -> 0x-prefixed bytes32 */
export const assetRef = (assetId) => salted('asset', assetId);

/** keccak256(userId || salt) -> 0x-prefixed bytes32. NEVER the name. */
export const userRef = (userId) => salted('user', userId);

/** keccak256(deviceLabel || salt) -> 0x-prefixed bytes32 */
export const deviceRef = (deviceLabel) => salted('device', deviceLabel ?? 'unknown');

/** keccak256(payloadBits || salt) — proves the mark predates the leak. */
export const payloadCommit = (payloadBits) => salted('payload', payloadBits);

/** keccak256(decryptionSignature) — anchors post-quantum non-repudiation proof on chain. */
export const signatureCommit = (sigBytes) => keccak256(Buffer.isBuffer(sigBytes) ? sigBytes : Buffer.from(sigBytes));

/**
 * receiptId = keccak256(assetRef || userRef || contentSha || nonce)
 * The nonce makes two decryptions of the same file by the same person
 * distinct receipts, which is exactly what the audit timeline needs.
 */
export function buildReceiptId({ assetRef: a, userRef: u, contentSha, nonce }) {
  const n = nonce ?? hexlify(randomBytes(16));
  return keccak256(concat([a, u, toBytes32(contentSha), keccak256(toUtf8Bytes(n))]));
}

/** Accepts Buffer | 0x-hex | hex and returns a 0x-prefixed 32-byte hex string. */
export function toBytes32(value) {
  if (Buffer.isBuffer(value)) return '0x' + value.toString('hex').padStart(64, '0');
  const hex = String(value).startsWith('0x') ? String(value).slice(2) : String(value);
  return '0x' + hex.padStart(64, '0').slice(-64);
}

/** 0x-hex -> Buffer, for columns Prisma types as Bytes. */
export function hexToBuffer(hex) {
  if (hex === null || hex === undefined) return null;
  if (Buffer.isBuffer(hex)) return hex;
  return Buffer.from(String(hex).replace(/^0x/, ''), 'hex');
}

/** Buffer -> 0x-hex, for anything we hand back to the frontend. */
export function bufferToHex(buf) {
  if (!buf) return null;
  return '0x' + Buffer.from(buf).toString('hex');
}

/** Short display form for the UI: 0x7f2c…91ab */
export function shortHex(hex, lead = 6, tail = 4) {
  if (!hex) return null;
  const s = String(hex);
  return s.length <= lead + tail + 2 ? s : `${s.slice(0, lead + 2)}…${s.slice(-tail)}`;
}
