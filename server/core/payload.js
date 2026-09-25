/**
 * The 48-bit payload layout. The watermark and the register both depend on
 * this codec, so it lives in one place and both sides import it.
 *
 *   bit  0 ... 35   ->  first 36 bits of receiptId  (2^36 receipts = plenty)
 *   bit 36 ... 43   ->  8-bit CRC over bits 0-35    (catches bad extractions)
 *   bit 44 ... 47   ->  4-bit version / delta tag   (future-proofing)
 *
 * The receiptId -> shortId mapping is stored in DecryptionEvent.shortId, so B
 * can always recover the full 32-byte receipt from the 36 bits A extracts.
 */

export const PAYLOAD_BITS = 48;
export const SHORT_ID_BITS = 36;
export const CRC_BITS = 8;
export const VERSION_BITS = 4;

/** Largest shortId that fits in 36 bits. */
export const SHORT_ID_MAX = (1n << BigInt(SHORT_ID_BITS)) - 1n;

/** CRC-8 (polynomial 0x07, init 0x00) over a bit string, MSB first. */
export function crc8(bits) {
  let crc = 0;
  for (let i = 0; i < bits.length; i += 8) {
    const byte = parseInt(bits.slice(i, i + 8).padEnd(8, '0'), 2);
    crc ^= byte;
    for (let b = 0; b < 8; b++) {
      crc = crc & 0x80 ? ((crc << 1) ^ 0x07) & 0xff : (crc << 1) & 0xff;
    }
  }
  return crc.toString(2).padStart(CRC_BITS, '0');
}

/** 0x-hex receiptId -> the 36-bit shortId that actually rides in the image. */
export function shortIdOf(receiptIdHex) {
  const hex = String(receiptIdHex).replace(/^0x/, '');
  // Take the leading 36 bits = the first 9 hex chars.
  return BigInt('0x' + hex.slice(0, 9)) & SHORT_ID_MAX;
}

/**
 * Build the 48-char bit string to hand to watermark.embed().
 * @param {string} receiptIdHex 0x-prefixed 32-byte receipt id
 * @param {number} versionTag   0..15, bumped if the layout ever changes
 * @returns {string} exactly 48 chars of '0'/'1'
 */
export function buildPayload(receiptIdHex, versionTag = 1) {
  const shortId = shortIdOf(receiptIdHex);
  const idBits = shortId.toString(2).padStart(SHORT_ID_BITS, '0');
  const crcBits = crc8(idBits);
  const verBits = (versionTag & 0b1111).toString(2).padStart(VERSION_BITS, '0');

  const bits = idBits + crcBits + verBits;
  if (bits.length !== PAYLOAD_BITS) {
    throw new Error(`payload is ${bits.length} bits, expected ${PAYLOAD_BITS}`);
  }
  return bits;
}

/**
 * Detects whether payload bits are degenerate (e.g. all zeros, all ones,
 * or overwhelming zero/one bias from an unwatermarked or destroyed image).
 * Genuine watermarks have balanced bit distribution (~50% 0s and 1s).
 */
export function isDegeneratePayload(bits) {
  if (!bits || bits.length !== PAYLOAD_BITS) return true;
  const idBits = bits.slice(0, SHORT_ID_BITS);
  if (idBits === '0'.repeat(SHORT_ID_BITS) || idBits === '1'.repeat(SHORT_ID_BITS)) return true;
  const zeros = bits.split('0').length - 1;
  // A genuine 48-bit pseudo-random string has std dev 3.46; >= 42 zeros is > 5.1 sigma bias (p < 1e-7).
  if (zeros >= 42 || zeros <= 6) return true;
  return false;
}

/**
 * Inverse of buildPayload(), used by /api/trace on whatever A extracted.
 * A bad CRC does NOT throw — it is a signal that feeds the confidence score.
 * @param {string} bits 48 chars of '0'/'1'
 * @returns {{ shortId: bigint, crcOk: boolean, version: number, degenerate: boolean }}
 */
export function parsePayload(bits) {
  if (typeof bits !== 'string' || bits.length !== PAYLOAD_BITS || /[^01]/.test(bits)) {
    throw new Error(`expected ${PAYLOAD_BITS} chars of '0'/'1', got ${String(bits).length}`);
  }
  const idBits = bits.slice(0, SHORT_ID_BITS);
  const crcBits = bits.slice(SHORT_ID_BITS, SHORT_ID_BITS + CRC_BITS);
  const verBits = bits.slice(SHORT_ID_BITS + CRC_BITS);
  const degenerate = isDegeneratePayload(bits);

  return {
    shortId: BigInt('0b' + idBits),
    crcOk: !degenerate && crc8(idBits) === crcBits,
    version: parseInt(verBits, 2),
    degenerate,
  };
}

/** Fraction of positions where two equal-length bit strings agree, in [0,1]. */
export function bitAgreement(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  return same / a.length;
}

/** Count of differing bits — the plain-English number for `reasons[]`. */
export function bitsMatching(a, b) {
  if (!a || !b || a.length !== b.length) return 0;
  let same = 0;
  for (let i = 0; i < a.length; i++) if (a[i] === b[i]) same++;
  return same;
}
