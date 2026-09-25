/**
 * One page of a PDF as a picture, for previews.
 *
 * The Watermark screen shows a released copy two ways — the administrator's
 * stamped view and the officer's copy as released. For an image that is the
 * image; for a PDF it is its pages, rendered here one at a time.
 */
import path from 'node:path';
import { createRequire } from 'node:module';
import sharp from 'sharp';

const require = createRequire(import.meta.url);

/** Resolution pages are rendered at: an A4 page comes out 1240 x 1754. */
const DPI = 150;

let pdfjs = null;
const loadPdfjs = async () => {
  pdfjs ??= await import('pdfjs-dist/legacy/build/pdf.mjs');
  return pdfjs;
};

// pdf.js loads its standard fonts from here; it wants a URL-style path with a
// trailing slash on every platform.
const FONT_DIR =
  path
    .join(path.dirname(require.resolve('pdfjs-dist/package.json')), 'standard_fonts')
    .split(path.sep)
    .join('/') + '/';

/**
 * @param {Buffer} pdfBuffer
 * @param {number} pageNo  1-based; clamped to the document
 * @returns {Promise<{ png:Buffer, page:number, pageCount:number }>}
 */
export async function renderPdfPage(pdfBuffer, pageNo = 1) {
  const lib = await loadPdfjs();
  const { createCanvas } = require('@napi-rs/canvas');
  const task = lib.getDocument({
    data: new Uint8Array(pdfBuffer),
    standardFontDataUrl: FONT_DIR,
    verbosity: 0,
    isEvalSupported: false,
  });
  try {
    const doc = await task.promise;
    const n = Math.min(Math.max(1, pageNo), doc.numPages);
    const page = await doc.getPage(n);
    const vp = page.getViewport({ scale: DPI / 72 });
    const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff'; // paper, not transparency
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
    const png = await sharp(canvas.toBuffer('image/png')).removeAlpha().png().toBuffer();
    return { png, page: n, pageCount: doc.numPages };
  } finally {
    await task.destroy();
  }
}
