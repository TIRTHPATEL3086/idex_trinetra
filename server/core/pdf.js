/**
 * ============================================================================
 * PDF Watermarking: Rasterized Dual-Layer Strategy
 * ============================================================================
 *
 * Layer 1 — Metadata (Structural):
 *   Embeds the receipt ID and payload bits directly into PDF document metadata
 *   (Subject, Keywords, Creator). This is the "hard" anchor — trivially
 *   readable by any forensic investigator, survives most document management
 *   systems, and is the ground truth used by extractPdf().
 *
 * Layer 2 — the pages' own pixels (core/pagemark.js):
 *   Every page is drawn, marked coarsely enough to survive a phone photo of
 *   the screen, and laid over itself as a page-sized image; the original
 *   content stays underneath for text selection. The keywords carry
 *   PAGE_MARK_TAG so a trace knows to align photos to these pages. Should
 *   that fail, a 256×256 DWT tile is drawn faintly in each page's corner
 *   instead (the earlier scheme — it does not survive a photo).
 *
 * Together, these two layers satisfy the "Rasterized DWT Watermarking for
 * Document PDFs" requirement from the Phase 4 spec.
 *
 * Extraction preference order:
 *   1. PDF keywords (fast, exact)
 *   2. Injected image XObject watermark (using the same extract() path
 *      from watermark.js, applied to the embedded tile PNG)
 *   3. Full-page raster extraction (future extension)
 */

import { PDFDocument, rgb } from 'pdf-lib';
import sharp from 'sharp';

import { env } from '../lib/env.js';
import { markPage, pageMarkView, PAGE_MARK, PAGE_MARK_TAG } from './pagemark.js';
import { renderPdfPages } from './pdfpreview.js';

/** Pages marked in their pixels; any beyond keep the metadata layer only. */
const MAX_MARKED_PAGES = 100;

/**
 * Checks if a buffer is a PDF file by inspecting the magic header bytes.
 * @param {Buffer} buffer
 * @returns {boolean}
 */
export function isPdf(buffer) {
  if (!buffer || buffer.length < 4) return false;
  return buffer.slice(0, 4).toString('ascii') === '%PDF';
}

/**
 * Whether a PDF's pages carry the mark in their pixels (released after the
 * page mark was introduced). Earlier PDF releases are marked in their
 * metadata only, and a photo of one cannot be traced.
 */
export async function hasPageMark(pdfBuffer) {
  try {
    const doc = await PDFDocument.load(pdfBuffer, { updateMetadata: false });
    return String(doc.getKeywords() || '').includes(PAGE_MARK_TAG);
  } catch {
    return false;
  }
}

/**
 * Generate a rasterized DWT-watermarked tile (256×256 JPEG) carrying the
 * payload bits. The tile is a nearly-uniform mid-gray image so the delta
 * from watermarking is perceptually negligible.
 *
 * @param {string} payloadBits  48-char binary string
 * @returns {Promise<Buffer>}   JPEG bytes of the watermarked tile
 */
async function generateWatermarkTile(payloadBits) {
  // 256 px: the mark sits in 8x8 blocks (watermark.js LEVELS = 3), and
  // a smaller tile has too few of them to hold every copy of every bit.
  const SIZE = 256;
  // Create a mid-gray base tile (RGB, 3 channels)
  const grayValue = 127;
  const raw = Buffer.alloc(SIZE * SIZE * 3, grayValue);

  // Convert to PNG so embed() can process it
  const pngTile = await sharp(raw, {
    raw: { width: SIZE, height: SIZE, channels: 3 },
  })
    .png()
    .toBuffer();

  try {
    // Use the same Haar-DWT + QIM embed pipeline as images
    const { embed } = await import('./watermark.js');
    const result = await embed(pngTile, payloadBits, env.watermarkDelta);
    // Convert to JPEG for compact embedding in PDF (lossless enough at Q90)
    return await sharp(result.buffer).jpeg({ quality: 90 }).toBuffer();
  } catch (err) {
    console.warn('[pdf] DWT tile generation failed, using raw tile:', err.message);
    return await sharp(raw, { raw: { width: SIZE, height: SIZE, channels: 3 } })
      .jpeg({ quality: 90 })
      .toBuffer();
  }
}

/**
 * Embeds a dual-layer provenance watermark into a PDF document:
 *   - Metadata layer: receipt ID + payload bits in PDF Subject/Keywords
 *   - Rasterized DWT layer: 256×256 JPEG tile injected as transparent XObject
 *
 * @param {Buffer} pdfBuffer    Plaintext PDF bytes
 * @param {string} payloadBits  Exactly 48 chars of '0'/'1'
 * @param {string} receiptIdHex 0x-prefixed 32-byte receipt id
 * @returns {Promise<{ buffer: Buffer, psnrDb: number, deltaUsed: number }>}
 */
export async function embedPdf(pdfBuffer, payloadBits, receiptIdHex) {
  const doc = await PDFDocument.load(pdfBuffer);

  // ── Layer 1: Metadata ────────────────────────────────────────────────────
  doc.setSubject(`Decryption Provenance: ${receiptIdHex}`);
  doc.setKeywords([
    `provenance:${receiptIdHex}`,
    `payload:${payloadBits}`,
    `algo:haar-dwt-qim`,
    `version:v1`,
  ]);
  doc.setCreator('SIH26237 Crypto Provenance System');
  doc.setProducer(`ML-KEM-768/ML-DSA-65 NIST PQC`);

  // ── Layer 2: the mark in the pages' own pixels ───────────────────────────
  // Each page is drawn, marked (core/pagemark.js) and laid over itself as one
  // image the size of the page. The original content stays underneath, so
  // text can still be selected and searched; what is seen — and what a photo
  // of the screen captures — is the marked page.
  try {
    const drawn = await renderPdfPages(pdfBuffer, {
      maxPages: MAX_MARKED_PAGES,
      dpi: PAGE_MARK.dpi,
    });
    // Every page is marked before any is drawn on, so a failure part-way
    // leaves the document untouched for the fallback below.
    // The PSNR is of what a reader sees — each page as drawn against the
    // marked image laid over it — pooled over the marked pages.
    const marks = [];
    let sse = 0;
    let count = 0;
    for (const d of drawn) {
      const marked = await markPage(d.png, payloadBits);
      const jpeg = await sharp(marked).jpeg({ quality: 92, chromaSubsampling: '4:4:4' }).toBuffer();
      marks.push({ page: d.page, jpeg });
      const [a, b] = await Promise.all(
        [d.png, jpeg].map((buf) =>
          sharp(buf).removeAlpha().resize(d.width, d.height, { fit: 'fill' }).raw().toBuffer()
        )
      );
      for (let i = 0; i < a.length; i++) sse += (a[i] - b[i]) ** 2;
      count += a.length;
    }
    const psnrDb = count && sse ? 10 * Math.log10((255 * 255 * count) / sse) : null;
    const pages = doc.getPages();
    for (const { page: n, jpeg } of marks) {
      const page = pages[n - 1];
      const box = page.getCropBox();
      page.drawImage(await doc.embedJpg(jpeg), {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      });
    }
    doc.setKeywords([
      `provenance:${receiptIdHex}`,
      `payload:${payloadBits}`,
      `algo:haar-dwt-qim`,
      `version:v1`,
      PAGE_MARK_TAG,
    ]);
    const modifiedBytes = await doc.save();
    return { buffer: Buffer.from(modifiedBytes), psnrDb, deltaUsed: PAGE_MARK.delta };
  } catch (err) {
    console.warn('[pdf] marking the pages failed, falling back to the corner tile:', err.message);
  }

  // ── Fallback: Rasterized DWT Tile ────────────────────────────────────────
  try {
    const tileJpeg = await generateWatermarkTile(payloadBits);
    const embeddedImg = await doc.embedJpg(tileJpeg);
    const pages = doc.getPages();

    for (const page of pages) {
      const { width } = page.getSize();

      // Draw the DWT-watermarked tile as a nearly-invisible overlay.
      // It is drawn at the bottom-right corner at 1% opacity so it is
      // imperceptible to readers but survives print-scan rasterization.
      page.drawImage(embeddedImg, {
        x: width - 36,
        y: 4,
        width: 32,
        height: 32,
        opacity: 0.04, // 4% opacity — invisible in normal viewing
      });
    }
  } catch (tileErr) {
    // Non-fatal: metadata layer is always present
    console.warn('[pdf] Rasterized DWT tile injection failed:', tileErr.message);

    // Fallback: inject invisible text with full payload
    const pages = doc.getPages();
    for (const page of pages) {
      page.drawText(`[SIH26237-PROVENANCE:${receiptIdHex}:${payloadBits}]`, {
        x: 10,
        y: 5,
        size: 0.1,
        color: rgb(0, 0, 0),
        opacity: 0.01,
      });
    }
  }

  const modifiedBytes = await doc.save();
  return {
    buffer: Buffer.from(modifiedBytes),
    // Not measured: a PDF has no single raster to compare, so its release
    // records no PSNR and stays out of the pixel statistics.
    psnrDb: null,
    deltaUsed: env.watermarkDelta,
  };
}

/**
 * Extracts provenance watermark and receipt info from a PDF document.
 *
 * Tries in order:
 *   1. Keyword-based exact extraction (fast, survives any PDF manipulation)
 *   2. Image XObject DWT extraction (survives print-scan)
 *
 * @param {Buffer} pdfBuffer
 * @returns {Promise<{ payloadBits: string, bitConfidence: number, eccCorrected: boolean } | null>}
 */
export async function extractPdf(pdfBuffer) {
  try {
    const doc = await PDFDocument.load(pdfBuffer);
    const keywords = String(doc.getKeywords() || '');
    const subject = String(doc.getSubject() || '');

    // ── Method 1: Keyword metadata ───────────────────────────────────────────
    const kwMatch = keywords.match(/payload:([01]{48})/);
    if (kwMatch) {
      return { payloadBits: kwMatch[1], bitConfidence: 1.0, eccCorrected: false };
    }

    // ── Method 2: Subject (receipt ID → rebuild payload) ─────────────────────
    const subjMatch = subject.match(/0x[0-9a-fA-F]{64}/);
    if (subjMatch) {
      const { buildPayload } = await import('./payload.js');
      const payloadBits = buildPayload(subjMatch[0]);
      return { payloadBits, bitConfidence: 1.0, eccCorrected: false };
    }

    // ── Method 3: DWT extraction from embedded image XObjects ────────────────
    // Walk every page's XObjects and attempt watermark extraction on each
    // image. This handles the case where metadata was stripped.
    try {
      const { extract } = await import('./watermark.js');
      const pages = doc.getPages();

      for (const page of pages) {
        const xobjects = page.node.Resources()?.lookup(page.doc.context.obj('XObject'));
        if (!xobjects) continue;

        const keys = xobjects?.dict ? [...xobjects.dict.keys()] : [];
        for (const key of keys) {
          try {
            const xobj = xobjects.lookup(key);
            const subtype = xobj?.lookup?.(doc.context.obj('Subtype'))?.toString();
            if (subtype !== '/Image') continue;

            // Extract raw image bytes from the XObject stream
            const streamData = xobj.getContents?.();
            if (!streamData || streamData.length < 100) continue;

            // Try DWT extraction on the raw image stream
            const candidate = await extract(Buffer.from(streamData), 10);
            if (candidate.bitConfidence > 0.7) {
              return {
                payloadBits: candidate.payloadBits,
                bitConfidence: candidate.bitConfidence,
                eccCorrected: candidate.eccCorrected,
              };
            }
          } catch {
            // Skip this XObject
          }
        }
      }
    } catch {
      // XObject walk failed — not a fatal error
    }

    // ── Method 4: the mark in the first page's pixels ───────────────────────
    // Survives the metadata being stripped, as long as the page image stays.
    try {
      const { extract } = await import('./watermark.js');
      const { parsePayload } = await import('./payload.js');
      const [first] = await renderPdfPages(pdfBuffer, { maxPages: 1, dpi: PAGE_MARK.dpi });
      if (first) {
        const reading = await extract(await pageMarkView(first.png), PAGE_MARK.delta);
        if (parsePayload(reading.payloadBits).crcOk) {
          return {
            payloadBits: reading.payloadBits,
            bitConfidence: reading.bitConfidence,
            eccCorrected: reading.eccCorrected,
          };
        }
      }
    } catch {
      // no page mark to read
    }

    return null;
  } catch {
    return null;
  }
}
