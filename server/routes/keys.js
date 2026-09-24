import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { badInput, notFound, forbidden } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { generatePqcKeyPair, PQC_ALGORITHMS } from '../core/pqc.js';
import { encapsulateFor, keyColumns, recoverContentKey } from '../lib/keyring.js';
import { bufferToHex } from '../lib/refs.js';

/**
 * Key management API for Post-Quantum Cryptography (NIST ML-KEM-768 and ML-DSA-65).
 *
 * Public keys are freely readable by authenticated peers for broadcast encapsulation
 * and digital signature verification.
 *
 * Encrypted private key bundles are accessible only by the owner or an ADMIN.
 */
const router = Router();

// ------------------------------------ GET /api/keys/public/:userId -----------
router.get('/public/:userId', requireAuth, async (req, res, next) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isInteger(userId) || userId <= 0) {
      throw badInput('Invalid userId');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        dept: true,
        role: true,
        userRef: true,
        kemPublicKey: true,
        dsaPublicKey: true,
      },
    });

    if (!user) throw notFound(`User ${userId} not found`);

    res.json({
      userId: user.id,
      name: user.name,
      dept: user.dept,
      role: user.role,
      userRef: bufferToHex(user.userRef),
      algorithms: PQC_ALGORITHMS,
      kemPublicKey: user.kemPublicKey ? Buffer.from(user.kemPublicKey).toString('hex') : null,
      dsaPublicKey: user.dsaPublicKey ? Buffer.from(user.dsaPublicKey).toString('hex') : null,
      hasPqcKeys: Boolean(user.kemPublicKey && user.dsaPublicKey),
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------ GET /api/keys/bundle -------------------
router.get('/bundle', requireAuth, async (req, res, next) => {
  try {
    const targetUserId = req.query.userId ? Number(req.query.userId) : req.user.id;
    if (targetUserId !== req.user.id && req.user.role !== 'ADMIN') {
      throw forbidden('You may only fetch your own encrypted PQC key bundle.');
    }

    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: {
        id: true,
        encryptedPqcKeys: true,
        kemPublicKey: true,
        dsaPublicKey: true,
      },
    });

    if (!user) throw notFound(`User ${targetUserId} not found`);

    res.json({
      userId: user.id,
      algorithms: PQC_ALGORITHMS,
      encryptedPqcKeys: user.encryptedPqcKeys,
      kemPublicKey: user.kemPublicKey ? Buffer.from(user.kemPublicKey).toString('hex') : null,
      dsaPublicKey: user.dsaPublicKey ? Buffer.from(user.dsaPublicKey).toString('hex') : null,
    });
  } catch (err) {
    next(err);
  }
});

const GenerateBody = z.object({
  userId: z.coerce.number().int().positive().optional(),
  passphrase: z.string().min(6, 'Passphrase must be at least 6 characters'),
});

// ------------------------------------ POST /api/keys/generate ----------------
router.post('/generate', requireAuth, validate(GenerateBody), async (req, res, next) => {
  try {
    const targetUserId = req.valid.userId ?? req.user.id;
    if (targetUserId !== req.user.id && req.user.role !== 'ADMIN') {
      throw forbidden('You may only generate PQC keys for yourself.');
    }

    const user = await prisma.user.findUnique({ where: { id: targetUserId } });
    if (!user) throw notFound(`User ${targetUserId} not found`);

    // Recover every content key this user can currently open *before* their
    // keys are replaced, so their documents can be re-encapsulated to the new
    // pair. Recovery goes through the escrow; nothing is guessed.
    const theirs = await prisma.assetKeyEncapsulation.findMany({
      where: { userId: targetUserId },
      select: { assetId: true },
    });
    const keysByAsset = new Map();
    for (const { assetId } of theirs) {
      const contentKey = await recoverContentKey(assetId, targetUserId);
      if (contentKey) keysByAsset.set(assetId, contentKey);
    }

    const pqc = generatePqcKeyPair();
    const updated = await prisma.user.update({
      where: { id: targetUserId },
      data: keyColumns(pqc, req.valid.passphrase),
    });

    // Re-encapsulate to the new public key; allotted passphrases are kept.
    for (const [assetId, contentKey] of keysByAsset) {
      await encapsulateFor(assetId, updated, contentKey);
    }

    res.json({
      userId: targetUserId,
      algorithms: PQC_ALGORITHMS,
      kemPublicKey: Buffer.from(pqc.kemPublicKey).toString('hex'),
      dsaPublicKey: Buffer.from(pqc.dsaPublicKey).toString('hex'),
      enrolled: true,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
