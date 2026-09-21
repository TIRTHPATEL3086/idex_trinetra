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

      const timeline = events.map((e, index) => {
        const txHash = bufferToHex(e.txHash);
        const eventDate = new Date(e.createdAt);
        const hour = eventDate.getHours();
        const day = eventDate.getDay(); // 0 = Sun, 6 = Sat

        // 1. Off-hours: outside 08:00 - 19:00 or weekend
        const isOffHours = hour < 8 || hour >= 19 || day === 0 || day === 6;

        // 2. Velocity burst: if previous decryption by same officer was within 10 minutes (600s)
        let isBurst = false;
        let burstGapSec = null;
        for (let j = index + 1; j < events.length; j++) {
          if (events[j].userId === e.userId) {
            const gap = Math.round((eventDate.getTime() - new Date(events[j].createdAt).getTime()) / 1000);
            if (gap >= 0 && gap <= 600) {
              isBurst = true;
              burstGapSec = gap;
            }
            break;
          }
        }

        // 3. Device anomaly: unverified/unknown hardware or un-enrolled endpoint
        const dev = (e.deviceLabel || '').toUpperCase();
        const isDeviceAnomaly = !dev || dev.includes('UNKNOWN') || dev.includes('EXTERNAL') || dev.includes('MOBILE');

        // Anomaly warnings list
        const anomalies = [];
        if (isOffHours) anomalies.push(`Off-hours access (${String(hour).padStart(2, '0')}:${String(eventDate.getMinutes()).padStart(2, '0')})`);
        if (isBurst) anomalies.push(`Mass exfiltration burst (${burstGapSec}s gap)`);
        if (isDeviceAnomaly) anomalies.push(`Unverified endpoint hardware (${e.deviceLabel || 'UNKNOWN'})`);

        let riskLevel = 'LOW';
        if (anomalies.length >= 2 || (isBurst && isOffHours)) riskLevel = 'CRITICAL';
        else if (anomalies.length === 1) riskLevel = 'ELEVATED';

        return {
          id: e.id,
          receiptId: bufferToHex(e.receiptId),
          userId: e.user.id,
          userName: e.user.name,
          userActive: e.user.active,
          department: e.user.dept,
          at: e.createdAt.toISOString(),
          device: e.deviceLabel,
          txHash,
          etherscanUrl: chain.buildEtherscanUrl(txHash),
          blockNumber: e.blockNumber !== null ? Number(e.blockNumber) : null,
          psnrDb: e.psnrDb,
          deltaUsed: e.deltaUsed,
          userRef: bufferToHex(e.user.userRef),
          isOffHours,
          isBurst,
          isDeviceAnomaly,
          riskLevel,
          anomalies,
        };
      });

      res.json({
        assetId,
        assetTitle: asset.title,
        scope: ownOnly ? 'own' : 'all',
        timeline,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
