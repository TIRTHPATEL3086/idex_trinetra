import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { mockAudit } from '../lib/mocks.js';
import { notFound } from '../lib/errors.js';
import { bufferToHex } from '../lib/refs.js';
import { validateParams } from '../middleware/validate.js';
import * as chain from '../core/chain.js';

/**
 * B9 — the per-asset audit trail. Powers C6: who opened this document, when,
 * from which device, each row linking to Etherscan.
 *
 * Note what this route returns and what it does not: the name comes from
 * Postgres, the txHash comes from the event row. C renders them in two clearly
 * labelled panels — "On-chain (hashed)" and "Internal registry" — because the
 * visual separation is what sells the privacy design in two seconds (§7.2).
 */
const router = Router();

const Params = z.object({ assetId: z.coerce.number().int().positive() });

router.get('/:assetId', validateParams(Params), async (req, res, next) => {
  try {
    const { assetId } = req.valid;

    if (env.mockMode) return res.json({ ...mockAudit, assetId });

    const asset = await prisma.asset.findUnique({ where: { id: assetId } });
    if (!asset) throw notFound(`No asset ${assetId}`);

    const events = await prisma.decryptionEvent.findMany({
      where: { assetId },
      orderBy: { createdAt: 'desc' },
      include: { user: true },
    });

    res.json({
      assetId,
      assetTitle: asset.title,
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
});

export default router;
