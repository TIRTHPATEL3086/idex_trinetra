import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { env, masterKey } from '../lib/env.js';
import { mockDecrypt } from '../lib/mocks.js';
import { notFound, badInput } from '../lib/errors.js';
import {
  assetRef as makeAssetRef,
  userRef as makeUserRef,
  deviceRef as makeDeviceRef,
  payloadCommit as makePayloadCommit,
  buildReceiptId,
  toBytes32,
  hexToBuffer,
  bufferToHex,
} from '../lib/refs.js';
import { validate } from '../middleware/validate.js';
import * as chain from '../core/chain.js';
import * as bktree from '../core/bktree.js';
import { decrypt as aesDecrypt, sha256, md5, embed, hashes } from '../core/index.js';
import { buildPayload, shortIdOf } from '../core/payload.js';

/**
 * B7 — THE ORCHESTRATOR. The 13 steps of docs/CONTRACTS.md §5, in that order.
 *
 * The one rule that matters: the CHAIN WRITE (step 8) happens BEFORE the
 * watermark is embedded (step 9). If the chain write fails we throw, and no
 * marked file ever leaves the system. There can never be a marked copy in the
 * world without a matching receipt on the chain — that is the whole guarantee.
 */
const router = Router();

const DecryptBody = z.object({
  assetId: z.coerce.number().int().positive(),
  userId: z.coerce.number().int().positive(),
  deviceLabel: z.string().trim().min(1).max(100).optional().default('UNKNOWN-DEVICE'),
  delta: z.coerce.number().int().min(2).max(48).optional(),
});

router.post('/', validate(DecryptBody), async (req, res, next) => {
  const startedAt = Date.now();
  try {
    if (env.mockMode) return res.json(mockDecrypt);

    const { assetId, userId, deviceLabel } = req.valid;
    const delta = req.valid.delta ?? env.watermarkDelta;

    // --- 2. Load Asset + User from Postgres --------------------------------
    const [asset, user] = await Promise.all([
      prisma.asset.findUnique({ where: { id: assetId } }),
      prisma.user.findUnique({ where: { id: userId } }),
    ]);
    if (!asset) throw notFound(`No asset ${assetId}`);
    if (!user) throw notFound(`No user ${userId}`);
    if (!asset.cipherPath || !asset.iv || !asset.authTag) {
      throw badInput(`Asset ${assetId} has no encrypted blob — re-upload it.`);
    }

    // --- 3. Decrypt (AES-256-GCM; throws if the blob was tampered with) ----
    const ciphertext = await fs.readFile(asset.cipherPath);
    const plaintext = aesDecrypt(
      ciphertext,
      masterKey(),
      Buffer.from(asset.iv),
      Buffer.from(asset.authTag)
    );

    // --- 4. contentSha over the exact bytes being released ------------------
    const contentSha = sha256(plaintext);

    // --- 5. receiptId = keccak256(assetRef || userRef || contentSha || nonce)
    const assetRefHex = makeAssetRef(asset.id);
    const userRefHex = makeUserRef(user.id);
    const receiptIdHex = buildReceiptId({
      assetRef: assetRefHex,
      userRef: userRefHex,
      contentSha,
    });

    // --- 6. payloadBits: 36-bit shortId + CRC-8 + 4-bit version -------------
    const payloadBits = buildPayload(receiptIdHex, 1);
    const shortId = shortIdOf(receiptIdHex);

    // --- 7. payloadCommit — proves the mark predates any leak ---------------
    const payloadCommitHex = makePayloadCommit(payloadBits);

    // --- 8. ON CHAIN. Before the watermark. Non-negotiable. -----------------
    const anchor = await chain.logDecryption({
      receiptId: receiptIdHex,
      assetRef: assetRefHex,
      userRef: userRefHex,
      contentSha: toBytes32(contentSha),
      payloadCommit: payloadCommitHex,
    });

    // --- 9. Embed the invisible mark ---------------------------------------
    const marked = await embed(plaintext, payloadBits, delta);

    // --- 10. Perceptual hashes of the RELEASED bytes ------------------------
    const h = await hashes(marked.buffer);

    // Persist the released copy so /api/files/marked/:receiptId can serve it.
    await fs.mkdir(env.markedDir, { recursive: true });
    const shortHexId = receiptIdHex.replace(/^0x/, '').slice(0, 16);
    const markedPath = path.join(env.markedDir, `${shortHexId}${extFor(asset.mimeType)}`);
    await fs.writeFile(markedPath, marked.buffer);

    // --- 11. INSERT DecryptionEvent ----------------------------------------
    const event = await prisma.decryptionEvent.create({
      data: {
        receiptId: hexToBuffer(receiptIdHex),
        shortId,
        assetId: asset.id,
        userId: user.id,
        deviceRef: hexToBuffer(makeDeviceRef(deviceLabel)),
        deviceLabel,
        contentSha: sha256(marked.buffer), // digest of what was actually released
        md5Digest: md5(marked.buffer), // registry fingerprint (PS requirement)
        pHash: h.pHash,
        dHash: h.dHash,
        aHash: h.aHash,
        payloadBits,
        markedPath,
        txHash: hexToBuffer(anchor.txHash),
        blockNumber: anchor.blockNumber !== null ? BigInt(anchor.blockNumber) : null,
        chainMode: anchor.chainMode,
        deltaUsed: marked.deltaUsed ?? delta,
        psnrDb: Number.isFinite(marked.psnrDb) ? marked.psnrDb : 0,
      },
    });

    // --- 12. Keep the search index hot -------------------------------------
    bktree.insert({ id: event.id, pHash: h.pHash, dHash: h.dHash, aHash: h.aHash });

    // --- 13. Respond (docs/CONTRACTS.md §3) --------------------------------
    res.json({
      receiptId: receiptIdHex,
      txHash: anchor.txHash,
      blockNumber: anchor.blockNumber,
      etherscanUrl: anchor.etherscanUrl,
      payloadBits,
      psnrDb: Number.isFinite(marked.psnrDb) ? marked.psnrDb : null,
      deltaUsed: marked.deltaUsed ?? delta,
      downloadUrl: `/api/files/marked/${shortHexId}`,
      // Extras beyond the frozen contract — additive, so C can ignore them.
      chainMode: anchor.chainMode,
      chainSkipped: anchor.skipped,
      elapsedMs: Date.now() - startedAt,
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------- GET /api/files/marked/:receiptId -----
/** Serves the watermarked copy. Mounted separately in index.js. */
export const filesRouter = Router();

filesRouter.get('/marked/:receiptId', async (req, res, next) => {
  try {
    const key = String(req.params.receiptId).replace(/^0x/, '');
    if (!/^[0-9a-f]{4,64}$/i.test(key)) throw badInput('Malformed receiptId');

    if (env.mockMode) throw notFound('No marked file in MOCK_MODE — turn MOCK_MODE off.');

    // The download URL carries the first 16 hex chars of the receiptId.
    const event = await prisma.decryptionEvent.findFirst({
      where: { markedPath: { contains: key.slice(0, 16) } },
      include: { asset: true },
    });
    if (!event?.markedPath) throw notFound(`No marked file for ${key}`);

    const buffer = await fs.readFile(event.markedPath).catch(() => null);
    if (!buffer) throw notFound('The marked file is no longer on disk.');

    res.setHeader('Content-Type', event.asset?.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="marked-${key.slice(0, 16)}${extFor(event.asset?.mimeType)}"`
    );
    res.setHeader('X-Receipt-Id', bufferToHex(event.receiptId));
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

function extFor(mimeType) {
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/jpg':
      return '.jpg';
    case 'image/webp':
      return '.webp';
    case 'image/bmp':
      return '.bmp';
    case 'image/tiff':
      return '.tiff';
    default:
      return '.png';
  }
}

export default router;
