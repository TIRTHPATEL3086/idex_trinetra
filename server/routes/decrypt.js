import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { env, masterKey } from '../lib/env.js';
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
import { requireAuth, requireAnyCap, forbidden } from '../middleware/auth.js';
import { can } from '../lib/permissions.js';
import * as chain from '../core/chain.js';
import * as bktree from '../core/bktree.js';
import { decrypt as aesDecrypt, sha256, md5, embed, hashes } from '../core/index.js';
import { buildPayload, shortIdOf } from '../core/payload.js';

/**
 * The orchestrator: decrypt, anchor, mark, index, record — in that order.
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

const guard = requireAnyCap('decrypt:self', 'decrypt:any');

router.post('/', guard, validate(DecryptBody), async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const { assetId, userId, deviceLabel } = req.valid;
    const delta = req.valid.delta ?? env.watermarkDelta;

    // An OFFICER holds `decrypt:self` only: they may release a copy in their
    // own name and nobody else's. The receipt names whoever the mark will
    // identify, so releasing one as another officer would put an innocent name
    // on a copy they never touched — the one failure this system exists to
    // prevent.
    if (!can(req.user.role, 'decrypt:any') && userId !== req.user.id) {
      throw forbidden(
        'You may only release a copy in your own name. Releasing one on behalf of another officer requires an administrator.',
        { role: req.user.role, attemptedUserId: userId }
      );
    }

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
    const raw = await hashes(marked.buffer);
    // The hashes are unsigned 64-bit; Postgres BIGINT is signed 64-bit, so wrap
    // them into the signed range. The Hamming metric masks to the low 64 bits,
    // so distances are unaffected.
    const h = {
      pHash: toSigned64(raw.pHash),
      dHash: raw.dHash == null ? null : toSigned64(raw.dHash),
      aHash: raw.aHash == null ? null : toSigned64(raw.aHash),
    };

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

    // --- 13. Respond -------------------------------------------------------
    res.json({
      receiptId: receiptIdHex,
      txHash: anchor.txHash,
      blockNumber: anchor.blockNumber,
      etherscanUrl: anchor.etherscanUrl,
      payloadBits,
      psnrDb: Number.isFinite(marked.psnrDb) ? marked.psnrDb : null,
      deltaUsed: marked.deltaUsed ?? delta,
      downloadUrl: `/api/files/marked/${shortHexId}`,
      // Diagnostics — additive, safe for a client to ignore.
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

filesRouter.get('/marked/:receiptId', requireAuth, async (req, res, next) => {
  try {
    const key = String(req.params.receiptId).replace(/^0x/, '');
    if (!/^[0-9a-f]{4,64}$/i.test(key)) throw badInput('Malformed receiptId');

    // The download URL carries the first 16 hex chars of the receiptId.
    const event = await prisma.decryptionEvent.findFirst({
      where: { markedPath: { contains: key.slice(0, 16) } },
      include: { asset: true },
    });
    if (!event?.markedPath) throw notFound(`No marked file for ${key}`);

    // Every marked copy carries a watermark naming exactly one person. Handing
    // one to anybody else would put their mark in a stranger's hands, so a copy
    // is downloadable only by the officer it was released to — or by an admin,
    // who could have released it themselves anyway.
    if (!can(req.user.role, 'decrypt:any') && event.userId !== req.user.id) {
      throw forbidden('That copy was released to another officer.');
    }

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

/** Wrap an unsigned 64-bit hash into the signed range Postgres BIGINT accepts. */
function toSigned64(value) {
  return BigInt.asIntN(64, BigInt(value));
}

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
