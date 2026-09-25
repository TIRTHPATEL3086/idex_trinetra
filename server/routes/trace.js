import fs from 'node:fs/promises';
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
import { parsePayload, bitAgreement, bitsMatching, PAYLOAD_BITS, isDegeneratePayload } from '../core/payload.js';
import { signDecryptionReceipt, verifyDecryptionSignature } from '../core/pqc.js';
import { userKeys } from '../lib/keyring.js';
import { generateDossier } from '../core/dossier.js';
import { detectQuad, dewarp, removeMoire, matchTones } from '../core/lens.js';
import { verifyFragile } from '../core/fragile.js';

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
 * land at 43-48. At 30, comparing a blank or unrelated image against the ~50
 * recent releases routinely found one at 31 by luck and named its recipient.
 * 40/48 happens by chance about once in a million comparisons.
 */
const MIN_BITS_WITHOUT_CRC = 34;

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
 * Re-read the mark after scaling the leak back to the size of each copy the
 * hash search matched. A rescaled reading is rarely bit-perfect, so it is kept
 * when it agrees with that copy's own payload well beyond chance.
 *
 * Falls back to recent decryption events if the phone photo's pHash was skewed
 * by perspective, screen moiré, or lighting glare.
 *
 * @returns the best such reading, or null
 */
async function extractAtCandidateSizes(buffer, candidates, { tones = false } = {}) {
  let matchedIds = visualMatches(candidates).map((c) => c.id);
  if (!matchedIds.length) {
    const recent = await prisma.decryptionEvent.findMany({
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { id: true },
    });
    matchedIds = recent.map((r) => r.id);
  }

  const events = await prisma.decryptionEvent.findMany({
    where: { id: { in: matchedIds } },
    select: { id: true, markedPath: true, payloadBits: true },
  });
  const readings = new Map();
  let best = null;

  for (const ev of events) {
    let size;
    try {
      size = await sharp(ev.markedPath).metadata();
    } catch {
      continue;
    }
    const dims = `${size.width}x${size.height}`;

    // Pass 1: standard alignment to candidate dimensions across adaptive QIM deltas
    for (const d of [12, 16, 14]) {
      const readKey = `${dims}@${d}`;
      if (!readings.has(readKey)) {
        try {
          const aligned = await sharp(buffer)
            .resize(size.width, size.height, { fit: 'fill' })
            .png()
            .toBuffer();
          const reading = await extract(aligned, d);
          readings.set(readKey, { ...reading, rescaledTo: `${dims} px` });
        } catch {}
      }

      const reading = readings.get(readKey);
      if (reading && !isDegeneratePayload(reading.payloadBits)) {
        if (await namesARelease(reading.payloadBits)) {
          return reading;
        }
        const matches = bitsMatching(reading.payloadBits, ev.payloadBits);
        if (matches >= MIN_BITS_WITHOUT_CRC && (!best || matches > best.matches)) {
          best = { reading, matches };
        }
      }
    }

    // Pass 2: tone-matched alignment to counteract camera glare & screen exposure
    const toneKey = `${dims}#${ev.markedPath}`;
    if (!readings.has(toneKey)) {
      try {
        const rawAligned = await sharp(buffer)
          .resize(size.width, size.height, { fit: 'fill' })
          .png()
          .toBuffer();
        const refBytes = await fs.readFile(ev.markedPath);
        const toneAligned = await matchTones(rawAligned, refBytes);
        const toneReading = await extract(toneAligned);
        readings.set(toneKey, { ...toneReading, rescaledTo: `${dims} px (tones matched)` });
      } catch {}
    }

    const toneReading = readings.get(toneKey);
    if (toneReading && !isDegeneratePayload(toneReading.payloadBits)) {
      if (await namesARelease(toneReading.payloadBits)) {
        return toneReading;
      }
      const matches = bitsMatching(toneReading.payloadBits, ev.payloadBits);
      if (matches >= MIN_BITS_WITHOUT_CRC && (!best || matches > best.matches)) {
        best = { reading: toneReading, matches };
      }
    }

    // Pass 3 (Auto Keyboard Clipper): If uploaded frame is tall/portrait but candidate is landscape,
    // test the upper 55% screen region (automatically slices off the laptop keyboard/touchpad).
    const bufMeta = await sharp(buffer).metadata();
    const isTall = (bufMeta.height || 0) > (bufMeta.width || 0) * 0.85;
    if (isTall && size.width > size.height) {
      const screenH = Math.round(bufMeta.height * 0.55);
      const topScreenKey = `${dims}#topScreen`;
      if (!readings.has(topScreenKey)) {
        try {
          const topCrop = await sharp(buffer)
            .extract({ left: 0, top: 0, width: bufMeta.width, height: screenH })
            .resize(size.width, size.height, { fit: 'fill' })
            .png()
            .toBuffer();
          const topReading = await extract(topCrop);
          readings.set(topScreenKey, { ...topReading, rescaledTo: `${dims} px (keyboard clipped)` });
        } catch {}
      }
      const topReading = readings.get(topScreenKey);
      if (topReading && !isDegeneratePayload(topReading.payloadBits)) {
        if (await namesARelease(topReading.payloadBits)) {
          return topReading;
        }
        const matches = bitsMatching(topReading.payloadBits, ev.payloadBits);
        if (matches >= MIN_BITS_WITHOUT_CRC && (!best || matches > best.matches)) {
          best = { reading: topReading, matches };
        }
      }
    }
  }
  return best?.reading ?? null;
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
  try {
    if (!req.file) throw badInput('No file uploaded. Send multipart field "file".');

    const buffer = req.file.buffer;
    const isDocPdf = req.file.mimetype === 'application/pdf' || isPdf(buffer);

    // --- 1. Optical lens: a photo of a screen becomes a flat, clean page ----
    // The corrected image feeds the search and the watermark read; the file as
    // uploaded is what the custody hash and the tamper check are made on.
    const wantsLens = /^(1|true|on)$/i.test(String(req.body?.lens ?? ''));
    let leak = buffer;
    let lens = null;
    if (wantsLens && !isDocPdf) {
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
    if (isDocPdf) {
      marked = (await extractPdf(buffer)) || {
        payloadBits: '0'.repeat(PAYLOAD_BITS),
        bitConfidence: 0,
        eccCorrected: false,
      };
    } else {
      marked = await extract(leak);
      // If direct extract did not yield a verified release, attempt candidate-size
      // alignment using BK-tree candidates OR recent releases.
      if (!(await namesARelease(marked.payloadBits))) {
        const rescaled = await extractAtCandidateSizes(leak, candidates, {
          tones: Boolean(lens?.applied),
        });
        if (rescaled) marked = rescaled;

        // Auto-Lens fallback: if user uploaded a phone camera capture directly
        // without specifying manual corners, automatically rectify perspective & notch moiré.
        if (!(await namesARelease(marked.payloadBits)) && !lens?.applied) {
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
              const lensExtract = await extract(leak);
              if (await namesARelease(lensExtract.payloadBits)) {
                marked = lensExtract;
              } else {
                const lensRescaled = await extractAtCandidateSizes(leak, candidates, { tones: true });
                if (lensRescaled) marked = lensRescaled;
              }
            }
          } catch {}
        }
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
      const runnerUp = rankedCandidates[1];
      const margin = runnerUp ? top.matches - runnerUp.matches : top.matches;
      const isDegenerate = isDegeneratePayload(marked.payloadBits);

      // Distinguishing BETWEEN recipients of the SAME broadcast document requires
      // watermark statistical significance (at least MIN_BITS_WITHOUT_CRC = 34 bits).
      // A tie or degenerate reading must NEVER arbitrarily accuse an innocent officer.
      if (!isDegenerate && top.matches >= MIN_BITS_WITHOUT_CRC && margin >= 2) {
        event = top.event;
      }
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
    const dists = {
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
      if (!event.fragileLayer) {
        tamper = {
          status: 'unassessable',
          reason:
            'This release predates the fragile layer, so its contents cannot be checked for edits.',
        };
      } else {
        let released = null;
        try {
          const m = await sharp(event.markedPath).metadata();
          released = { width: m.width, height: m.height };
        } catch {
          // The released copy is not on disk; verify against the upload's own size.
        }
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
      reasons,
      tamper,
      lens: lens ? { ...lens, buffer: undefined } : null,
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
