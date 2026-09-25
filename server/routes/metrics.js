import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

import { ROOT, env } from '../lib/env.js';
import { prisma } from '../lib/prisma.js';
import { requireCap } from '../middleware/auth.js';

/**
 * Serves whatever `test/attack-suite.js` last wrote to `test/metrics.json`:
 * the eight-attack survival table and the PSNR-vs-delta curve. The frontend
 * charts it directly.
 *
 * Also computes real-time production telemetry from DecryptionEvent rows in PostgreSQL.
 */
const router = Router();

const METRICS_PATH = path.join(ROOT, 'test', 'metrics.json');

router.get('/', requireCap('metrics:read'), async (req, res, next) => {
  try {
    // Telemetry can be narrowed to one classification, so a reviewer can ask
    // whether the marks hold up on SECRET material specifically rather than
    // only in aggregate across everything released.
    const classification = String(req.query.classification || 'ALL').toUpperCase();
    const scoped = classification !== 'ALL' ? { asset: { classification } } : undefined;
    const raw = await fs.readFile(METRICS_PATH, 'utf8').catch(() => null);

    // Compute live telemetry from actual DecryptionEvents in PostgreSQL
    const recentEvents = await prisma.decryptionEvent.findMany({
      where: scoped,
      take: 50,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        deltaUsed: true,
        psnrDb: true,
        createdAt: true,
        asset: { select: { classification: true } },
      },
    });

    const totalEvents = await prisma.decryptionEvent.count({ where: scoped });

    // PSNR only from releases where it was measured. A PDF release has no
    // single raster to compare and is stored as 0; averaging those in as if
    // they were real 0 dB copies is what made these figures jump about.
    const measured = recentEvents.filter((e) => Number.isFinite(e.psnrDb) && e.psnrDb > 0);
    const round1 = (v) => Math.round(v * 10) / 10;
    const psnrs = measured.map((e) => e.psnrDb);
    const avgPsnr = psnrs.length ? round1(psnrs.reduce((a, b) => a + b, 0) / psnrs.length) : 0;
    const minPsnr = psnrs.length ? round1(Math.min(...psnrs)) : null;
    const maxPsnr = psnrs.length ? round1(Math.max(...psnrs)) : null;

    const live = {
      classification,
      totalDecryptions: totalEvents,
      sampleCount: recentEvents.length,
      measuredCount: measured.length,
      avgPsnr,
      minPsnr,
      maxPsnr,
      // The quantization step actually used, not a nominal range: the spread
      // over recent releases, or the configured value before there are any.
      minDelta: recentEvents.length
        ? Math.min(...recentEvents.map((e) => e.deltaUsed))
        : env.watermarkDelta,
      maxDelta: recentEvents.length
        ? Math.max(...recentEvents.map((e) => e.deltaUsed))
        : env.watermarkDelta,
      history: measured
        .map((e, idx) => ({
          index: measured.length - idx,
          psnrDb: Math.round(e.psnrDb * 10) / 10,
          delta: e.deltaUsed,
          classification: e.asset?.classification,
          time: e.createdAt,
        }))
        .reverse(),
    };

    if (raw === null) {
      return res.json({
        attacks: [],
        psnrCurve: [],
        source: 'not-run',
        generatedAt: null,
        hint: 'Run `npm run attack:suite` to generate test/metrics.json.',
        live,
      });
    }

    const parsed = JSON.parse(raw);
    res.json({
      attacks: parsed.attacks ?? [],
      psnrCurve: parsed.psnrCurve ?? [],
      source: parsed.source ?? 'measured',
      generatedAt: parsed.generatedAt ?? null,
      live,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
