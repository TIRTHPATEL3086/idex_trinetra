import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { bufferToHex } from '../lib/refs.js';
import { validateParams } from '../middleware/validate.js';
import { requireAnyCap } from '../middleware/auth.js';
import { can } from '../lib/permissions.js';
import * as chain from '../core/chain.js';

/**
 * The per-asset audit trail: who opened this document, when, from which
 * device, and the transaction that proves it.
 *
 * Both `userName` (from Postgres) and `userRef` (the hashed handle that
 * reaches the chain) are returned. They are meant to be rendered as separate,
 * labelled groups — never side by side as if they were the same fact.
 */
const router = Router();

const Params = z.object({ assetId: z.coerce.number().int().positive() });

router.get(
  '/:assetId',
  requireAnyCap('audit:read', 'audit:own'),
  validateParams(Params),
  async (req, res, next) => {
    try {
      const { assetId } = req.valid;

      const asset = await prisma.asset.findUnique({ where: { id: assetId } });
      if (!asset) throw notFound(`No asset ${assetId}`);

      // An officer holds 'audit:own' but not 'audit:read': they see their own
      // releases of this document and nobody else's. Who else opened a file is
      // exactly the kind of fact that turns an audit trail into gossip.
      const ownOnly = !can(req.user.role, 'audit:read');

      const events = await prisma.decryptionEvent.findMany({
        where: ownOnly ? { assetId, userId: req.user.id } : { assetId },
        orderBy: { createdAt: 'desc' },
        include: { user: true },
      });

      res.json({
        assetId,
        assetTitle: asset.title,
        scope: ownOnly ? 'own' : 'all',
        timeline: events.map((e) => {
          const txHash = bufferToHex(e.txHash);
          return {
            receiptId: bufferToHex(e.receiptId),
            userName: e.user.name,
            department: e.user.dept,
            at: e.createdAt.toISOString(),
            device: e.deviceLabel,
            txHash,
            etherscanUrl: chain.buildEtherscanUrl(txHash),
            blockNumber: e.blockNumber !== null ? Number(e.blockNumber) : null,
            psnrDb: e.psnrDb,
            deltaUsed: e.deltaUsed,
            // The hashed identity — this is the one that is safe to render next
            // to the chain fields. `userName` above is Postgres-only.
            userRef: bufferToHex(e.user.userRef),
          };
        }),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
