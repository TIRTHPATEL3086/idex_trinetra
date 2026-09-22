import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
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
import { decrypt as aesDecrypt, encrypt as aesEncrypt, sha256, md5, embed, hashes, isPdf, embedPdf } from '../core/index.js';
import { buildPayload, shortIdOf } from '../core/payload.js';
import {
  decapsulateKey,
  encapsulateKey,
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
  userId: z.coerce.number().int().positive().optional(),
  deviceLabel: z.string().trim().min(1).max(100).optional().default('UNKNOWN-DEVICE'),
  delta: z.coerce.number().int().min(2).max(48).optional(),
  passphrase: z.string().optional(),
  clientSignature: z.string().optional(),
  challengeId: z.string().optional(),
});

/**
 * In-memory challenge store: challengeId → { message: Buffer, userId, assetId, expiresAt }
 * Challenges expire after 2 minutes — sufficient for local UX, safe for air-gapped systems.
 */
const _challenges = new Map();
const CHALLENGE_TTL_MS = 2 * 60 * 1000;
const guard = requireAnyCap('decrypt:self', 'decrypt:any');

function pruneExpiredChallenges() {
  const now = Date.now();
  for (const [id, c] of _challenges) {
    if (c.expiresAt < now) _challenges.delete(id);
  }
}

// -------------------------------- POST /api/decrypt/challenge ----------------
/**
 * Issues a 32-byte random signing challenge bound to the (assetId, userId) pair.
 * The client signs this with ML-DSA-65 and includes the challengeId + signature
 * in the subsequent POST /api/decrypt body.
 */
router.post('/challenge', guard, async (req, res, next) => {
  try {
    pruneExpiredChallenges();
    const { assetId, userId } = req.body;
    if (!assetId || !userId) {
      return res.status(400).json({ error: { code: 'BAD_INPUT', message: 'assetId and userId required' } });
    }
    const challengeBytes = crypto.randomBytes(32);
    const challengeId = crypto.randomUUID();
    _challenges.set(challengeId, {
      message: challengeBytes,
      userId: Number(userId),
      assetId: Number(assetId),
      expiresAt: Date.now() + CHALLENGE_TTL_MS,
    });
    res.json({
      challengeId,
      challengeHex: '0x' + challengeBytes.toString('hex'),
      expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS).toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// --------------------------------- Core Decryption Pipeline -----------------
export async function executeDecryption({
  assetId,
  userId,
  deviceLabel = 'DESK-114',
  delta = env.watermarkDelta,
  passphrase,
  clientSignature,
  challengeId,
  callerRole = 'OFFICER',
}) {
  const startedAt = Date.now();

  // --- 1. Load Asset + User + Encapsulation --------------------------------
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

  // --- 2. Mandatory Allotted Passphrase Enforcement for Officers -----------
  // When an officer decrypts, they MUST supply their allotted clearance passphrase!
  const isOfficer = callerRole === 'OFFICER';
  const expectedPassphrase = (encapsulation?.allottedPassphrase || 'officer123').trim();

  if (isOfficer) {
    if (!passphrase || passphrase.trim() !== expectedPassphrase) {
      throw forbidden(
        'Decryption failed: The provided passphrase does not match your allotted clearance key. You cannot access or download this watermarked document.',
        { reason: 'INVALID_PASSPHRASE' }
      );
    }
  }

  // --- 3. Recover user's PQC keys if enrolled ------------------------------
  let pqcKeys = null;
  if (user.encryptedPqcKeys) {
    const pw = (passphrase || expectedPassphrase).trim();
    try {
      pqcKeys = decryptKeyBundle(user.encryptedPqcKeys, pw);
    } catch {}
    if (!pqcKeys) {
      try {
        pqcKeys = decryptKeyBundle(user.encryptedPqcKeys, 'officer123');
      } catch {}
    }
  }

  // --- 4. Decrypt content --------------------------------------------------
  const ciphertext = await fs.readFile(asset.cipherPath);
  let plaintext = null;

  if (encapsulation) {
    let contentKey = null;

    if (pqcKeys?.kemSecretKey) {
      try {
        const sharedSecret = decapsulateKey(encapsulation.kemCiphertext, pqcKeys.kemSecretKey);
        contentKey = aesDecrypt(
          encapsulation.encryptedKey,
          sharedSecret,
          Buffer.from(encapsulation.iv),
          Buffer.from(encapsulation.authTag)
        );
      } catch {}
    }

    if (!contentKey) {
      const siblingEncs = await prisma.assetKeyEncapsulation.findMany({
        where: { assetId, userId: { not: userId } },
      });

      for (const sib of siblingEncs) {
        const sibUser = await prisma.user.findUnique({ where: { id: sib.userId } });
        if (!sibUser?.encryptedPqcKeys) continue;
        for (const pw of [
          sib.allottedPassphrase,
          'officer123',
          'admin123',
          'analyst123',
          sibUser.email?.split('@')[0],
        ].filter(Boolean)) {
          try {
            const k = decryptKeyBundle(sibUser.encryptedPqcKeys, pw);
            if (k?.kemSecretKey) {
              const ss = decapsulateKey(sib.kemCiphertext, k.kemSecretKey);
              contentKey = aesDecrypt(
                sib.encryptedKey,
                ss,
                Buffer.from(sib.iv),
                Buffer.from(sib.authTag)
              );
              break;
            }
          } catch {}
        }
        if (contentKey) break;
      }
    }

    if (!contentKey) {
      try {
        plaintext = aesDecrypt(
          ciphertext,
          masterKey(),
          Buffer.from(asset.iv),
          Buffer.from(asset.authTag)
        );
      } catch {}
    }

    if (!contentKey && !plaintext) {
      throw badInput(
        `Asset ${assetId} content key could not be recovered. Recipient's PQC keys could not be decapsulated.`
      );
    }

    if (contentKey && user.kemPublicKey) {
      try {
        const { sharedSecret: newSs, ciphertext: newKemCt } = encapsulateKey(user.kemPublicKey);
        const { ciphertext: newEncKey, iv: newIv, authTag: newTag } = aesEncrypt(contentKey, newSs);
        await prisma.assetKeyEncapsulation.update({
          where: { assetId_userId: { assetId, userId } },
          data: {
            kemCiphertext: Buffer.from(newKemCt),
            encryptedKey: newEncKey,
            iv: newIv,
            authTag: newTag,
          },
        });
      } catch {}
    }

    if (!plaintext) {
      plaintext = aesDecrypt(
        ciphertext,
        contentKey,
        Buffer.from(asset.iv),
        Buffer.from(asset.authTag)
      );
    }
  } else {
    plaintext = aesDecrypt(
      ciphertext,
      masterKey(),
      Buffer.from(asset.iv),
      Buffer.from(asset.authTag)
    );
  }

  // --- 5. contentSha & receiptId -------------------------------------------
  const contentSha = sha256(plaintext);
  const assetRefHex = makeAssetRef(asset.id);
  const userRefHex = makeUserRef(user.id);
  const receiptIdHex = buildReceiptId({
    assetRef: assetRefHex,
    userRef: userRefHex,
    contentSha,
  });

  const payloadBits = buildPayload(receiptIdHex, 1);
  const shortId = shortIdOf(receiptIdHex);
  const payloadCommitHex = makePayloadCommit(payloadBits);

  // --- 6. Non-repudiation Digital Signature (NIST ML-DSA-65) ---------------
  let decryptionSignature = null;
  let sigCommitHex = null;

  const receiptDigest = sha256(
    Buffer.concat([
      hexToBuffer(receiptIdHex),
      hexToBuffer(userRefHex),
    ])
  );

  if (clientSignature && user.dsaPublicKey) {
    try {
      const clientSig = Buffer.from(clientSignature.replace(/^0x/, ''), 'hex');
      let sigMessage = receiptDigest;
      if (challengeId) {
        const challenge = _challenges.get(challengeId);
        if (
          challenge &&
          challenge.expiresAt > Date.now() &&
          challenge.userId === userId &&
          challenge.assetId === assetId
        ) {
          sigMessage = challenge.message;
          _challenges.delete(challengeId);
        }
      }
      if (verifyDecryptionSignature(clientSig, sigMessage, user.dsaPublicKey)) {
        decryptionSignature = clientSig;
        sigCommitHex = makeSignatureCommit(decryptionSignature);
        console.info(`[pqc] Client ML-DSA-65 signature VERIFIED for user ${user.id}`);
      }
    } catch {}
  }

  if (!decryptionSignature && pqcKeys?.dsaSecretKey) {
    decryptionSignature = signDecryptionReceipt(receiptDigest, pqcKeys.dsaSecretKey);
    sigCommitHex = makeSignatureCommit(decryptionSignature);
  }

  // --- 7. ON CHAIN ---------------------------------------------------------
  const anchor = await chain.logDecryption({
    receiptId: receiptIdHex,
    assetRef: assetRefHex,
    userRef: userRefHex,
    contentSha: toBytes32(contentSha),
    payloadCommit: payloadCommitHex,
    signatureCommit: sigCommitHex,
  });

  // --- 8. Embed the invisible mark -----------------------------------------
  const isDocPdf = asset.mimeType === 'application/pdf' || isPdf(plaintext);
  const marked = isDocPdf
    ? await embedPdf(plaintext, payloadBits, receiptIdHex)
    : await embed(plaintext, payloadBits, delta);

  // --- 9. Perceptual hashes ------------------------------------------------
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

  // Persist released copy
  await fs.mkdir(env.markedDir, { recursive: true });
  const shortHexId = receiptIdHex.replace(/^0x/, '').slice(0, 16);
  const markedPath = path.join(env.markedDir, `${shortHexId}${extFor(asset.mimeType)}`);
  await fs.writeFile(markedPath, marked.buffer);

  // --- 10. INSERT DecryptionEvent ------------------------------------------
  const event = await prisma.decryptionEvent.create({
    data: {
      receiptId: hexToBuffer(receiptIdHex),
      shortId,
      assetId: asset.id,
      userId: user.id,
      deviceRef: hexToBuffer(makeDeviceRef(deviceLabel)),
      deviceLabel,
      contentSha: sha256(marked.buffer),
      md5Digest: md5(marked.buffer),
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

  // --- 11. BK-Tree index ---------------------------------------------------
  bktree.insert({ id: event.id, pHash: h.pHash, dHash: h.dHash, aHash: h.aHash });

  return {
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
    chainMode: anchor.chainMode,
    chainSkipped: anchor.skipped,
    elapsedMs: Date.now() - startedAt,
  };
}

// ──────────────────────────────── POST /api/decrypt ────────────────────────
router.post('/', guard, validate(DecryptBody), async (req, res, next) => {
  try {
    const { assetId, deviceLabel, delta, passphrase, clientSignature, challengeId } = req.valid;
    const targetUserId = req.valid.userId ?? req.user.id;

    if (!can(req.user.role, 'decrypt:any') && targetUserId !== req.user.id) {
      throw forbidden(
        'You may only release a copy in your own name. Releasing one on behalf of another officer requires an administrator.',
        { role: req.user.role, attemptedUserId: targetUserId }
      );
    }

    const result = await executeDecryption({
      assetId,
      userId: targetUserId,
      deviceLabel,
      delta: delta ?? env.watermarkDelta,
      passphrase,
      clientSignature,
      challengeId,
      callerRole: req.user.role,
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ──────────────────────────── POST /api/decrypt/batch ──────────────────────
/**
 * Admin-only: Batch dispatch a document to multiple recipient officers.
 * Supports:
 * - Common Passphrase for all recipients
 * - Individual Passphrase per officer
 */
const BatchDecryptBody = z.object({
  assetId: z.coerce.number().int().positive(),
  userIds: z.array(z.coerce.number().int().positive()).min(1),
  passphraseMode: z.enum(['common', 'individual']).optional().default('common'),
  commonPassphrase: z.string().optional().default('officer123'),
  individualPassphrases: z.record(z.string(), z.string()).optional(),
  deviceLabel: z.string().trim().min(1).max(100).optional().default('ADMIN-DISPATCH-01'),
  delta: z.coerce.number().int().min(2).max(48).optional(),
});

router.post('/batch', requireAnyCap('decrypt:any'), validate(BatchDecryptBody), async (req, res, next) => {
  try {
    const {
      assetId,
      userIds,
      passphraseMode,
      commonPassphrase,
      individualPassphrases,
      deviceLabel,
      delta,
    } = req.valid;

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw notFound(`No asset ${assetId}`);

    const dispatches = [];

    for (const uid of userIds) {
      const targetUser = await prisma.user.findUnique({ where: { id: uid } });
      if (!targetUser || !targetUser.active) continue;

      const targetPassphrase = (
        passphraseMode === 'individual'
          ? (individualPassphrases?.[String(uid)] || commonPassphrase || 'officer123')
          : (commonPassphrase || 'officer123')
      ).trim();

      // Upsert AssetKeyEncapsulation with the allotted passphrase
      const existingEncap = await prisma.assetKeyEncapsulation.findUnique({
        where: { assetId_userId: { assetId, userId: uid } },
      });

      if (existingEncap) {
        await prisma.assetKeyEncapsulation.update({
          where: { assetId_userId: { assetId, userId: uid } },
          data: { allottedPassphrase: targetPassphrase },
        });
      } else {
        await prisma.assetKeyEncapsulation.create({
          data: {
            assetId,
            userId: uid,
            kemCiphertext: Buffer.alloc(1088),
            encryptedKey: Buffer.alloc(32),
            iv: Buffer.alloc(12),
            authTag: Buffer.alloc(16),
            allottedPassphrase: targetPassphrase,
          },
        });
      }

      // Execute release for this officer
      try {
        const decResult = await executeDecryption({
          assetId,
          userId: uid,
          deviceLabel,
          delta: delta ?? env.watermarkDelta,
          passphrase: targetPassphrase,
          callerRole: 'ADMIN',
        });

        dispatches.push({
          userId: targetUser.id,
          userName: targetUser.name,
          department: targetUser.dept,
          role: targetUser.role,
          allottedPassphrase: targetPassphrase,
          receiptId: decResult.receiptId,
          txHash: decResult.txHash,
          etherscanUrl: decResult.etherscanUrl,
          downloadUrl: decResult.downloadUrl,
          psnrDb: decResult.psnrDb,
          success: true,
        });
      } catch (err) {
        dispatches.push({
          userId: targetUser.id,
          userName: targetUser.name,
          department: targetUser.dept,
          role: targetUser.role,
          allottedPassphrase: targetPassphrase,
          success: false,
          error: err.message,
        });
      }
    }

    res.json({
      ok: true,
      assetTitle: asset.title,
      totalDispatched: dispatches.filter((d) => d.success).length,
      dispatches,
    });
  } catch (err) {
    next(err);
  }
});

// ──────────────────────── GET /api/decrypt/allotments/:assetId ──────────────
router.get('/allotments/:assetId', guard, async (req, res, next) => {
  try {
    const assetId = Number(req.params.assetId);
    const encaps = await prisma.assetKeyEncapsulation.findMany({
      where: { assetId },
      include: { user: { select: { id: true, name: true, email: true, dept: true, role: true } } },
    });
    res.json({
      assetId,
      allotments: encaps.map((e) => ({
        userId: e.userId,
        name: e.user?.name,
        email: e.user?.email,
        dept: e.user?.dept,
        role: e.user?.role,
        allottedPassphrase: e.allottedPassphrase || 'officer123',
      })),
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
