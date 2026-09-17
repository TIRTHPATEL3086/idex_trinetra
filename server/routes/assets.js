import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { env, masterKey } from '../lib/env.js';
import { badInput, notFound } from '../lib/errors.js';
import { assetRef, hexToBuffer, bufferToHex } from '../lib/refs.js';
import { singleFile } from '../middleware/upload.js';
import { validate } from '../middleware/validate.js';
import { encrypt, sha256 } from '../core/index.js';

/**
 * Upload -> SHA-256 -> AES-256-GCM encrypt -> store -> list.
 *
 * The plaintext is never written to disk. Multer keeps it in memory, we encrypt
 * it in memory, and only the ciphertext reaches `data/cipher/`. That is what
 * lets us say the system holds no readable copy of a protected document.
 */
const router = Router();

const UploadBody = z.object({
  title: z.string().trim().min(1, 'title is required').max(200),
  classification: z
    .enum(['RESTRICTED', 'CONFIDENTIAL', 'SECRET'])
    .optional()
    .default('CONFIDENTIAL'),
});

// ------------------------------------------------- POST /api/assets ---------
router.post('/', singleFile, validate(UploadBody), async (req, res, next) => {
  try {
    if (!req.file) throw badInput('No file uploaded. Send multipart field "file".');

    const plaintext = req.file.buffer;
    const originalSha = sha256(plaintext);

    // Encrypt before anything touches the filesystem.
    const { ciphertext, iv, authTag } = encrypt(plaintext, masterKey());

    await fs.mkdir(env.cipherDir, { recursive: true });

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
    await fs.writeFile(cipherPath, ciphertext);

    const asset = await prisma.asset.update({
      where: { id: created.id },
      data: {
        cipherPath,
        assetRef: hexToBuffer(assetRef(created.id)),
      },
    });

    res.status(201).json({
      assetId: asset.id,
      title: asset.title,
      sha256: Buffer.from(asset.originalSha).toString('hex'),
      sizeBytes: asset.sizeBytes,
    });
  } catch (err) {
    next(err);
  }
});

// -------------------------------------------------- GET /api/assets ---------
router.get('/', async (_req, res, next) => {
  try {
    const rows = await prisma.asset.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { events: true } } },
    });

    res.json({
      assets: rows.map((a) => ({
        assetId: a.id,
        title: a.title,
        classification: a.classification,
        createdAt: a.createdAt.toISOString(),
        decryptCount: a._count.events,
      })),
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------- GET /api/assets/:id ---------
router.get('/:assetId', async (req, res, next) => {
  try {
    const assetId = Number(req.params.assetId);
    if (!Number.isInteger(assetId)) throw badInput('assetId must be an integer');

    const a = await prisma.asset.findUnique({
      where: { id: assetId },
      include: { _count: { select: { events: true } } },
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
    });
  } catch (err) {
    next(err);
  }
});

export default router;
