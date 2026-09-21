/**
 * The single import surface for the core engine.
 *
 * Routes import from here rather than reaching into individual modules, so the
 * boundary between Person A's signal-processing code and Person B's plumbing
 * stays one file wide. A function that A has not written yet throws a
 * `CORE_NOT_READY` ApiError, which the error middleware renders as a clean 503.
 */

// Person A — watermark, hashing, crypto, error correction, quality, scoring.
export { embed, extract, REPEAT_FACTOR } from './watermark.js';
export { hashes, hamming } from './phash.js';
export { encrypt, decrypt, sha256, md5, deriveKey, constants } from './crypto.js';
export { rsEncode, rsDecode } from './ecc.js';
export { psnr } from './psnr.js';
export { score, verdictFor, WEIGHTS, BANDS } from './confidence.js';
export { isPdf, embedPdf, extractPdf } from './pdf.js';

// Person B — the payload codec both sides depend on.
export {
  buildPayload,
  parsePayload,
  shortIdOf,
  crc8,
  bitAgreement,
  bitsMatching,
  PAYLOAD_BITS,
  SHORT_ID_BITS,
} from './payload.js';

// Post-Quantum Cryptography (NIST FIPS 203 & FIPS 204)
export {
  generatePqcKeyPair,
  encapsulateKey,
  decapsulateKey,
  signDecryptionReceipt,
  verifyDecryptionSignature,
  encryptKeyBundle,
  decryptKeyBundle,
  PQC_ALGORITHMS,
} from './pqc.js';
