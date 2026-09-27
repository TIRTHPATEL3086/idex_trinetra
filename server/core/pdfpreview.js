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

/** Pages compared when measuring a PDF's PSNR, and the resolution. Kept
 *  small: the live server has a fraction of one CPU, and this work must not
 *  hold up the requests queued behind it. */
const PSNR_PAGES = 3;
const PSNR_DPI = 72;
/** Hand the event loop back between pages so other requests are served. */
const breathe = () => new Promise((resolve) => setImmediate(resolve));

/**
 * PSNR of a marked PDF against its original, measured the same way as for an
 * image: both are drawn page by page at the same resolution and every pixel is
 * compared. The error is pooled over all compared pages, so the figure is one
 * number for the document, not a best page.
 *
 * @returns {Promise<number|null>} dB; null when the two cannot be compared
 */
export async function pdfPsnr(originalPdf, markedPdf) {
  const lib = await loadPdfjs();
  const { createCanvas } = require('@napi-rs/canvas');
  const open = (buf) =>
    lib.getDocument({
      data: new Uint8Array(buf),
      standardFontDataUrl: FONT_DIR,
      verbosity: 0,
      isEvalSupported: false,
    });
  const a = open(originalPdf);
  const b = open(markedPdf);
  try {
    const [da, db] = await Promise.all([a.promise, b.promise]);
    if (da.numPages !== db.numPages) return null;
    const draw = async (doc, n) => {
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: PSNR_DPI / 72 });
      const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
      return ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    };
    let sse = 0;
    let count = 0;
    for (let n = 1; n <= Math.min(da.numPages, PSNR_PAGES); n++) {
      await breathe();
      const pa = await draw(da, n);
      await breathe();
      const pb = await draw(db, n);
      if (pa.length !== pb.length) return null;
      for (let i = 0; i < pa.length; i += 4) {
        // RGB only; the alpha channel is always opaque paper here.
        for (let c = 0; c < 3; c++) {
          const d = pa[i + c] - pb[i + c];
          sse += d * d;
        }
        count += 3;
      }
    }
    if (!count) return null;
    const mse = sse / count;
    // Identical pixels have no finite PSNR; report the ceiling an 8-bit
    // comparison can resolve (one level of error in the whole document).
    return mse === 0
      ? 10 * Math.log10((255 * 255 * count) / 1)
      : 10 * Math.log10((255 * 255) / mse);
  } finally {
    await Promise.all([a.destroy(), b.destroy()]);
  }
}

/**
 * The first pages of a PDF as pictures, the document opened once. Drawn
 * upright, whatever /Rotate a page carries, so each picture lines up with the
 * page's own coordinates — the frame a watermarked page image is laid in.
 *
 * @param {Buffer} pdfBuffer
 * @param {{ maxPages?: number, dpi?: number }} [opts]
 * @returns {Promise<Array<{ png:Buffer, page:number, width:number, height:number }>>}
 */
export async function renderPdfPages(pdfBuffer, { maxPages = Infinity, dpi = DPI } = {}) {
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
    const pages = [];
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
      await breathe();
      const page = await doc.getPage(n);
      const vp = page.getViewport({ scale: dpi / 72, rotation: 0 });
      const canvas = createCanvas(Math.round(vp.width), Math.round(vp.height));
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff'; // paper, not transparency
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp, canvas }).promise;
      const png = await sharp(canvas.toBuffer('image/png')).removeAlpha().png().toBuffer();
      pages.push({ png, page: n, width: canvas.width, height: canvas.height });
    }
    return pages;
  } finally {
    await task.destroy();
  }
}

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
