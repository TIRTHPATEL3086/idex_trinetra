import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { bufferToHex } from '../lib/refs.js';
import { validateParams, validate } from '../middleware/validate.js';
import { requireAnyCap, requireCap } from '../middleware/auth.js';
import { can } from '../lib/permissions.js';
import * as chain from '../core/chain.js';

/**
 * Audit trail routes.
 *
 * GET /api/audit/global      — ADMIN/INVESTIGATOR only. ALL decryption events, paginated.
 *                               The forensic command centre: who opened what, when, from where.
 *                               Data is stored permanently in PostgreSQL — never resets.
 *
 * GET /api/audit/:assetId   — Per-asset trail. Officers see only their own releases.
 */
const router = Router();

// ─────────────────────────────── GET /api/audit/global ─────────────────────
/**
 * Global immutable audit history — every DecryptionEvent ever recorded.
 * Paginated: ?page=1&limit=50
 * Filterable: ?userId=&assetId=&from=ISO&to=ISO
 *
 * This data NEVER resets regardless of logout or server restart.
 * It lives in PostgreSQL and is the authoritative forensic record.
 */
const GlobalQuery = z.object({
  page:    z.coerce.number().int().min(1).optional().default(1),
  limit:   z.coerce.number().int().min(1).max(200).optional().default(50),
  userId:  z.coerce.number().int().positive().optional(),
  assetId: z.coerce.number().int().positive().optional(),
  from:    z.string().datetime({ offset: true }).optional(),
  to:      z.string().datetime({ offset: true }).optional(),
});

router.get(
  '/global',
  requireCap('audit:read'),
  validate(GlobalQuery, 'query'),
  async (req, res, next) => {
    try {
      const { page, limit, userId, assetId, from, to } = req.valid;
      const skip = (page - 1) * limit;

      const where = {
        ...(userId  ? { userId }  : {}),
        ...(assetId ? { assetId } : {}),
        ...(from || to
          ? {
              createdAt: {
                ...(from ? { gte: new Date(from) } : {}),
                ...(to   ? { lte: new Date(to)   } : {}),
              },
            }
          : {}),
      };

      const [events, total] = await Promise.all([
        prisma.decryptionEvent.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          skip,
          take: limit,
          include: { user: true, asset: true },
        }),
        prisma.decryptionEvent.count({ where }),
      ]);

      res.json({
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        events: events.map((e) => {
          const txHash = bufferToHex(e.txHash);
          return {
            id: e.id,
            receiptId:       bufferToHex(e.receiptId),
            shortId:         e.shortId ? e.shortId.toString() : null,
            userName:        e.user?.name,
            department:      e.user?.dept,
            role:            e.user?.role,
            assetTitle:      e.asset?.title,
            assetClassification: e.asset?.classification,
            at:              e.createdAt.toISOString(),
            device:          e.deviceLabel,
            txHash,
            etherscanUrl:    chain.buildEtherscanUrl(txHash),
            blockNumber:     e.blockNumber !== null ? Number(e.blockNumber) : null,
            chainMode:       e.chainMode,
            psnrDb:          e.psnrDb,
            deltaUsed:       e.deltaUsed,
            signatureAlgorithm: e.signatureAlgorithm,
            signatureCommit: bufferToHex(e.signatureCommit),
            userRef:         bufferToHex(e.user?.userRef),
          };
        }),
      });
    } catch (err) {
      next(err);
    }
  }
);

// ─────────────────────────────── GET /api/audit/:assetId ────────────────────
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
        timeline: events.map((e) => {
          const txHash = bufferToHex(e.txHash);
          return {
            receiptId:    bufferToHex(e.receiptId),
            userName:     e.user.name,
            department:   e.user.dept,
            at:           e.createdAt.toISOString(),
            device:       e.deviceLabel,
            txHash,
            etherscanUrl: chain.buildEtherscanUrl(txHash),
            blockNumber:  e.blockNumber !== null ? Number(e.blockNumber) : null,
            psnrDb:       e.psnrDb,
            deltaUsed:    e.deltaUsed,
            signatureAlgorithm: e.signatureAlgorithm,
            userRef:      bufferToHex(e.user.userRef),
          };
        }),
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
