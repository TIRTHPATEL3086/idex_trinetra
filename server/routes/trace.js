import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { badInput } from '../lib/errors.js';
import { bufferToHex } from '../lib/refs.js';
import { singleFile } from '../middleware/upload.js';
import * as chain from '../core/chain.js';
import * as bktree from '../core/bktree.js';
import { hashes, extract, score, sha256, hamming } from '../core/index.js';
import { parsePayload, bitAgreement, bitsMatching, PAYLOAD_BITS } from '../core/payload.js';

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

router.post('/', singleFile, async (req, res, next) => {
  const startedAt = Date.now();
  try {
    if (!req.file) throw badInput('No file uploaded. Send multipart field "file".');

    const buffer = req.file.buffer;

    // --- 2. Perceptual hashes of the leaked file ---------------------------
    const leaked = await hashes(buffer);

    // --- 3. BK-tree OR-vote across dHash / pHash / aHash -------------------
    const { candidates, checked } = bktree.searchAll(leaked, env.bktreeMaxDist);

    // --- 4. Pull the 48 bits back out of the pixels ------------------------
    const marked = await extract(buffer);

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

    // Fall back to the nearest perceptual-hash candidate when the watermark
    // was destroyed — this is what catches screenshots and heavy re-encodes.
    if (!event && candidates.length) {
      event = await prisma.decryptionEvent.findUnique({
        where: { id: candidates[0].id },
        include: { asset: true, user: true },
      });
    }

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
    const agreement = event
      ? bitAgreement(marked.payloadBits, event.payloadBits)
      : (marked.bitConfidence ?? 0);

    const verdictResult = score({
      bitConfidence: agreement,
      pHashDist: dists.pHashDist,
      dHashDist: dists.dHashDist,
      aHashDist: dists.aHashDist,
      chainVerified: chainCheck.verified,
    });

    const reasons = [...verdictResult.reasons];
    if (event) {
      const n = bitsMatching(marked.payloadBits, event.payloadBits);
      reasons.unshift(
        `${n}/${PAYLOAD_BITS} watermark bits match receipt ${bufferToHex(event.receiptId).slice(0, 10)}…` +
          (marked.eccCorrected ? ' (corrected by Reed-Solomon)' : '')
      );
      if (!crcOk) reasons.push('Payload CRC failed — the extracted bits are unreliable.');
    } else {
      reasons.unshift('No candidate file in the register resembled this upload.');
    }

    const elapsedMs = Date.now() - startedAt;

    // --- 8. Persist the investigation --------------------------------------
    const investigation = await prisma.investigation.create({
      data: {
        uploadedSha: sha256(buffer),
        candidates: candidates.length,
        topReceiptId: event?.receiptId ?? null,
        confidence: verdictResult.score,
        verdict: verdictResult.verdict,
        reasons,
        elapsedMs,
      },
    });

    // --- 9. A name is returned ONLY above the INCONCLUSIVE threshold -------
    const showMatch = verdictResult.verdict !== 'INCONCLUSIVE' && event;
    const txHashHex = event ? bufferToHex(event.txHash) : null;

    res.json({
      investigationId: investigation.id,
      verdict: verdictResult.verdict,
      confidence: verdictResult.score,
      match: showMatch
        ? {
            userName: event.user.name,
            department: event.user.dept,
            assetTitle: event.asset.title,
            decryptedAt: event.createdAt.toISOString(),
            deviceLabel: event.deviceLabel,
            txHash: txHashHex,
            etherscanUrl: chain.buildEtherscanUrl(txHashHex),
          }
        : null,
      reasons,
      candidatesChecked: checked || candidates.length,
      elapsedMs,
    });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------- GET /api/trace/investigations ----
/** Investigation history — nice-to-have for the dashboard, cheap to serve. */
router.get('/investigations', async (_req, res, next) => {
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

export default router;
