/**
 * Owner: B. The single place routes import A's core from.
 *
 * Routes never import `core/watermark.js` directly. They import this, which:
 *   1. tries Person A's real implementation,
 *   2. if it throws NotImplementedError and ALLOW_CORE_FALLBACK=true,
 *      transparently uses the stand-in from core/fallback/,
 *   3. records which functions are running on a fallback so /api/health can
 *      shout about it.
 *
 * The moment A lands a real `embed()`, every route starts using it with no
 * edit anywhere else. That is the whole point — A and B never block each other.
 */

import { env } from '../lib/env.js';
import { coreNotReady } from '../lib/errors.js';
import { isNotImplemented } from './fallback/marker.js';
import {
  cryptoImpl,
  watermarkImpl,
  phashImpl,
  confidenceImpl,
  psnrImpl,
  eccImpl,
} from './fallback/index.js';

import * as aCrypto from './crypto.js';
import * as aWatermark from './watermark.js';
import * as aPhash from './phash.js';
import * as aConfidence from './confidence.js';
import * as aPsnr from './psnr.js';
import * as aEcc from './ecc.js';

/** Names currently served by a stand-in rather than A's code. */
const usingFallback = new Set();

export const fallbacksInUse = () => [...usingFallback].sort();
export const isAnyFallbackInUse = () => usingFallback.size > 0;

/**
 * Wrap one function so a NotImplementedError routes to the stand-in.
 * Any OTHER error is A's real bug and propagates untouched — we must never
 * silently paper over a broken watermark.
 */
function bind(label, real, fallback) {
  return async (...args) => {
    try {
      const out = await real(...args);
      usingFallback.delete(label);
      return out;
    } catch (err) {
      if (!isNotImplemented(err)) throw err;

      if (!env.allowCoreFallback) {
        throw coreNotReady(
          `${label} is not implemented yet and ALLOW_CORE_FALLBACK is off. ` +
            `Either wait for Person A or set ALLOW_CORE_FALLBACK=true in .env.`
        );
      }
      if (!usingFallback.has(label)) {
        usingFallback.add(label);
        console.warn(`[core] ${label} -> FALLBACK stand-in (not A's real code)`);
      }
      return fallback(...args);
    }
  };
}

/** Same, for the synchronous exports. */
function bindSync(label, real, fallback) {
  return (...args) => {
    try {
      const out = real(...args);
      usingFallback.delete(label);
      return out;
    } catch (err) {
      if (!isNotImplemented(err)) throw err;
      if (!env.allowCoreFallback) {
        throw coreNotReady(`${label} is not implemented yet and ALLOW_CORE_FALLBACK is off.`);
      }
      if (!usingFallback.has(label)) {
        usingFallback.add(label);
        console.warn(`[core] ${label} -> FALLBACK stand-in (not A's real code)`);
      }
      return fallback(...args);
    }
  };
}

// ---------------------------------------------------------------- exports ---

export const encrypt = bindSync('crypto.encrypt', aCrypto.encrypt, cryptoImpl.encrypt);
export const decrypt = bindSync('crypto.decrypt', aCrypto.decrypt, cryptoImpl.decrypt);
export const sha256 = bindSync('crypto.sha256', aCrypto.sha256, cryptoImpl.sha256);
export const md5 = bindSync('crypto.md5', aCrypto.md5, cryptoImpl.md5);
export const deriveKey = bindSync('crypto.deriveKey', aCrypto.deriveKey, cryptoImpl.deriveKey);

export const embed = bind('watermark.embed', aWatermark.embed, watermarkImpl.embed);
export const extract = bind('watermark.extract', aWatermark.extract, watermarkImpl.extract);

export const hashes = bind('phash.hashes', aPhash.hashes, phashImpl.hashes);
export const hamming = bindSync('phash.hamming', aPhash.hamming, phashImpl.hamming);

export const score = bindSync('confidence.score', aConfidence.score, confidenceImpl.score);

export const psnr = bind('psnr.psnr', aPsnr.psnr, psnrImpl.psnr);

export const rsEncode = bindSync('ecc.rsEncode', aEcc.rsEncode, eccImpl.rsEncode);
export const rsDecode = bindSync('ecc.rsDecode', aEcc.rsDecode, eccImpl.rsDecode);

export { buildPayload, parsePayload, bitAgreement, bitsMatching, crc8 } from './payload.js';
