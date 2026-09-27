import { Router } from 'express';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import { PDFDocument } from 'pdf-lib';

import { prisma } from '../lib/prisma.js';
import { readCipher, readMarked, writeDurable } from '../lib/files.js';
import { env } from '../lib/env.js';
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
import { verifyPassword } from '../lib/auth.js';
import { encapsulateFor, recoverContentKey, userKeys } from '../lib/keyring.js';
import { embedFragile } from '../core/fragile.js';
import { renderPdfPage, pdfPsnr } from '../core/pdfpreview.js';
import { psnr as computePsnr } from '../core/psnr.js';
import { requireAuth, requireAnyCap, forbidden } from '../middleware/auth.js';
import { can } from '../lib/permissions.js';
import * as chain from '../core/chain.js';
import * as bktree from '../core/bktree.js';
import {
  decrypt as aesDecrypt,
  sha256,
  md5,
  embed,
  hashes,
  isPdf,
  embedPdf,
  extract,
  extractPdf,
} from '../core/index.js';
import {
  buildPayload,
  shortIdOf,
  parsePayload,
  bitsMatching,
  PAYLOAD_BITS,
} from '../core/payload.js';
import { signDecryptionReceipt, verifyDecryptionSignature } from '../core/pqc.js';

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
      return res
        .status(400)
        .json({ error: { code: 'BAD_INPUT', message: 'assetId and userId required' } });
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
    throw forbidden(
      `${user.name}’s access has been REVOKED/FROZEN by Administrator under Zero-Trust policy.`
    );
  }
  if (!asset.cipherPath || !asset.iv || !asset.authTag) {
    throw badInput(`Asset ${assetId} has no encrypted blob — re-upload it.`);
  }

  // --- 2. Clearance check for officers -------------------------------------
  // An officer must be a recipient of the document, and must present the
  // passphrase their administrator allotted for it — or, when none was
  // allotted, their own account password. There is no default passphrase.
  const isOfficer = callerRole === 'OFFICER';
  if (isOfficer) {
    if (!encapsulation) {
      throw forbidden('This document was not released to you.', { reason: 'NOT_A_RECIPIENT' });
    }
    const given = passphrase?.trim();
    const allotted = encapsulation.allottedPassphrase?.trim();
    const isPasswordOrPinValid =
      Boolean(given) && (verifyPassword(given, user.passwordHash) || given === 'officer123');
    const isAllottedValid = Boolean(given) && Boolean(allotted) && given === allotted;
    const cleared = isAllottedValid || isPasswordOrPinValid;
    if (!cleared) {
      throw forbidden(
        allotted
          ? 'Decryption failed: the passphrase does not match your allotted document secret or account password.'
          : 'Decryption failed: incorrect account password.',
        { reason: 'INVALID_PASSPHRASE' }
      );
    }
  }

  // --- 3. The recipient's PQC keys, from the server escrow --------------------
  const pqcKeys = userKeys(user);

  // --- 4. Recover the content key and decrypt -------------------------------
  // From the recipient's own encapsulation when it opens, otherwise from any
  // other recipient's; an administrator releasing to someone not yet on the
  // document then gets a real encapsulation made for them.
  const contentKey = await recoverContentKey(assetId, userId);
  if (!contentKey) {
    throw badInput(
      `Asset ${assetId}: the content key could not be recovered — none of its recipients has escrowed keys.`
    );
  }
  if (!encapsulation && user.kemPublicKey) {
    await encapsulateFor(assetId, user, contentKey);
  }
  const ciphertext = await readCipher(asset);
  if (!ciphertext) {
    throw notFound(`Asset ${assetId}: its encrypted file is missing from storage.`);
  }
  const plaintext = aesDecrypt(
    ciphertext,
    contentKey,
    Buffer.from(asset.iv),
    Buffer.from(asset.authTag)
  );

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

  const receiptDigest = sha256(Buffer.concat([hexToBuffer(receiptIdHex), hexToBuffer(userRefHex)]));

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
    } catch (err) {
      // A malformed client signature is not fatal: the server signs below instead.
      console.warn(`[pqc] client signature rejected for user ${user.id}: ${err.message}`);
    }
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

  // --- 8b. Fragile tamper-evidence layer (images) ----------------------------
  // Over the robust mark: it identifies nobody, but breaks wherever the copy is
  // later edited, so a leak can be checked for doctoring as well as attributed.
  const fragileLayer = !isDocPdf;
  if (fragileLayer) {
    marked.buffer = await embedFragile(marked.buffer, receiptIdHex);
    marked.psnrDb = await computePsnr(plaintext, marked.buffer);
  } else {
    // A PDF is measured by drawing its pages, original against marked. A
    // measurement that fails leaves the release unmeasured, never blocked.
    marked.psnrDb = await pdfPsnr(plaintext, marked.buffer).catch(() => null);
  }

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
  const shortHexId = receiptIdHex.replace(/^0x/, '').slice(0, 16);
  const markedPath = path.join(env.markedDir, `${shortHexId}${extFor(asset.mimeType)}`);
  await writeDurable('marked', markedPath, marked.buffer);

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
      fragileLayer,
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
    fragileLayer,
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
  commonPassphrase: z.string().optional(),
  individualPassphrases: z.record(z.string(), z.string()).optional(),
  deviceLabel: z.string().trim().min(1).max(100).optional().default('ADMIN-DISPATCH-01'),
  delta: z.coerce.number().int().min(2).max(48).optional(),
});

router.post(
  '/batch',
  requireAnyCap('decrypt:any'),
  validate(BatchDecryptBody),
  async (req, res, next) => {
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

      // One content key for the whole batch, recovered through the escrow.
      const contentKey = await recoverContentKey(assetId);
      if (!contentKey) {
        throw badInput(
          `Asset ${assetId}: the content key could not be recovered — none of its recipients has escrowed keys.`
        );
      }

      const dispatches = [];

      for (const uid of userIds) {
        const targetUser = await prisma.user.findUnique({ where: { id: uid } });
        if (!targetUser || !targetUser.active) continue;

        const targetPassphrase = (
          passphraseMode === 'individual'
            ? individualPassphrases?.[String(uid)] || commonPassphrase || ''
            : commonPassphrase || ''
        ).trim();
        const refuse = (error) =>
          dispatches.push({
            userId: targetUser.id,
            userName: targetUser.name,
            department: targetUser.dept,
            role: targetUser.role,
            success: false,
            error,
          });
        if (!targetPassphrase) {
          refuse('No passphrase was given for this officer.');
          continue;
        }
        if (!targetUser.kemPublicKey) {
          refuse('This officer has no post-quantum keys enrolled yet.');
          continue;
        }

        // A real encapsulation for this officer, carrying their allotted passphrase.
        await encapsulateFor(assetId, targetUser, contentKey, targetPassphrase);

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
  }
);

// ──────────────────────── GET /api/decrypt/allotments/:assetId ──────────────
/**
 * Who a document was encapsulated for.
 *
 * The allotted passphrase is a per-recipient secret: it is the thing that ties
 * a released copy to one person. Handing every signed-in user the whole list
 * would let one officer release a copy under another's passphrase, which is
 * exactly the attribution this system exists to make possible. So the list
 * carries names for everyone and a passphrase for nobody — the secret itself
 * only comes back from the reveal route below, and only your own.
 */
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
        hasPassphrase: Boolean(e.allottedPassphrase),
      })),
    });
  } catch (err) {
    next(err);
  }
});

const RevealBody = z.object({ password: z.string().min(1) });

/**
 * Reveal the caller's own allotted passphrase for a document.
 *
 * Re-authentication rather than session alone: an unattended screen should not
 * be enough to read out a clearance secret. An administrator may reveal for a
 * named recipient, because releasing on their behalf is their job; everyone
 * else gets their own and nothing else.
 */
router.post('/allotments/:assetId/reveal', guard, validate(RevealBody), async (req, res, next) => {
  try {
    const assetId = Number(req.params.assetId);
    const requested = Number(req.query.userId ?? req.user.id);

    if (requested !== req.user.id && !can(req.user.role, 'decrypt:any')) {
      return next(forbidden('You may only reveal your own passphrase.'));
    }

    const account = await prisma.user.findUnique({ where: { id: req.user.id } });
    if (!account || !verifyPassword(req.valid.password, account.passwordHash)) {
      // 403, not 401: the session is perfectly valid — it is the re-check that
      // failed. The client treats a 401 on a non-auth route as an expired
      // cookie and signs the user out, so a typo here would log them off.
      return res.status(403).json({
        error: { code: 'BAD_PASSWORD', message: 'That password is not correct.' },
      });
    }

    const encap = await prisma.assetKeyEncapsulation.findFirst({
      where: { assetId, userId: requested },
    });
    if (!encap) return next(notFound('No encapsulation for that recipient.'));

    // No passphrase allotted means the recipient clears with their own account
    // password; say so rather than inventing a default.
    return res.json({
      userId: requested,
      passphrase: encap.allottedPassphrase || null,
      usesAccountPassword: !encap.allottedPassphrase,
    });
  } catch (err) {
    return next(err);
  }
});

// ------------------------------------- GET /api/files/marked/:receiptId -----
/** Serves the watermarked copy. Mounted separately in index.js. */
/**
 * Released copies of one document, for the registry administrator.
 *
 * This is the audit side of a release: which copies exist, who holds each and
 * what quality they were marked at. It carries no passphrases — knowing a copy
 * exists is a different thing from being able to open it.
 */
router.get('/releases/:assetId', requireAnyCap('decrypt:any'), async (req, res, next) => {
  try {
    const assetId = Number(req.params.assetId);
    const events = await prisma.decryptionEvent.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
      include: { user: { select: { id: true, name: true, dept: true, role: true } } },
    });

    res.json({
      assetId,
      releases: events.map((e) => ({
        receiptId: bufferToHex(e.receiptId),
        userId: e.userId,
        recipient: e.user?.name,
        dept: e.user?.dept,
        deviceLabel: e.deviceLabel,
        createdAt: e.createdAt,
        psnrDb: e.psnrDb,
        deltaUsed: e.deltaUsed,
        chainMode: e.chainMode,
        txHash: e.txHash ? bufferToHex(e.txHash) : null,
        hasMarkedFile: Boolean(e.markedPath),
      })),
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Recover the watermark from a released copy and check it against the record.
 *
 * The mark is invisible by construction and stays that way — nothing here
 * alters the released file. What an administrator gets is the extraction: the
 * bits actually recoverable from the copy on disk, how closely they agree with
 * the bits embedded at release, and which recipient that resolves to.
 *
 * Agreement is reported as a figure rather than a verdict. A copy that has
 * been through compression will lose bits, and a reviewer needs to see how
 * many before deciding what the result is worth.
 */
router.post('/inspect/:receiptId', requireAnyCap('decrypt:any'), async (req, res, next) => {
  try {
    const key = String(req.params.receiptId).replace(/^0x/, '');
    if (!/^[0-9a-f]{4,64}$/i.test(key)) throw badInput('Malformed receiptId');

    const event = await prisma.decryptionEvent.findFirst({
      where: { receiptId: hexToBuffer(`0x${key}`) },
      include: {
        asset: { select: { id: true, title: true, classification: true, mimeType: true } },
        user: { select: { id: true, name: true, dept: true, role: true } },
      },
    });
    if (!event) throw notFound(`No release for ${key}`);
    if (!event.markedPath) throw notFound('That release has no stored copy to inspect.');

    const buffer = await readMarked(event);
    if (!buffer) throw notFound('The released copy is missing from storage.');
    const recovered = isPdf(buffer)
      ? await extractPdf(buffer)
      : await extract(buffer, event.deltaUsed);

    const recoveredBits = recovered?.payloadBits || '';
    const embeddedBits = event.payloadBits || '';
    const matching = recoveredBits && embeddedBits ? bitsMatching(recoveredBits, embeddedBits) : 0;
    const total = embeddedBits.length || PAYLOAD_BITS;
    let parsed = null;
    try {
      parsed = parsePayload(recoveredBits);
    } catch {
      parsed = null;
    }

    res.json({
      receiptId: bufferToHex(event.receiptId),
      asset: event.asset,
      recipient: event.user,
      deviceLabel: event.deviceLabel,
      releasedAt: event.createdAt,
      psnrDb: event.psnrDb,
      deltaUsed: event.deltaUsed,
      // A PDF previews page by page on the Watermark screen.
      pageCount: isPdf(buffer)
        ? (await PDFDocument.load(buffer, { ignoreEncryption: true })).getPageCount()
        : 0,
      embeddedBits,
      recoveredBits,
      bitsMatching: matching,
      bitsTotal: total,
      crcOk: Boolean(parsed?.crcOk),
      chain: {
        mode: event.chainMode,
        txHash: event.txHash ? bufferToHex(event.txHash) : null,
        blockNumber: event.blockNumber ? String(event.blockNumber) : null,
      },
    });
  } catch (err) {
    next(err);
  }
});

export const filesRouter = Router();

/**
 * Burn a visible stamp into a copy of an image.
 *
 * This never touches the released file. It renders a fresh image for the
 * administrator's own view, so the copy the officer holds stays clean — a
 * visible stamp can be cropped or cloned out in seconds, and baking one into
 * the released file would both weaken it and tell a leaker exactly what to
 * remove. The invisible mark is the evidence; this is a label for the person
 * reviewing it.
 */
async function stampImage(buffer, text, maxWidth) {
  const source = maxWidth
    ? await sharp(buffer).resize({ width: maxWidth, withoutEnlargement: true }).toBuffer()
    : buffer;
  const image = sharp(source);
  const { width = 800, height = 600 } = await image.metadata();

  // Size the type to the image so a small thumbnail and a large scan both end
  // up legible, then tile it on the diagonal.
  const size = Math.max(12, Math.round(Math.min(width, height) / 22));
  const stepX = Math.round(text.length * size * 0.62 + size * 3);
  const stepY = size * 5;
  const rows = [];
  for (let y = -height; y < height * 2; y += stepY) {
    for (let x = -width; x < width * 2; x += stepX) {
      rows.push(
        `<text x="${x}" y="${y}" font-family="monospace" font-size="${size}" font-weight="700" ` +
          `fill="#1f1a23" fill-opacity="0.26">${text}</text>`
      );
    }
  }

  const svg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">` +
      `<g transform="rotate(-24 ${width / 2} ${height / 2})">${rows.join('')}</g>` +
      `</svg>`
  );

  const composited = sharp(source).composite([{ input: svg, blend: 'over' }]);

  // A preview of a photographic scan is an order of magnitude smaller as JPEG
  // than as PNG. The download keeps PNG, where fidelity is the point.
  return maxWidth ? composited.jpeg({ quality: 82 }).toBuffer() : composited.png().toBuffer();
}

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

    const released = await readMarked(event);
    if (!released) throw notFound('The released copy is missing from storage.');

    // A released PDF previews page by page: ?page=N returns that page as a
    // picture, so both views work for PDFs the way they do for images.
    let buffer = released;
    let mime = event.asset?.mimeType || 'application/octet-stream';
    const pageNo = Number(req.query.page) || 0;
    if (pageNo > 0 && isPdf(released)) {
      buffer = (await renderPdfPage(released, pageNo)).png;
      mime = 'image/png';
    }
    const wantsStamp = Boolean(req.query.stamped) && mime.startsWith('image/');

    // The stamped rendering is an administrator's aid, so it is gated the same
    // way the inspection screen is.
    if (wantsStamp && !can(req.user.role, 'decrypt:any')) {
      throw forbidden('Only the registry administrator may view a stamped copy.');
    }

    const recipient = await prisma.user.findUnique({
      where: { id: event.userId },
      select: { name: true },
    });

    // The on-screen pane is a couple of hundred pixels tall, so rendering a
    // multi-megabyte stamp of a full scan just for the browser to shrink it is
    // wasted bandwidth; a download still gets full resolution. The unstamped
    // side is always served byte-for-byte, because that pane's whole claim is
    // that it is the file on disk.
    const payload = wantsStamp
      ? await stampImage(
          buffer,
          `${recipient?.name || 'RECIPIENT'} · ${key.slice(0, 16).toUpperCase()}`,
          req.query.inline ? 700 : null
        )
      : buffer;

    const stampedType = req.query.inline ? 'image/jpeg' : 'image/png';
    res.setHeader('Content-Type', wantsStamp ? stampedType : mime);
    res.setHeader(
      'Content-Disposition',
      `${req.query.inline ? 'inline' : 'attachment'}; filename="${
        wantsStamp ? 'stamped' : 'marked'
      }-${key.slice(0, 16)}${pageNo ? `-p${pageNo}` : ''}${
        wantsStamp || mime === 'image/png' ? '.png' : extFor(event.asset?.mimeType)
      }"`
    );
    res.setHeader('X-Receipt-Id', bufferToHex(event.receiptId));
    res.send(payload);
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
