import crypto from 'node:crypto';
import { Router } from 'express';
import path from 'node:path';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { writeDurable } from '../lib/files.js';
import { env } from '../lib/env.js';
import { badInput, notFound } from '../lib/errors.js';
import { assetRef, hexToBuffer, bufferToHex } from '../lib/refs.js';
import { singleFile } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { requireCap } from '../middleware/auth.js';
import { encrypt, sha256 } from '../core/index.js';
import { encapsulateKey } from '../core/pqc.js';

/**
 * Upload -> SHA-256 -> Per-Asset AES-256-GCM encrypt -> ML-KEM-768 broadcast encapsulation -> store.
 *
 * The plaintext is never written to disk. A unique 32-byte content encryption key (CEK)
 * is generated per asset. The CEK is then encapsulated using NIST ML-KEM-768 to every
 * authorized recipient's Post-Quantum public key.
 */
const router = Router();

const UploadBody = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  classification: z
    .enum(['RESTRICTED', 'CONFIDENTIAL', 'SECRET'])
    .optional()
    .default('CONFIDENTIAL'),
  authorizedUserIds: z.any().optional(),
});

function parseAuthorizedIds(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed))
        return parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0);
    } catch {
      return raw
        .split(',')
        .map((s) => Number(s.trim()))
        .filter((n) => Number.isInteger(n) && n > 0);
    }
  }
  return null;
}

// ------------------------------------------------- POST /api/assets ---------
router.post(
  '/',
  requireCap('assets:upload'),
  singleFile,
  validate(UploadBody),
  async (req, res, next) => {
    try {
      if (!req.file) throw badInput('No file uploaded. Send multipart field "file".');

      const plaintext = req.file.buffer;
      const originalSha = sha256(plaintext);

      // Generate a fresh, unique 32-byte content key for this asset
      const contentKey = crypto.randomBytes(32);

      // Encrypt before anything touches the filesystem.
      const { ciphertext, iv, authTag } = encrypt(plaintext, contentKey);

      // Create the row first so the id is available for the filename and the ref.
      const created = await prisma.asset.create({
        data: {
          title: req.valid.title,
          classification: req.valid.classification,
          mimeType: req.file.mimetype,
          originalSha,
          // Placeholder — a unique value we immediately overwrite with the real ref.
          assetRef: Buffer.from(`pending-${Date.now()}-${Math.random()}`),
          iv,
          authTag,
          sizeBytes: plaintext.length,
        },
      });

      const cipherPath = path.join(env.cipherDir, `asset-${created.id}.bin`);
      await writeDurable('cipher', cipherPath, ciphertext);

      const asset = await prisma.asset.update({
        where: { id: created.id },
        data: {
          cipherPath,
          assetRef: hexToBuffer(assetRef(created.id)),
        },
      });

      // Determine authorized recipients
      const explicitIds = parseAuthorizedIds(req.valid.authorizedUserIds);
      let targetUsers;
      if (explicitIds && explicitIds.length > 0) {
        targetUsers = await prisma.user.findMany({
          where: { id: { in: explicitIds }, active: true },
        });
      } else {
        // Default to all active users with PQC keys enrolled
        targetUsers = await prisma.user.findMany({
          where: { active: true, kemPublicKey: { not: null } },
        });
      }

      // Per-recipient ML-KEM-768 broadcast encapsulation
      let encapsulatedCount = 0;
      for (const recipient of targetUsers) {
        if (!recipient.kemPublicKey) continue;
        const { sharedSecret, ciphertext: kemCiphertext } = encapsulateKey(recipient.kemPublicKey);
        const {
          ciphertext: encKey,
          iv: keyIv,
          authTag: keyTag,
        } = encrypt(contentKey, sharedSecret);

        await prisma.assetKeyEncapsulation.create({
          data: {
            assetId: asset.id,
            userId: recipient.id,
            kemCiphertext: Buffer.from(kemCiphertext),
            encryptedKey: encKey,
            iv: keyIv,
            authTag: keyTag,
          },
        });
        encapsulatedCount++;
      }

      res.status(201).json({
        assetId: asset.id,
        title: asset.title,
        sha256: Buffer.from(asset.originalSha).toString('hex'),
        sizeBytes: asset.sizeBytes,
        encapsulatedCount,
      });
    } catch (err) {
      next(err);
    }
  }
);

// -------------------------------------------------- GET /api/assets ---------
router.get('/', requireCap('assets:read'), async (_req, res, next) => {
  try {
    const rows = await prisma.asset.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { events: true, encapsulations: true } },
        encapsulations: { select: { userId: true } },
      },
    });

    res.json({
      assets: rows.map((a) => ({
        assetId: a.id,
        title: a.title,
        classification: a.classification,
        createdAt: a.createdAt.toISOString(),
        decryptCount: a._count.events,
        encapsulationCount: a._count.encapsulations,
        authorizedUserIds: a.encapsulations.map((e) => e.userId),
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------- GET /api/assets/:id ---------
router.get('/:assetId', requireCap('assets:read'), async (req, res, next) => {
  try {
    const assetId = Number(req.params.assetId);
    if (!Number.isInteger(assetId)) throw badInput('assetId must be an integer');

    const a = await prisma.asset.findUnique({
      where: { id: assetId },
      include: {
        _count: { select: { events: true, encapsulations: true } },
        encapsulations: { select: { userId: true } },
      },
    });
    if (!a) throw notFound(`No asset ${assetId}`);

    res.json({
      assetId: a.id,
      title: a.title,
      classification: a.classification,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
      sha256: Buffer.from(a.originalSha).toString('hex'),
      assetRef: bufferToHex(a.assetRef),
      createdAt: a.createdAt.toISOString(),
      decryptCount: a._count.events,
      encapsulationCount: a._count.encapsulations,
      authorizedUserIds: a.encapsulations.map((e) => e.userId),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
