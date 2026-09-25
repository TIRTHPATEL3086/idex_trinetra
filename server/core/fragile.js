/**
 * Fragile watermark — the tamper-evidence layer.
 *
 * The robust DWT-QIM mark (watermark.js) is built to survive: it answers WHO
 * released a copy. This layer is built to break: it answers WHETHER the copy
 * was edited, and WHERE.
 *
 * The image is cut into 8x8 blocks. For each block an HMAC is computed over
 * its pixels (with the blue channel's least significant bit cleared), its
 * position, the image size and the release's receipt id, keyed from the master
 * key. The MAC's bits are written into that block's blue LSBs. Changing a
 * single pixel's visible value changes the block's MAC, so the stored bits no
 * longer match — and only in that block.
 *
 * Invisible (at most +/-1 in one channel), unforgeable without the key, and
 * bound to one release: bits copied from another release's copy do not verify.
 *
 * It does NOT survive lossy re-encoding or resizing, by design. verify()
 * therefore distinguishes a localized edit from a copy whose fragile layer was
 * destroyed wholesale (JPEG, a screenshot, a camera photo) — in that case it
 * says the contents cannot be assessed rather than painting everything red.
 */
import crypto from 'node:crypto';
import sharp from 'sharp';

import { masterKey } from '../lib/env.js';

export const BLOCK = 8;

/** Fraction of a block's bits that must disagree to call it altered (chance is 0.5). */
const BLOCK_FAIL = 0.25;
/** Above this share of failed blocks the layer was destroyed wholesale, not edited. */
const WHOLESALE = 0.6;

const fragileKey = () =>
  crypto.createHmac('sha256', masterKey()).update('fragile-watermark-v1').digest();

function blockMac(key, rgb, width, height, bx, by, receiptHex) {
  const h = crypto.createHmac('sha256', key);
  const header = Buffer.alloc(16);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt32BE(bx, 8);
  header.writeUInt32BE(by, 12);
  h.update(header);
  h.update(Buffer.from(receiptHex.replace(/^0x/, ''), 'hex'));
  const x1 = Math.min(bx + BLOCK, width);
  const y1 = Math.min(by + BLOCK, height);
  const row = Buffer.alloc((x1 - bx) * 3);
  for (let y = by; y < y1; y++) {
    let o = 0;
    for (let x = bx; x < x1; x++) {
      const i = (y * width + x) * 3;
      row[o++] = rgb[i];
      row[o++] = rgb[i + 1];
      row[o++] = rgb[i + 2] & 0xfe; // the blue LSB carries the MAC itself
    }
    h.update(row);
  }
  return h.digest(); // 256 bits >= 64 pixels per block
}

const macBit = (mac, k) => (mac[k >> 3] >> (7 - (k & 7))) & 1;

async function rawRgb(buffer) {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { rgb: Buffer.from(data), width: info.width, height: info.height };
}

/**
 * Embed the fragile layer into an already robust-marked image.
 * @returns {Promise<Buffer>} PNG (lossless — the layer would not survive JPEG)
 */
export async function embedFragile(buffer, receiptHex) {
  const { rgb, width, height } = await rawRgb(buffer);
  const key = fragileKey();
  for (let by = 0; by < height; by += BLOCK) {
    for (let bx = 0; bx < width; bx += BLOCK) {
      const mac = blockMac(key, rgb, width, height, bx, by, receiptHex);
      let k = 0;
      for (let y = by; y < Math.min(by + BLOCK, height); y++) {
        for (let x = bx; x < Math.min(bx + BLOCK, width); x++) {
          const i = (y * width + x) * 3 + 2;
          rgb[i] = (rgb[i] & 0xfe) | macBit(mac, k++);
        }
      }
    }
  }
  return sharp(rgb, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}

/**
 * Check a suspect copy against the release it was attributed to.
 *
 * @param {Buffer} buffer        the uploaded file
 * @param {string} receiptHex    the attributed release's receipt id
 * @param {{width:number,height:number}} released  size of the released copy
 * @returns {Promise<{
 *   status: 'intact'|'tampered'|'unassessable',
 *   reason: string,
 *   blocks?: number, failed?: number, failedPct?: number,
 *   regions?: {x:number,y:number,w:number,h:number}[],
 *   heatmap?: string            // PNG data URL: suspect copy with red/green overlay
 * }>}
 */
export async function verifyFragile(buffer, receiptHex, released) {
  const { rgb, width, height } = await rawRgb(buffer);
  if (released && (width !== released.width || height !== released.height)) {
    return {
      status: 'unassessable',
      reason: `The copy was resized (${width}x${height}, released as ${released.width}x${released.height}), which destroys the fragile layer, so its contents cannot be checked for edits.`,
    };
  }

  const key = fragileKey();
  const cols = Math.ceil(width / BLOCK);
  const rows = Math.ceil(height / BLOCK);
  const failed = new Uint8Array(cols * rows);
  let nFailed = 0;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const bx = c * BLOCK;
      const by = r * BLOCK;
      const mac = blockMac(key, rgb, width, height, bx, by, receiptHex);
      let k = 0;
      let wrong = 0;
      for (let y = by; y < Math.min(by + BLOCK, height); y++) {
        for (let x = bx; x < Math.min(bx + BLOCK, width); x++) {
          if ((rgb[(y * width + x) * 3 + 2] & 1) !== macBit(mac, k++)) wrong++;
        }
      }
      if (wrong / k > BLOCK_FAIL) {
        failed[r * cols + c] = 1;
        nFailed++;
      }
    }
  }

  const blocks = cols * rows;
  const failedPct = Math.round((nFailed / blocks) * 1000) / 10;
  if (nFailed === 0) {
    return {
      status: 'intact',
      reason: `All ${blocks} fragile blocks verify — no pixel of this copy has been altered since release.`,
      blocks,
      failed: 0,
      failedPct: 0,
      regions: [],
      heatmap: await heatmap(rgb, width, height, failed, cols),
    };
  }
  if (nFailed / blocks > WHOLESALE) {
    return {
      status: 'unassessable',
      reason: `${failedPct}% of fragile blocks fail uniformly — the copy was re-encoded (e.g. JPEG, screenshot or photo), which destroys the fragile layer everywhere, so edits cannot be localized.`,
      blocks,
      failed: nFailed,
      failedPct,
    };
  }
  const regions = regionsOf(failed, cols, rows);
  return {
    status: 'tampered',
    reason: `${nFailed} of ${blocks} blocks (${failedPct}%) were altered after release, in ${regions.length} region${regions.length === 1 ? '' : 's'}.`,
    blocks,
    failed: nFailed,
    failedPct,
    regions,
    heatmap: await heatmap(rgb, width, height, failed, cols),
  };
}

/** Group failed blocks into bounding boxes of 4-connected clusters (pixel units). */
function regionsOf(failed, cols, rows) {
  const seen = new Uint8Array(failed.length);
  const out = [];
  for (let s = 0; s < failed.length; s++) {
    if (!failed[s] || seen[s]) continue;
    let [minC, minR, maxC, maxR] = [cols, rows, 0, 0];
    const stack = [s];
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop();
      const c = i % cols;
      const r = (i / cols) | 0;
      minC = Math.min(minC, c);
      maxC = Math.max(maxC, c);
      minR = Math.min(minR, r);
      maxR = Math.max(maxR, r);
      for (const [dc, dr] of [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]) {
        const nc = c + dc;
        const nr = r + dr;
        const j = nr * cols + nc;
        if (nc >= 0 && nr >= 0 && nc < cols && nr < rows && failed[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    out.push({
      x: minC * BLOCK,
      y: minR * BLOCK,
      w: (maxC - minC + 1) * BLOCK,
      h: (maxR - minR + 1) * BLOCK,
    });
  }
  return out.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, 20);
}

/** The suspect copy, tinted green where authentic and red where altered. */
async function heatmap(rgb, width, height, failed, cols) {
  const out = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 3;
      const bad = failed[((y / BLOCK) | 0) * cols + ((x / BLOCK) | 0)];
      const g = (rgb[i] * 0.3 + rgb[i + 1] * 0.59 + rgb[i + 2] * 0.11) * 0.55;
      // Altered blocks glow red; authentic ones take a soft green wash.
      out[i] = bad ? Math.min(255, g + 150) : g * 0.85;
      out[i + 1] = bad ? g * 0.35 : Math.min(255, g + 60);
      out[i + 2] = bad ? g * 0.35 : g * 0.85;
    }
  }
  const png = await sharp(out, { raw: { width, height, channels: 3 } })
    .resize({ width: Math.min(width, 900), withoutEnlargement: true })
    .png()
    .toBuffer();
  return `data:image/png;base64,${png.toString('base64')}`;
}
