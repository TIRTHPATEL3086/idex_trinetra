import { Router } from 'express';
import sharp from 'sharp';

import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { badInput } from '../lib/errors.js';
import { bufferToHex } from '../lib/refs.js';
import { singleFile } from '../middleware/upload.js';
import { requireCap } from '../middleware/auth.js';
import * as chain from '../core/chain.js';
import * as bktree from '../core/bktree.js';
import { hashes, extract, score, sha256, hamming, isPdf, extractPdf } from '../core/index.js';
import { hasPageMark } from '../core/pdf.js';
import { renderPdfPages } from '../core/pdfpreview.js';
import { PAGE_MARK, pageMarkView } from '../core/pagemark.js';
import {
  parsePayload,
  bitAgreement,
  bitsMatching,
  PAYLOAD_BITS,
  isDegeneratePayload,
} from '../core/payload.js';
import { signDecryptionReceipt, verifyDecryptionSignature } from '../core/pqc.js';
import { userKeys } from '../lib/keyring.js';
import { generateDossier } from '../core/dossier.js';
import { detectQuad, dewarp, removeMoire, matchTones } from '../core/lens.js';
import { verifyFragile } from '../core/fragile.js';
import { recoverFromCapture } from '../core/recover.js';
import { readMarked } from '../lib/files.js';

/**
 * Attribution: hash, search, extract, cross-check, score.
 *
 * TWO INDEPENDENT PATHS converge here, and that is deliberate:
 *   - the watermark says WHICH receipt (exact, but fragile under heavy attack)
 *   - the perceptual hashes say WHICH FILE (fuzzy, but survives a screenshot)
 * Agreement between them is what earns a high confidence. Disagreement is what
 * pushes the verdict down to PROBABLE or INCONCLUSIVE — which is the point.
 *
 * We return `match: null` for INCONCLUSIVE, so the frontend never receives a
 * name it is not allowed to show. A wrong accusation is the expensive failure
 * here, not a missed one.
 */
const router = Router();

/**
 * Bits that must agree before a reading without a valid CRC may name a release.
 * Chance agreement is 24/48; the watermark attack suite's genuine survivals
 * land at 43-48, and simulated phone photos of a released image at 37-40. At
 * 30, a photo of a document nobody here released was read at 30-32 against
 * a recent release and its recipient named — a trace compares one upload
 * with many copies many ways, so the best of those comparisons is well above
 * 24 by chance alone. 36/48 happens by chance about 3 times in 10,000
 * comparisons; the lead over other officers (MIN_LEAD_BITS) does the rest.
 */
const MIN_BITS_WITHOUT_CRC = 36;

/**
 * How far a reading without a valid CRC must agree better with the named
 * officer's copy than with any other officer's. A genuine mark leads by far
 * (a photo read at 37 agrees with other officers' copies at about 24); a
 * lucky reading barely leads at all.
 */
const MIN_LEAD_BITS = 4;

/**
 * A weaker reading — 32 to 35 bits — may still name an officer when the photo
 * also looks like that release: the watermark then only has to tell apart the
 * recipients of a document the picture plainly shows, not find it among
 * everything ever released. A phone photo of a released image measured 8-9/64
 * against it; a photo of a document nobody here released measured 32-34/64
 * against the release its bits drifted towards.
 */
const MIN_BITS_WITH_VISUAL_MATCH = 32;
const MAX_VISUAL_PHASH_DIST = 12;

/**
 * Whether bits name a real release: a valid CRC alone is not enough, because
 * degenerate readings (all zeros, all ones) from a mark that did not survive
 * can satisfy an 8-bit CRC by construction.
 */
async function namesARelease(bits) {
  try {
    const parsed = parsePayload(bits);
    if (!parsed.crcOk) return false;
    const hit = await prisma.decryptionEvent.findUnique({
      where: { shortId: parsed.shortId },
      select: { id: true },
    });
    return Boolean(hit);
  } catch {
    return false;
  }
}

/** Whether a reading already names a release, one way or the other. */
async function readingIdentifies(bits) {
  if (await namesARelease(bits)) return true;
  const recent = await prisma.decryptionEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: { payloadBits: true },
  });
  return recent.some((e) => bitsMatching(bits, e.payloadBits) >= MIN_BITS_WITHOUT_CRC);
}

/**
 * SHA-256 of evidence in canonical form — keys sorted at every level — so the
 * digest is the same after a round trip through PostgreSQL's JSONB, which does
 * not keep key order.
 */
function evidenceDigest(evidence) {
  const canon = (v) =>
    Array.isArray(v)
      ? v.map(canon)
      : v && typeof v === 'object'
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, canon(v[k])])
          )
        : v;
  return sha256(Buffer.from(JSON.stringify(canon(evidence)))).toString('hex');
}

/** Candidates the pHash search itself matched — a genuine visual resemblance. */
const visualMatches = (candidates) => candidates.filter((c) => c.pHashDist != null);

/**
 * Releases a photo or screenshot can be aligned to: images, and PDFs — whose
 * pages carry the mark in their pixels (older PDF releases, marked in their
 * metadata only, are passed over when their copy is read).
 */
const TRACEABLE_RELEASE = {
  OR: [
    { asset: { mimeType: { startsWith: 'image/' } } },
    { asset: { mimeType: 'application/pdf' } },
  ],
};

/** Pages of a released PDF a photo is compared with; a photo is nearly always of an early page. */
const TRACE_PDF_PAGES = 3;

/**
 * A released copy as the pictures an upload can be aligned to, each with its
 * size: the image itself, or the first pages of a PDF whose pages are marked.
 * Empty when there is none — the copy is gone, a PDF marked in its metadata
 * only, or a file sharp cannot decode (cut short, or stale on the server's
 * disk). Such a copy is skipped, the same as a missing one, instead of failing
 * the whole trace.
 */
async function readReleaseViews(ev) {
  const copy = await readMarked(ev).catch(() => null);
  if (!copy) return [];
  try {
    if (isPdf(copy)) {
      if (!(await hasPageMark(copy))) return [];
      // Each page drawn as it was marked, then shrunk to the scale the mark
      // lives at: a photo of the page is aligned to that and read there.
      const pages = await renderPdfPages(copy, {
        maxPages: TRACE_PDF_PAGES,
        dpi: PAGE_MARK.dpi,
      });
      const views = [];
      for (const p of pages) {
        const buffer = await pageMarkView(p.png);
        const { width, height } = await sharp(buffer).metadata();
        views.push({ buffer, width, height, page: p.page });
      }
      return views;
    }
    const { width, height } = await sharp(copy).metadata();
    return width && height ? [{ buffer: copy, width, height, page: null }] : [];
  } catch (err) {
    console.warn(`[trace] released copy of event ${ev.id} could not be read:`, err.message);
    return [];
  }
}

/**
 * One trace looks at the same released copies several times (rescaled reads,
 * with and without the lens, capture recovery). Each copy is fetched from
 * storage, checked and (for a PDF) drawn once per trace and shared.
 */
function traceCache() {
  const copies = new Map();
  return {
    views: (ev) => {
      if (!copies.has(ev.id)) copies.set(ev.id, readReleaseViews(ev));
      return copies.get(ev.id);
    },
  };
}

/**
 * A step that only tries to recover more of the mark. Should it fail, the
 * trace goes on with the reading it already has rather than failing outright;
 * the stage is logged so the cause can be found.
 */
async function optionalStep(stage, fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`[trace] ${stage} skipped:`, err?.stack || err);
    return null;
  }
}

/**
 * Re-read the mark after scaling the leak back to the size of each copy the
 * hash search matched. A rescaled reading is rarely bit-perfect, so it is kept
 * when it agrees with that copy's own payload well beyond chance.
 *
 * Falls back to recent decryption events if the phone photo's pHash was skewed
 * by perspective, screen moiré, or lighting glare.
 *
 * @returns the best such reading, or null
 */
async function extractAtCandidateSizes(
  buffer,
  candidates,
  { tones = false, cache = traceCache() } = {}
) {
  let matchedIds = visualMatches(candidates).map((c) => c.id);
  if (!matchedIds.length) {
    const recent = await prisma.decryptionEvent.findMany({
      where: TRACEABLE_RELEASE,
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true },
    });
    matchedIds = recent.map((r) => r.id);
  }

  const events = await prisma.decryptionEvent.findMany({
    where: { id: { in: matchedIds }, ...TRACEABLE_RELEASE },
    orderBy: { createdAt: 'desc' },
    take: 25,
    select: { id: true, markedPath: true, payloadBits: true, deltaUsed: true },
  });
  const bufMeta = await sharp(buffer).metadata();
  const readings = new Map(); // key -> reading, so each variant is decoded once
  let best = null;

  // Keeps a reading that names a release outright, or the one that agrees
  // best with this copy's own payload beyond chance.
  // The same bits come up again and again; look each up once.
  const named = new Map();
  const namesOnce = (bits) => {
    if (!named.has(bits)) named.set(bits, namesARelease(bits));
    return named.get(bits);
  };
  // The upload scaled to a size, and tone-matched to a copy, made once each
  // rather than once per strength tried.
  const scaled = new Map();
  const scaledTo = (w, h) => {
    const key = `${w}x${h}`;
    if (!scaled.has(key)) {
      scaled.set(key, sharp(buffer).resize(w, h, { fit: 'fill' }).png().toBuffer());
    }
    return scaled.get(key);
  };
  const toned = new Map();
  const tonedTo = (key, copy, w, h) => {
    if (!toned.has(key))
      toned.set(
        key,
        scaledTo(w, h).then((img) => matchTones(img, copy))
      );
    return toned.get(key);
  };

  const consider = async (reading, ev) => {
    if (!reading || isDegeneratePayload(reading.payloadBits)) return false;
    if (await namesOnce(reading.payloadBits)) return true;
    const matches = bitsMatching(reading.payloadBits, ev.payloadBits);
    if (matches >= MIN_BITS_WITH_VISUAL_MATCH && (!best || matches > best.matches)) {
      best = { reading, matches };
    }
    return false;
  };
  const readOnce = async (key, make) => {
    if (!readings.has(key)) {
      try {
        readings.set(key, await make());
      } catch {
        readings.set(key, null);
      }
    }
    return readings.get(key);
  };

  // Each picture of each copy: the image, or a page of a PDF. None when the
  // copy is gone or unreadable — nothing the upload could be aligned to.
  const views = [];
  for (const ev of events) for (const view of await cache.views(ev)) views.push({ ev, view });

  for (const { ev, view: copy } of views) {
    const size = { width: copy.width, height: copy.height };
    const dims = `${size.width}x${size.height}`;
    const deltas = [...new Set([ev.deltaUsed, 12, 14].filter(Boolean))];

    // Pass 0: read at the upload's own size (no blur from upscaling).
    for (const d of deltas) {
      const reading = await readOnce(`direct@${d}`, async () => ({
        ...(await extract(buffer, d, { multiOrientation: false })),
        rescaledTo: `direct (${d} delta)`,
      }));
      if (await consider(reading, ev)) return reading;
    }

    // Pass 1: scaled back to the released copy's size.
    for (const d of [...new Set([...deltas, 16])]) {
      const reading = await readOnce(`${dims}@${d}`, async () => {
        const aligned = await scaledTo(size.width, size.height);
        return {
          ...(await extract(aligned, d, { multiOrientation: false })),
          rescaledTo: `${dims} px`,
        };
      });
      if (await consider(reading, ev)) return reading;
    }

    // Pass 2: tone curve matched to this copy — undoes a camera's exposure and
    // white balance. Tone matching is against one copy, so it is per copy.
    if (tones) {
      for (const d of deltas) {
        const reading = await readOnce(`${dims}#${ev.id}.${copy.page}@${d}`, async () => {
          const tonedImg = await tonedTo(
            `${ev.id}.${copy.page}`,
            copy.buffer,
            size.width,
            size.height
          );
          return {
            ...(await extract(tonedImg, d, { multiOrientation: false })),
            rescaledTo: `${dims} px (tones matched)`,
          };
        });
        if (await consider(reading, ev)) return reading;
      }
    }

    // Pass 3: a tall photo of a landscape page is often a laptop shot — read
    // the upper 55% only, leaving the keyboard out.
    const isTall = (bufMeta.height || 0) > (bufMeta.width || 0) * 0.85;
    if (isTall && size.width > size.height) {
      const reading = await readOnce(`${dims}#topScreen`, async () => {
        const top = await sharp(buffer)
          .extract({
            left: 0,
            top: 0,
            width: bufMeta.width,
            height: Math.round(bufMeta.height * 0.55),
          })
          .resize(size.width, size.height, { fit: 'fill' })
          .png()
          .toBuffer();
        return {
          ...(await extract(top, ev.deltaUsed || 12, { multiOrientation: false })),
          rescaledTo: `${dims} px (keyboard clipped)`,
        };
      });
      if (await consider(reading, ev)) return reading;
    }
  }
  return best?.reading ?? null;
}

/**
 * Releases worth trying a capture against: the ones the hash search matched,
 * then the most recent. A photo or screenshot rarely hashes close to the file
 * it shows, so recency is what keeps the search short.
 */
const CAPTURE_CANDIDATES = 12;

async function recoverCapture(buffer, candidates, cache = traceCache()) {
  const recent = await prisma.decryptionEvent.findMany({
    where: TRACEABLE_RELEASE,
    orderBy: { createdAt: 'desc' },
    take: CAPTURE_CANDIDATES,
    select: { id: true },
  });
  const ids = [
    ...new Set([...visualMatches(candidates).map((c) => c.id), ...recent.map((e) => e.id)]),
  ];
  const events = await prisma.decryptionEvent.findMany({
    where: { id: { in: ids }, ...TRACEABLE_RELEASE },
    select: { id: true, markedPath: true, payloadBits: true, deltaUsed: true },
  });
  // One place per picture — an image, or a page of a PDF — keyed by its
  // position, since the pages of one PDF share a release.
  const releases = [];
  for (const id of ids) {
    const ev = events.find((e) => e.id === id);
    for (const view of ev ? await cache.views(ev) : []) {
      if (releases.length >= CAPTURE_CANDIDATES) break;
      releases.push({
        id: releases.length,
        eventId: ev.id,
        page: view.page,
        payloadBits: ev.payloadBits,
        deltaUsed: ev.deltaUsed,
        buffer: view.buffer,
      });
    }
    if (releases.length >= CAPTURE_CANDIDATES) break;
  }
  if (!releases.length) return null;
  const found = await recoverFromCapture(buffer, releases, {
    minBits: MIN_BITS_WITH_VISUAL_MATCH,
  });
  if (!found) return null;
  // How alike the captured region and the same region of the release look —
  // the visual evidence, measured on the part of the page actually captured.
  const rel = releases[found.releaseId];
  const v = found.visible;
  const region = { left: v.x0, top: v.y0, width: v.x1 - v.x0, height: v.y1 - v.y0 };
  const [seen, ref] = await Promise.all([
    hashes(await sharp(found.canvas).extract(region).png().toBuffer()),
    hashes(await sharp(rel.buffer).extract(region).png().toBuffer()),
  ]);
  return {
    ...found,
    releaseId: rel.eventId,
    page: rel.page,
    dists: {
      pHashDist: hamming(seen.pHash, ref.pHash),
      dHashDist: hamming(seen.dHash, ref.dHash),
      aHashDist: hamming(seen.aHash, ref.aHash),
    },
  };
}

/**
 * Run the optical lens on an uploaded photo. Corners come from the examiner
 * (dragged on the Trace page) or, failing that, from automatic detection.
 */
async function applyLens(buffer, cornersField) {
  let corners = null;
  let autoDetected = false;
  if (cornersField) {
    try {
      const parsed = JSON.parse(cornersField);
      if (
        Array.isArray(parsed) &&
        parsed.length === 4 &&
        parsed.every((p) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
      ) {
        corners = parsed.map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
      }
    } catch {
      throw badInput('corners must be a JSON array of four {x, y} points.');
    }
  }
  if (!corners) {
    const found = await detectQuad(buffer);
    if (found) {
      corners = found.corners;
      autoDetected = true;
    }
  }
  if (!corners) {
    return {
      applied: false,
      reason: 'The document’s corners could not be found automatically; place them by hand.',
    };
  }
  const flat = await dewarp(buffer, corners);
  const clean = await removeMoire(flat.buffer);
  const preview = await sharp(clean.buffer)
    .resize({ width: 640, withoutEnlargement: true })
    .jpeg({ quality: 80 })
    .toBuffer();
  return {
    applied: true,
    buffer: clean.buffer,
    autoDetected,
    corners,
    size: { width: flat.width, height: flat.height },
    moirePeaks: clean.peaks,
    preview: `data:image/jpeg;base64,${preview.toString('base64')}`,
  };
}

/** Corner detection alone, so the Trace page can place its handles. */
router.post('/lens/detect', requireCap('trace:run'), singleFile, async (req, res, next) => {
  try {
    if (!req.file) throw badInput('No file uploaded. Send multipart field "file".');
    const meta = await sharp(req.file.buffer).rotate().metadata();
    const found = await detectQuad(req.file.buffer);
    res.json({
      width: meta.width,
      height: meta.height,
      corners: found?.corners ?? null,
      coverage: found?.coverage ?? null,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireCap('trace:run'), singleFile, async (req, res, next) => {
  const startedAt = Date.now();
  const cache = traceCache();
  try {
    if (!req.file) throw badInput('No file uploaded. Send multipart field "file".');

    const buffer = req.file.buffer;
    const isDocPdf = req.file.mimetype === 'application/pdf' || isPdf(buffer);

    // --- 1. Optical lens: a photo of a screen becomes a flat, clean page ----
    // The corrected image feeds the search and the watermark read; the file as
    // uploaded is what the custody hash and the tamper check are made on.
    const lensMode = String(req.body?.lensMode ?? '').toLowerCase();
    const wantsLens =
      (/^(1|true|on|screen)$/i.test(String(req.body?.lens ?? '')) || lensMode === 'screen') &&
      !isDocPdf;
    const disableLens =
      /^(0|false|off|none|standard)$/i.test(String(req.body?.lens ?? '')) ||
      lensMode === 'standard' ||
      lensMode === 'none';

    let leak = buffer;
    let lens = null;
    // Corners placed by hand are always used. Without them the lens is a guess,
    // and a clean digital copy it crops can lose its mark — so a file whose
    // mark already reads as uploaded is taken as it is.
    const handCorners = Boolean(String(req.body?.corners ?? '').trim());
    const readsAsIs =
      wantsLens &&
      !handCorners &&
      (await namesARelease((await extract(buffer, env.watermarkDelta)).payloadBits));
    if (wantsLens && !readsAsIs) {
      lens = await applyLens(buffer, req.body?.corners);
      if (lens.applied) leak = lens.buffer;
    }

    // --- 2. Perceptual hashes of the leaked file ---------------------------
    let leaked;
    if (isDocPdf) {
      const pdfHash = BigInt('0x' + sha256(buffer).toString('hex').slice(0, 16));
      leaked = { pHash: pdfHash, dHash: pdfHash, aHash: pdfHash };
    } else {
      leaked = await hashes(leak);
    }

    // --- 3. BK-tree OR-vote across dHash / pHash / aHash -------------------
    let { candidates, checked } = bktree.searchAll(leaked, env.bktreeMaxDist);
    if (!candidates.length) {
      // Camera screen captures, smartphone photos, and heavy glare frequently shift
      // perceptual hashes by 14-28 bits. Multi-stage expansion ensures candidate recovery.
      const relaxed = bktree.searchAll(leaked, Math.max(env.bktreeMaxDist, 28));
      if (relaxed.candidates.length) {
        candidates = relaxed.candidates;
        checked += relaxed.checked;
      } else {
        const wide = bktree.searchAll(leaked, 34);
        if (wide.candidates.length) {
          candidates = wide.candidates;
          checked += wide.checked;
        }
      }
    }

    // --- 4. Pull the 48 bits back out of the document or pixels ------------
    let marked;
    let capture = null;
    if (isDocPdf) {
      marked = (await extractPdf(buffer)) || {
        payloadBits: '0'.repeat(PAYLOAD_BITS),
        bitConfidence: 0,
        eccCorrected: false,
      };
    } else {
      marked = await extract(leak, env.watermarkDelta);
      // A leak that was scaled and left at the new size no longer lines up with
      // the grid the mark was embedded on. The hashes still find the document,
      // so scale the leak back to each candidate's released size and read again.
      // With no hash match, recent releases are tried instead (see above).
      if (!(await namesARelease(marked.payloadBits))) {
        const rescaled = await optionalStep('rescaled read', () =>
          extractAtCandidateSizes(leak, candidates, {
            cache,
            tones: Boolean(lens?.applied),
          })
        );
        if (rescaled) marked = rescaled;

        // Auto-Lens fallback: if user uploaded a phone camera capture directly
        // without specifying manual corners, automatically rectify perspective & notch moiré.
        if (!disableLens && !(await namesARelease(marked.payloadBits)) && !lens?.applied) {
          try {
            const autoLens = await applyLens(buffer);
            if (autoLens.applied) {
              lens = autoLens;
              leak = autoLens.buffer;
              const dewarpedHashes = await hashes(leak);
              const dewarpedSearch = bktree.searchAll(dewarpedHashes, 28);
              if (dewarpedSearch.candidates.length) {
                candidates = dewarpedSearch.candidates;
                checked += dewarpedSearch.checked;
              }
              let lensExtract = await extract(leak);
              for (const altDelta of [16, 14]) {
                if (await namesARelease(lensExtract.payloadBits)) break;
                try {
                  const alt = await extract(leak, altDelta, { multiOrientation: false });
                  if (await namesARelease(alt.payloadBits)) {
                    lensExtract = alt;
                    break;
                  }
                  if (alt.bitConfidence > lensExtract.bitConfidence) {
                    lensExtract = alt;
                  }
                } catch {
                  // this delta did not read; try the next
                }
              }
              if (await namesARelease(lensExtract.payloadBits)) {
                marked = lensExtract;
              } else {
                const lensRescaled = await extractAtCandidateSizes(leak, candidates, {
                  cache,
                  tones: true,
                });
                if (lensRescaled) marked = lensRescaled;
                else if (lensExtract) marked = lensExtract;
              }
            }
          } catch (err) {
            // auto-lens found no screen; keep the reading already made
            console.warn('[trace] auto-lens skipped:', err?.message || err);
          }
        }
      }
      // Still nothing: the page may be only part of the upload — a phone
      // photo of a screen, a screenshot with the viewer around it, a crop.
      if (!(await readingIdentifies(marked.payloadBits))) {
        capture = await optionalStep('capture recovery', () =>
          recoverCapture(leak, candidates, cache)
        );
        if (capture) marked = capture.reading;
      }
    }

    // --- 5. shortId -> the exact DecryptionEvent (O(1) on a unique index) --
    let event = null;
    let crcOk = false;
    try {
      const parsed = parsePayload(marked.payloadBits);
      crcOk = parsed.crcOk;
      if (parsed.crcOk) {
        event = await prisma.decryptionEvent.findUnique({
          where: { shortId: parsed.shortId },
          include: { asset: true, user: true },
        });
      }
    } catch {
      // A malformed payload is a signal, not a crash. It just lowers the score.
    }

    // Fall back to candidate search across all recent decryptions (or BK-tree candidates)
    // when CRC fails due to compression noise or screenshot borders.
    const allRecentEvents = await prisma.decryptionEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { asset: true, user: true },
    });

    // Merge BK-tree candidates and recent decryption events
    const poolMap = new Map();
    for (const ev of allRecentEvents) poolMap.set(ev.id, ev);
    if (candidates.length) {
      const bktreeEvents = await prisma.decryptionEvent.findMany({
        where: { id: { in: candidates.map((c) => c.id) } },
        include: { asset: true, user: true },
      });
      for (const ev of bktreeEvents) poolMap.set(ev.id, ev);
    }

    const candidatePool = Array.from(poolMap.values());
    const rankedCandidates = candidatePool
      .map((ev) => {
        const matches = bitsMatching(marked.payloadBits, ev.payloadBits);
        return {
          event: ev,
          matches,
          agreement: matches / PAYLOAD_BITS,
        };
      })
      .sort((a, b) => b.matches - a.matches);

    // No valid CRC: accept candidate if agreement exceeds noise threshold.
    // No valid CRC: accept candidate ONLY if agreement exceeds noise threshold,
    // is not degenerate noise, and has a decisive lead over runner-up suspects.
    if (!event && rankedCandidates.length > 0) {
      const top = rankedCandidates[0];
      // The rival suspect to compare against must be a DIFFERENT officer (not another copy downloaded by the same officer)
      const runnerUp = rankedCandidates.find((c) => c.event.userId !== top.event.userId);
      const margin = runnerUp ? top.matches - runnerUp.matches : top.matches;
      const isDegenerate = isDegeneratePayload(marked.payloadBits);

      // How alike the upload and the top release look: from the capture that
      // found it, else the hash search, else measured directly.
      const listed = candidates.find((c) => c.id === top.event.id);
      const visualDist =
        capture && capture.releaseId === top.event.id
          ? capture.dists.pHashDist
          : listed?.pHashDist != null
            ? listed.pHashDist
            : top.event.pHash != null
              ? hamming(leaked.pHash, top.event.pHash)
              : 64;

      // Distinguishing BETWEEN recipients of the SAME broadcast document requires
      // statistical watermark significance (MIN_BITS_WITHOUT_CRC, or fewer bits
      // when the upload visibly is that release) and a clear lead over every
      // other officer (MIN_LEAD_BITS) — a wrong name is the expensive failure.
      const significant =
        top.matches >= MIN_BITS_WITHOUT_CRC ||
        (top.matches >= MIN_BITS_WITH_VISUAL_MATCH && visualDist <= MAX_VISUAL_PHASH_DIST);
      if (!isDegenerate && significant && margin >= MIN_LEAD_BITS) {
        event = top.event;
      }
    }

    // Traitor tracing: how the named officer's copy compares with the
    // closest copy released to anyone else. Chance agreement is about 24/48.
    let traitor = null;
    if (event) {
      const rival = rankedCandidates.find((c) => c.event.userId !== event.userId);
      traitor = {
        namedBits: bitsMatching(marked.payloadBits, event.payloadBits),
        rival: rival ? { userName: rival.event.user.name, bits: rival.matches } : null,
        officersCompared: new Set(rankedCandidates.map((c) => c.event.userId)).size,
        totalBits: PAYLOAD_BITS,
      };
    }

    // Build Suspect Pool (शक का दायरा) ranking top candidate officers
    const suspects = rankedCandidates.slice(0, 5).map((c, idx) => ({
      rank: idx + 1,
      userId: c.event.user.id,
      userName: c.event.user.name,
      department: c.event.user.dept,
      deviceLabel: c.event.deviceLabel,
      assetTitle: c.event.asset.title,
      decryptedAt: c.event.createdAt.toISOString(),
      bitsMatched: c.matches,
      totalBits: PAYLOAD_BITS,
      bitMatchPct: Math.round(c.agreement * 100),
      suspicionLevel: c.matches >= 34 ? 'HIGH' : c.matches >= 26 ? 'MEDIUM' : 'LOW',
      txHash: c.event.txHash ? bufferToHex(c.event.txHash) : null,
    }));

    // --- Distances between the leaked file and the candidate we settled on --
    const cand = event ? candidates.find((c) => c.id === event.id) : null;
    const dists =
      capture && event?.id === capture.releaseId
        ? capture.dists
        : {
            pHashDist: cand?.pHashDist ?? (event ? hamming(leaked.pHash, event.pHash) : 64),
            dHashDist:
              cand?.dHashDist ?? (event?.dHash != null ? hamming(leaked.dHash, event.dHash) : 64),
            aHashDist:
              cand?.aHashDist ?? (event?.aHash != null ? hamming(leaked.aHash, event.aHash) : 64),
          };

    // --- 6. Cross-check the chain. Never throws — an unreachable RPC just
    //        means `chainVerified: false`, which lowers confidence. ----------
    const chainCheck = event
      ? await chain.getReceipt(bufferToHex(event.receiptId))
      : { verified: false };

    // --- 7. Confidence -> band -> reasons ----------------------------------
    // Prefer a direct comparison against the bits we know we embedded; fall back
    // to the extractor’s own confidence when there is no candidate at all.
    // With no receipt identified there is nothing for the bits to agree with:
    // the extractor's confidence in its own reading is not evidence about anyone.
    const agreement = event ? bitAgreement(marked.payloadBits, event.payloadBits) : 0;

    const verdictResult = score({
      bitConfidence: agreement,
      pHashDist: dists.pHashDist,
      dHashDist: dists.dHashDist,
      aHashDist: dists.aHashDist,
      chainVerified: event ? chainCheck.verified : null,
    });

    const reasons = [...verdictResult.reasons];
    let signatureVerified = false;

    if (event) {
      const n = bitsMatching(marked.payloadBits, event.payloadBits);
      reasons.unshift(
        `${n}/${PAYLOAD_BITS} watermark bits match receipt ${bufferToHex(event.receiptId).slice(0, 10)}…` +
          (marked.eccCorrected ? ' (corrected by Reed-Solomon)' : '')
      );
      if (marked.rescaledTo) {
        reasons.push(
          `Leak had been resized — rescaled to the released ${marked.rescaledTo} before reading the mark.`
        );
      }
      if (marked.rotationAngle) {
        reasons.push(
          `Geometric orientation compensation: recovered successfully from ${marked.rotationAngle}° rotation.`
        );
      }
      if (!crcOk) reasons.push('Payload CRC failed — the extracted bits are unreliable.');

      // --- 7.2 Non-repudiation verification: ML-DSA-65 signature check ------
      if (event.decryptionSignature && event.user?.dsaPublicKey) {
        try {
          const receiptDigest = sha256(
            Buffer.concat([Buffer.from(event.receiptId), Buffer.from(event.user.userRef)])
          );
          signatureVerified = verifyDecryptionSignature(
            event.decryptionSignature,
            receiptDigest,
            event.user.dsaPublicKey
          );
          if (signatureVerified) {
            reasons.push(
              `NIST ML-DSA-65 post-quantum digital signature verified — non-repudiation proof confirmed for ${event.user.name}.`
            );
          }
        } catch (sigErr) {
          console.warn('ML-DSA-65 verification error:', sigErr.message);
        }
      }
    } else if (visualMatches(candidates).length) {
      const seen = visualMatches(candidates);
      const best = Math.min(...seen.map((c) => c.pHashDist));
      reasons.unshift(
        `Visually matches ${seen.length} released cop${seen.length === 1 ? 'y' : 'ies'} in the register (pHash distance ${best}/64), but the watermark could not be recovered, so the recipient cannot be named.`
      );
    } else {
      reasons.unshift('No candidate file in the register resembled this upload.');
    }

    // --- 7.3 Tamper check: the fragile layer, on the file exactly as uploaded --
    let tamper = null;
    if (event && !isDocPdf) {
      if (capture && event.id === capture.releaseId) {
        tamper = {
          status: 'unassessable',
          reason:
            'A photo or screenshot re-renders every pixel, so the copy cannot be checked for edits.',
        };
      } else if (!event.fragileLayer) {
        tamper = {
          status: 'unassessable',
          reason:
            'This release predates the fragile layer, so its contents cannot be checked for edits.',
        };
      } else {
        const [copy] = await cache.views(event);
        const released = copy ? { width: copy.width, height: copy.height } : null;
        tamper = await verifyFragile(buffer, bufferToHex(event.receiptId), released);
      }
      reasons.push(
        tamper.status === 'intact'
          ? 'Fragile layer intact — the copy has not been altered since release.'
          : tamper.status === 'tampered'
            ? `Fragile layer broken in ${tamper.regions.length} region(s) — the copy was ALTERED after release.`
            : 'Fragile layer not assessable — contents cannot be checked for edits.'
      );
    }
    if (capture && event?.id === capture.releaseId) {
      reasons.push(
        `${capture.method === 'quad' ? 'Photo of a screen' : 'Screenshot or crop'} recognised: ${capture.page ? `page ${capture.page} of the released PDF` : 'the released page'} was found inside the upload at ${Math.round(capture.fit.scale * 100)}% scale, ${Math.round(capture.visibleShare * 100)}% of it in view, and the mark read from that part alone.`
      );
    }
    if (lens?.applied) {
      reasons.push(
        `Optical lens applied: ${lens.autoDetected ? 'auto-detected' : 'examiner-placed'} corners, perspective corrected to ${lens.size.width}x${lens.size.height}, ${lens.moirePeaks} moire peak(s) removed.`
      );
    }
    const bitsMatched = event ? bitsMatching(marked.payloadBits, event.payloadBits) : null;

    const elapsedMs = Date.now() - startedAt;

    // --- 8. Persist the investigation --------------------------------------
    // Only a release the evidence actually identified is linked. Linking the
    // nearest candidate, or the latest release, would put a name on a report
    // that the verdict does not support.
    const targetEvent = event;
    const investigation = await prisma.investigation.create({
      data: {
        uploadedSha: sha256(buffer),
        candidates: candidates.length,
        topReceiptId: targetEvent?.receiptId ?? null,
        confidence: verdictResult.score,
        verdict: verdictResult.verdict,
        reasons,
        elapsedMs,
        bitsMatched,
        // The heatmap image is returned to the examiner, not stored; the
        // regions are what the dossier cites.
        tamper: tamper ? { ...tamper, heatmap: undefined } : undefined,
        lens: lens ? { ...lens, buffer: undefined, preview: undefined } : undefined,
      },
    });

    // --- 9. A name is returned ONLY for ATTRIBUTED or PROBABLE (>= 60%) -------
    const showMatch =
      (verdictResult.verdict === 'ATTRIBUTED' || verdictResult.verdict === 'PROBABLE') && event;
    const txHashHex = event ? bufferToHex(event.txHash) : null;

    res.json({
      investigationId: investigation.id,
      verdict: verdictResult.verdict,
      confidence: verdictResult.score,
      match: showMatch
        ? {
            userId: event.user.id,
            userName: event.user.name,
            department: event.user.dept,
            assetId: event.asset.id,
            assetTitle: event.asset.title,
            eventId: event.id,
            receiptId: bufferToHex(event.receiptId),
            bitsMatched,
            decryptedAt: event.createdAt.toISOString(),
            deviceLabel: event.deviceLabel,
            txHash: txHashHex,
            etherscanUrl: chain.buildEtherscanUrl(txHashHex),
            pqcProof: {
              algorithm: event.signatureAlgorithm || 'ML-DSA-65',
              signatureVerified,
              signatureCommit: event.signatureCommit ? bufferToHex(event.signatureCommit) : null,
              signatureHex: event.decryptionSignature
                ? bufferToHex(event.decryptionSignature).slice(0, 66) + '…'
                : null,
              publicKeyHex: event.user.dsaPublicKey
                ? bufferToHex(event.user.dsaPublicKey).slice(0, 66) + '…'
                : null,
              nonRepudiation: signatureVerified,
            },
          }
        : null,
      suspects: suspects,
      traitor,
      reasons,
      tamper,
      lens: lens ? { ...lens, buffer: undefined } : null,
      capture:
        capture && event?.id === capture.releaseId
          ? {
              method: capture.method,
              scale: Math.round(capture.fit.scale * 1000) / 1000,
              visibleShare: capture.visibleShare,
              corners: capture.corners,
            }
          : null,
      candidatesChecked: checked || candidates.length || allRecentEvents.length,
      elapsedMs,
    });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------- GET /api/trace/investigations ----
/** Investigation history — nice-to-have for the dashboard, cheap to serve. */
router.get('/investigations', requireCap('trace:history'), async (_req, res, next) => {
  try {
    const rows = await prisma.investigation.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json({
      investigations: rows.map((i) => ({
        investigationId: i.id,
        verdict: i.verdict,
        confidence: i.confidence,
        candidatesChecked: i.candidates,
        reasons: i.reasons,
        elapsedMs: i.elapsedMs,
        createdAt: i.createdAt.toISOString(),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------- GET /api/trace/:investigationId/dossier -
router.get('/:investigationId/dossier', requireCap('trace:run'), async (req, res, next) => {
  try {
    const invId = Number(req.params.investigationId);
    if (!Number.isInteger(invId) || invId <= 0) {
      throw badInput('Invalid investigationId');
    }

    const investigation = await prisma.investigation.findUnique({
      where: { id: invId },
    });

    if (!investigation) {
      return res.status(404).json({ error: { message: 'Investigation record not found' } });
    }

    let event = null;
    if (investigation.topReceiptId) {
      event = await prisma.decryptionEvent.findUnique({
        where: { receiptId: investigation.topReceiptId },
        include: { user: true, asset: true },
      });
    }

    const txHash = event?.txHash ? bufferToHex(event.txHash) : null;
    const blockNumber = event?.blockNumber != null ? Number(event.blockNumber) : null;
    const sigCommit = event?.signatureCommit ? bufferToHex(event.signatureCommit) : null;

    // What the report may say about the chain is looked up, not assumed.
    const onChain = event ? await chain.getReceipt(bufferToHex(event.receiptId)) : null;
    const hex = (b) => (b ? Buffer.from(b).toString('hex') : null);

    // The evidence this dossier asserts, in a fixed order. Its SHA-256 is what
    // the examiner signs, and what the verify endpoint checks later.
    const generatedAt = new Date().toISOString();
    const evidence = {
      investigationId: investigation.id,
      generatedAt,
      verdict: investigation.verdict,
      confidence: investigation.confidence,
      bitsMatched: investigation.bitsMatched ?? null,
      leakSha: hex(investigation.uploadedSha),
      originalSha: hex(event?.asset?.originalSha),
      releasedSha: hex(event?.contentSha),
      receiptId: event ? bufferToHex(event.receiptId) : null,
      txHash,
      blockNumber,
      blockTimestamp: onChain?.receipt?.timestamp ?? null,
      contractAddress: chain.chainConfig().address || null,
      chainVerified: Boolean(onChain?.verified),
      tamper: investigation.tamper?.status ?? null,
      lensApplied: Boolean(investigation.lens?.applied),
      examinerId: req.user.id,
    };
    const digest = evidenceDigest(evidence);

    // Examiner's stamp: their own ML-DSA-65 key signs the evidence digest.
    const examinerRow = await prisma.user.findUnique({ where: { id: req.user.id } });
    const examinerKeys = userKeys(examinerRow);
    let stamp = null;
    if (examinerKeys?.dsaSecretKey && examinerRow.dsaPublicKey) {
      const signature = Buffer.from(
        signDecryptionReceipt(Buffer.from(digest, 'hex'), examinerKeys.dsaSecretKey)
      );
      stamp = {
        digest,
        signature: signature.toString('hex'),
        signatureSha: sha256(signature).toString('hex'),
        publicKey: Buffer.from(examinerRow.dsaPublicKey).toString('hex'),
        publicKeySha: sha256(Buffer.from(examinerRow.dsaPublicKey)).toString('hex'),
        examiner: { id: examinerRow.id, name: examinerRow.name, role: examinerRow.role },
        evidence,
      };
      await prisma.investigation.update({
        where: { id: investigation.id },
        data: {
          stamps: [...(Array.isArray(investigation.stamps) ? investigation.stamps : []), stamp],
        },
      });
    }

    const pdfBuffer = await generateDossier({
      investigation,
      event,
      verdict: investigation.verdict,
      confidence: investigation.confidence,
      reasons: investigation.reasons || [],
      txHash,
      blockNumber,
      signatureCommit: sigCommit,
      signatureAlgorithm: event?.signatureAlgorithm || null,
      // What the report may say about the chain is looked up, not assumed.
      chainMode: chain.chainConfig().mode,
      contractAddress: chain.chainConfig().address || null,
      chainVerified: Boolean(onChain?.verified),
      blockTimestamp: evidence.blockTimestamp,
      bitsMatched: investigation.bitsMatched,
      tamper: investigation.tamper,
      lens: investigation.lens,
      custody: {
        originalSha: evidence.originalSha,
        releasedSha: evidence.releasedSha,
        leakSha: evidence.leakSha,
        evidenceDigest: digest,
      },
      examiner: { id: examinerRow.id, name: examinerRow.name, role: examinerRow.role },
      stamp,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="forensic-dossier-INV-${String(invId).padStart(5, '0')}.pdf"`
    );
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

/**
 * Verify a dossier's examiner stamp: the evidence recorded when it was issued
 * hashes to the digest printed on it, and the ML-DSA-65 signature over that
 * digest checks against the examiner's public key.
 */
router.get(
  '/:investigationId/dossier/verify',
  requireCap('trace:history'),
  async (req, res, next) => {
    try {
      const invId = Number(req.params.investigationId);
      const digest = String(req.query.digest || '')
        .toLowerCase()
        .replace(/^sha256:/, '');
      const inv = await prisma.investigation.findUnique({ where: { id: invId } });
      if (!inv)
        return res.status(404).json({ error: { message: 'Investigation record not found' } });
      const stamp = (Array.isArray(inv.stamps) ? inv.stamps : []).find(
        (s) => digest && s.digest.startsWith(digest)
      );
      if (!stamp)
        return res.json({
          valid: false,
          reason: 'No dossier with that digest was issued for this investigation.',
        });
      const recomputed = evidenceDigest(stamp.evidence);
      const signatureValid = verifyDecryptionSignature(
        Buffer.from(stamp.signature, 'hex'),
        Buffer.from(stamp.digest, 'hex'),
        Buffer.from(stamp.publicKey, 'hex')
      );
      const valid = recomputed === stamp.digest && signatureValid;
      res.json({
        valid,
        reason: valid
          ? `Signed by ${stamp.examiner.name} (${stamp.examiner.role}); the evidence and the signature both verify.`
          : recomputed !== stamp.digest
            ? 'The recorded evidence no longer hashes to the stamped digest.'
            : 'The ML-DSA-65 signature does not verify against the examiner key.',
        digest: stamp.digest,
        examiner: stamp.examiner,
        issuedAt: stamp.evidence.generatedAt,
        evidence: stamp.evidence,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
