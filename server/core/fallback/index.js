/**
 * ============================================================================
 *  TEMPORARY STAND-INS FOR PERSON A's CORE — owner: B
 *  DELETE THIS WHOLE FOLDER AT HOUR 28 (feature freeze).
 * ============================================================================
 *
 * These exist for exactly one reason: so B's routes and C's screens can run the
 * complete Upload -> Decrypt -> Trace loop from Hour 4, instead of waiting for
 * the watermark to be finished at Hour 8.
 *
 * They are NOT the project:
 *   - `watermark` here appends a visible trailer to the file bytes. It is not
 *     a DWT, it survives nothing, and a single JPEG re-save destroys it.
 *   - `phash` here hashes the exact bytes. It is not perceptual at all — a
 *     one-pixel change gives a completely different hash.
 *
 * NEVER DEMO WITH THESE. /api/health reports `coreFallback` as a loud array
 * precisely so nobody discovers this on stage. `crypto` and `confidence` below
 * are honest implementations and can stay until A replaces them.
 */

import crypto from 'node:crypto';
import { verdictFor, WEIGHTS } from '../confidence.js';
import { PAYLOAD_BITS } from '../payload.js';

// ---------------------------------------------------------------- crypto ---
// Real AES-256-GCM. Node built-in, nothing to get wrong. A will own the final
// version, but this one is correct as written.

const IV_BYTES = 12;

export const cryptoImpl = {
  encrypt(buffer, key) {
    const iv = crypto.randomBytes(IV_BYTES);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
    return { ciphertext, iv, authTag: cipher.getAuthTag() };
  },

  decrypt(ciphertext, key, iv, authTag) {
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  },

  sha256: (buffer) => crypto.createHash('sha256').update(buffer).digest(),

  // MD5 is a registry fingerprint only — never a security claim.
  md5: (buffer) => crypto.createHash('md5').update(buffer).digest(),

  deriveKey: (passphrase, salt) =>
    crypto.scryptSync(passphrase, salt, 32, { N: 16384, r: 8, p: 1 }),
};

// ------------------------------------------------------------- watermark ---
// STAND-IN ONLY. Appends `\n<<SIH26237:...>>` after the image's own bytes.
// Most decoders ignore trailing data, so the file still opens — which is all we
// need to wire the UI. It does not survive re-encoding, resizing or cropping.

const TRAILER_OPEN = '<<SIH26237:';
const TRAILER_CLOSE = '>>';

export const watermarkImpl = {
  async embed(imageBuffer, payloadBits, delta = 12) {
    if (typeof payloadBits !== 'string' || payloadBits.length !== PAYLOAD_BITS) {
      throw new Error(`payloadBits must be ${PAYLOAD_BITS} chars, got ${payloadBits?.length}`);
    }
    const stripped = stripTrailer(imageBuffer);
    const trailer = Buffer.from(`\n${TRAILER_OPEN}${payloadBits}${TRAILER_CLOSE}`, 'utf8');
    return {
      buffer: Buffer.concat([stripped, trailer]),
      // A plausible-looking number so C's UI has something to render. It is not
      // measured against anything.
      psnrDb: Number((48 - delta * 0.45).toFixed(1)),
      deltaUsed: delta,
      fallback: true,
    };
  },

  async extract(imageBuffer) {
    const text = imageBuffer.toString('latin1');
    const start = text.lastIndexOf(TRAILER_OPEN);
    if (start === -1) {
      return { payloadBits: '0'.repeat(PAYLOAD_BITS), bitConfidence: 0, eccCorrected: false };
    }
    const end = text.indexOf(TRAILER_CLOSE, start);
    const bits = text.slice(start + TRAILER_OPEN.length, end);
    const ok = bits.length === PAYLOAD_BITS && !/[^01]/.test(bits);
    return {
      payloadBits: ok ? bits : '0'.repeat(PAYLOAD_BITS),
      bitConfidence: ok ? 1 : 0,
      eccCorrected: false,
      fallback: true,
    };
  },
};

function stripTrailer(buffer) {
  const text = buffer.toString('latin1');
  const idx = text.lastIndexOf(`\n${TRAILER_OPEN}`);
  return idx === -1 ? buffer : buffer.subarray(0, idx);
}

// ----------------------------------------------------------------- phash ---
// STAND-IN ONLY. Derives three 64-bit values from the content digest of the
// image bytes *without* the trailer, so an original and its marked copy hash
// identically. Deterministic and stable — but not remotely perceptual.

export const phashImpl = {
  async hashes(imageBuffer) {
    const base = crypto.createHash('sha256').update(stripTrailer(imageBuffer)).digest();
    return {
      pHash: base.readBigUInt64BE(0),
      dHash: base.readBigUInt64BE(8),
      aHash: base.readBigUInt64BE(16),
      fallback: true,
    };
  },

  // This one is real maths and A can keep it verbatim.
  hamming(a, b) {
    let x = (BigInt(a) ^ BigInt(b)) & 0xffffffffffffffffn;
    let n = 0;
    while (x) {
      x &= x - 1n;
      n++;
    }
    return n;
  },
};

// ------------------------------------------------------------ confidence ---
// The formula from docs/CONTRACTS.md §1, implemented verbatim. Honest — A only
// needs to take it over and tune the weights against the attack suite.

export const confidenceImpl = {
  score({ bitConfidence = 0, pHashDist = 64, dHashDist = 64, aHashDist = 64, chainVerified = false }) {
    const clamp01 = (v) => Math.max(0, Math.min(1, v));
    const dist = (d) => clamp01(1 - (d ?? 64) / 64);

    const value =
      WEIGHTS.bitAgreement * clamp01(bitConfidence) +
      WEIGHTS.pHash * dist(pHashDist) +
      WEIGHTS.dHash * dist(dHashDist) +
      WEIGHTS.aHash * dist(aHashDist) +
      WEIGHTS.chain * (chainVerified ? 1 : 0);

    const rounded = Number(value.toFixed(4));
    const verdict = verdictFor(rounded);

    // Plain sentences. The jury reads these, not the number.
    const reasons = [];
    const bitsOk = Math.round(clamp01(bitConfidence) * PAYLOAD_BITS);
    reasons.push(`${bitsOk}/${PAYLOAD_BITS} watermark bits recovered`);
    if (dHashDist !== null && dHashDist !== undefined && dHashDist < 64) {
      reasons.push(`dHash distance ${dHashDist}/64`);
    }
    if (pHashDist !== null && pHashDist !== undefined && pHashDist < 64) {
      reasons.push(`pHash distance ${pHashDist}/64`);
    }
    reasons.push(
      chainVerified
        ? 'on-chain receipt verified'
        : 'on-chain receipt could not be verified'
    );
    if (verdict === 'INCONCLUSIVE') {
      reasons.push('Below the 60% threshold — the system does not guess.');
    }

    return { score: rounded, verdict, reasons, fallback: true };
  },
};

// ------------------------------------------------------------------ psnr ---

export const psnrImpl = {
  async psnr() {
    // No real measurement is possible without A's decoder. Report NaN rather
    // than inventing a number the jury might read off the screen.
    return Number.NaN;
  },
};

// ------------------------------------------------------------------- ecc ---
// Pass-through. RS is a stretch goal (§10); the payload works without it.

export const eccImpl = {
  rsEncode: (bits) => bits,
  rsDecode: (bits) => ({ bits, corrected: false }),
};
