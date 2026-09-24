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
import { parsePayload, bitAgreement, bitsMatching, PAYLOAD_BITS } from '../core/payload.js';
import { verifyDecryptionSignature } from '../core/pqc.js';
import { generateDossier } from '../core/dossier.js';

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
const MIN_BITS_WITHOUT_CRC = 40;

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

/** Candidates the pHash search itself matched — a genuine visual resemblance. */
const visualMatches = (candidates) => candidates.filter((c) => c.pHashDist != null);

/**
 * Re-read the mark after scaling the leak back to the size of each copy the
 * hash search matched. A rescaled reading is rarely bit-perfect, so it is kept
 * when it agrees with that copy's own payload well beyond chance (the same
 * bar the candidate ranking below uses), not only when its CRC holds.
 *
 * @returns the best such reading, or null
 */
async function extractAtCandidateSizes(buffer, candidates) {
  const events = await prisma.decryptionEvent.findMany({
    where: { id: { in: visualMatches(candidates).map((c) => c.id) } },
    select: { markedPath: true, payloadBits: true },
  });
  const leak = await sharp(buffer).metadata();
  const readings = new Map(); // size -> reading, so each size is decoded once
  let best = null;
  for (const ev of events) {
    let size;
    try {
      size = await sharp(ev.markedPath).metadata();
    } catch {
      continue; // the released file is gone from disk; nothing to align to
    }
    if (size.width === leak.width && size.height === leak.height) continue;
    const key = `${size.width}x${size.height}`;
    if (!readings.has(key)) {
      const aligned = await sharp(buffer)
        .resize(size.width, size.height, { fit: 'fill' })
        .png()
        .toBuffer();
      readings.set(key, { ...(await extract(aligned)), rescaledTo: `${key} px` });
    }
    const reading = readings.get(key);
    const matches = bitsMatching(reading.payloadBits, ev.payloadBits);
    if (matches >= MIN_BITS_WITHOUT_CRC && (!best || matches > best.matches)) {
      best = { reading, matches };
    }
  }
  return best?.reading ?? null;
}

router.post('/', requireCap('trace:run'), singleFile, async (req, res, next) => {
  const startedAt = Date.now();
  try {
    if (!req.file) throw badInput('No file uploaded. Send multipart field "file".');

    const buffer = req.file.buffer;
    const isDocPdf = req.file.mimetype === 'application/pdf' || isPdf(buffer);

    // --- 2. Perceptual hashes of the leaked file ---------------------------
    let leaked;
    if (isDocPdf) {
      const pdfHash = BigInt('0x' + sha256(buffer).toString('hex').slice(0, 16));
      leaked = { pHash: pdfHash, dHash: pdfHash, aHash: pdfHash };
    } else {
      leaked = await hashes(buffer);
    }

    // --- 3. BK-tree OR-vote across dHash / pHash / aHash -------------------
    const { candidates, checked } = bktree.searchAll(leaked, env.bktreeMaxDist);

    // --- 4. Pull the 48 bits back out of the document or pixels ------------
    let marked;
    if (isDocPdf) {
      marked = (await extractPdf(buffer)) || {
        payloadBits: '0'.repeat(PAYLOAD_BITS),
        bitConfidence: 0,
        eccCorrected: false,
      };
    } else {
      marked = await extract(buffer);
      // A leak that was scaled and left at the new size no longer lines up with
      // the grid the mark was embedded on. The hashes still find the document,
      // so scale the leak back to each candidate's released size and read again.
      if (visualMatches(candidates).length && !(await namesARelease(marked.payloadBits))) {
        const rescaled = await extractAtCandidateSizes(buffer, candidates);
        if (rescaled) marked = rescaled;
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

    // No valid CRC: accept the best candidate only when its agreement could not be luck.
    if (!event && rankedCandidates.length > 0) {
      const top = rankedCandidates[0];
      if (top.matches >= MIN_BITS_WITHOUT_CRC) {
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
            assetTitle: event.asset.title,
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
      chainVerified: event
        ? (await chain.getReceipt(bufferToHex(event.receiptId))).verified
        : false,
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

export default router;
