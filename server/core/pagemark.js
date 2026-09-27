/**
 * The mark on the pages of a PDF, made to survive a photograph of the screen.
 *
 * embed() in watermark.js marks fine detail — 8x8 blocks at full resolution.
 * On a photographed page that detail is gone: the camera resamples, blurs and
 * re-exposes the page, and a reading comes back at chance (about 24/48 bits).
 *
 * So the page is marked coarsely instead. It is drawn, shrunk to a third, and
 * marked there with the usual embed(); only the change that made — not the
 * shrunk page — is enlarged back and added to the full page. The text stays
 * as sharp as it was, and the mark becomes a pattern three times larger that
 * a phone camera keeps. A trace shrinks the photo by the same third before
 * reading it (see pageMarkView).
 *
 * Measured on a text-heavy A4 page drawn at 150 dpi: PSNR about 50 dB, and
 * 48/48 bits recovered from simulated phone photos of the screen — scaled,
 * rotated, blurred, re-exposed and JPEG-compressed — where the full-resolution
 * mark read 24-29.
 */
import sharp from 'sharp';

import { embed } from './watermark.js';

/** Resolution pages are drawn at, how far they are shrunk, and QIM strength. */
export const PAGE_MARK = { dpi: 150, scale: 3, delta: 8 };

/** Tag in a PDF's keywords saying its pages carry the mark. */
export const PAGE_MARK_TAG = `pagemark:v1:dpi${PAGE_MARK.dpi}:s${PAGE_MARK.scale}:d${PAGE_MARK.delta}`;

const smallSize = (width, height) => ({
  width: Math.max(1, Math.round(width / PAGE_MARK.scale)),
  height: Math.max(1, Math.round(height / PAGE_MARK.scale)),
});

/**
 * A drawn page as the mark is read from it: shrunk by the mark's scale. For
 * the released page this is the picture a photo of it is aligned to.
 *
 * @param {Buffer} png  the page drawn at PAGE_MARK.dpi
 */
export async function pageMarkView(png) {
  const { width, height } = await sharp(png).metadata();
  const small = smallSize(width, height);
  return sharp(png)
    .removeAlpha()
    .resize(small.width, small.height, { fit: 'fill', kernel: 'lanczos3' })
    .png()
    .toBuffer();
}

/**
 * Mark one drawn page.
 *
 * @param {Buffer} png          the page drawn at PAGE_MARK.dpi
 * @param {string} payloadBits  48 chars of '0'/'1'
 * @returns {Promise<Buffer>}   the marked page, same size, as PNG
 */
export async function markPage(png, payloadBits) {
  const { width, height } = await sharp(png).metadata();
  const small = smallSize(width, height);
  const view = await pageMarkView(png);
  const marked = (await embed(view, payloadBits, PAGE_MARK.delta)).buffer;

  const rgb = (buf, w, h) =>
    sharp(buf).removeAlpha().resize(w, h, { fit: 'fill' }).raw().toBuffer();
  const [before, after] = await Promise.all([
    rgb(view, small.width, small.height),
    rgb(marked, small.width, small.height),
  ]);
  // The change the mark made, offset by 128 to fit a byte, then enlarged
  // smoothly to the full page and added back.
  const change = Buffer.alloc(before.length);
  for (let i = 0; i < before.length; i++) {
    change[i] = Math.max(0, Math.min(255, 128 + after[i] - before[i]));
  }
  const [grown, page] = await Promise.all([
    sharp(change, { raw: { width: small.width, height: small.height, channels: 3 } })
      .resize(width, height, { fit: 'fill', kernel: 'cubic' })
      .raw()
      .toBuffer(),
    rgb(png, width, height),
  ]);
  const out = Buffer.alloc(page.length);
  for (let i = 0; i < page.length; i++) {
    out[i] = Math.max(0, Math.min(255, page[i] + grown[i] - 128));
  }
  return sharp(out, { raw: { width, height, channels: 3 } })
    .png()
    .toBuffer();
}
