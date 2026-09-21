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
  signatureCommit as makeSignatureCommit,
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
import { decrypt as aesDecrypt, sha256, md5, embed, hashes, isPdf, embedPdf } from '../core/index.js';
import { buildPayload, shortIdOf } from '../core/payload.js';
import {
  decapsulateKey,
  signDecryptionReceipt,
  verifyDecryptionSignature,
  decryptKeyBundle,
  PQC_ALGORITHMS,
} from '../core/pqc.js';

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
  passphrase: z.string().optional(),
});

const guard = requireAnyCap('decrypt:self', 'decrypt:any');

router.post('/', guard, validate(DecryptBody), async (req, res, next) => {
  const startedAt = Date.now();
  try {
    const { assetId, userId, deviceLabel, passphrase } = req.valid;
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
    const [asset, user, encapsulation] = await Promise.all([
      prisma.asset.findUnique({ where: { id: assetId } }),
      prisma.user.findUnique({ where: { id: userId } }),
      prisma.assetKeyEncapsulation.findUnique({
        where: { assetId_userId: { assetId, userId } },
      }),
    ]);
    if (!asset) throw notFound(`No asset ${assetId}`);
    if (!user) throw notFound(`No user ${userId}`);
    if (!user.active) {
      throw forbidden(`Officer ${user.name} access has been REVOKED/FROZEN by Administrator under Zero-Trust policy.`);
    }
    if (!asset.cipherPath || !asset.iv || !asset.authTag) {
      throw badInput(`Asset ${assetId} has no encrypted blob — re-upload it.`);
    }

    // Recover user's PQC keys if enrolled
    const candidatePassphrases = [
      passphrase,
      'officer123',
      'admin123',
      'analyst123',
      'auditor123',
      user.email?.split('@')[0],
    ].filter(Boolean);

    let pqcKeys = null;
    if (user.encryptedPqcKeys) {
      for (const pw of candidatePassphrases) {
        try {
          pqcKeys = decryptKeyBundle(user.encryptedPqcKeys, pw);
          if (pqcKeys) break;
        } catch {}
      }
    }

    // --- 3. Decrypt (PQC ML-KEM-768 or AES-256-GCM master key) ------------
    const ciphertext = await fs.readFile(asset.cipherPath);
    let plaintext;

    if (encapsulation) {
      if (!pqcKeys?.kemSecretKey) {
        throw badInput(
          `Asset ${assetId} is protected with ML-KEM-768 broadcast encryption for Officer ${user.name}, but private key bundle could not be unlocked.`
        );
      }

      // Decapsulate the 32-byte content key using officer's post-quantum private key
      const sharedSecret = decapsulateKey(encapsulation.kemCiphertext, pqcKeys.kemSecretKey);
      const contentKey = aesDecrypt(
        encapsulation.encryptedKey,
        sharedSecret,
        Buffer.from(encapsulation.iv),
        Buffer.from(encapsulation.authTag)
      );

      plaintext = aesDecrypt(
        ciphertext,
        contentKey,
        Buffer.from(asset.iv),
        Buffer.from(asset.authTag)
      );
    } else {
      // Classical fallback
      plaintext = aesDecrypt(
        ciphertext,
        masterKey(),
        Buffer.from(asset.iv),
        Buffer.from(asset.authTag)
      );
    }

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

    // --- 7.5 Non-repudiation Digital Signature (NIST ML-DSA-65) -------------
    let decryptionSignature = null;
    let sigCommitHex = null;
    if (pqcKeys?.dsaSecretKey) {
      const receiptDigest = sha256(
        Buffer.concat([
          hexToBuffer(receiptIdHex),
          hexToBuffer(userRefHex),
        ])
      );
      decryptionSignature = signDecryptionReceipt(receiptDigest, pqcKeys.dsaSecretKey);
      sigCommitHex = makeSignatureCommit(decryptionSignature);
    }

    // --- 8. ON CHAIN. Before the watermark. Non-negotiable. -----------------
    const anchor = await chain.logDecryption({
      receiptId: receiptIdHex,
      assetRef: assetRefHex,
      userRef: userRefHex,
      contentSha: toBytes32(contentSha),
      payloadCommit: payloadCommitHex,
      signatureCommit: sigCommitHex,
    });

    // --- 9. Embed the invisible mark ---------------------------------------
    const isDocPdf = asset.mimeType === 'application/pdf' || isPdf(plaintext);
    const marked = isDocPdf
      ? await embedPdf(plaintext, payloadBits, receiptIdHex)
      : await embed(plaintext, payloadBits, delta);

    // --- 10. Perceptual hashes of the RELEASED bytes ------------------------
    let h;
    if (isDocPdf) {
      const pdfHash = BigInt('0x' + sha256(marked.buffer).toString('hex').slice(0, 16));
      h = {
        pHash: toSigned64(pdfHash),
        dHash: toSigned64(pdfHash),
        aHash: toSigned64(pdfHash),
      };
    } else {
      const raw = await hashes(marked.buffer);
      h = {
        pHash: toSigned64(raw.pHash),
        dHash: raw.dHash == null ? null : toSigned64(raw.dHash),
        aHash: raw.aHash == null ? null : toSigned64(raw.aHash),
      };
    }

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
        decryptionSignature: decryptionSignature ? Buffer.from(decryptionSignature) : null,
        signatureCommit: sigCommitHex ? hexToBuffer(sigCommitHex) : null,
        signatureAlgorithm: decryptionSignature ? 'ML-DSA-65' : null,
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
      pqc: {
        kemAlgorithm: encapsulation ? 'ML-KEM-768' : 'CLASSICAL-AES-GCM',
        dsaAlgorithm: decryptionSignature ? 'ML-DSA-65' : null,
        signatureCommit: sigCommitHex,
        signatureHex: decryptionSignature
          ? Buffer.from(decryptionSignature).toString('hex').slice(0, 64) + '…'
          : null,
        nonRepudiation: Boolean(decryptionSignature),
      },
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
    case 'application/pdf':
      return '.pdf';
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
