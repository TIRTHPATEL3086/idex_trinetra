import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

import { env, ROOT } from '../lib/env.js';
import { mockMetrics } from '../lib/mocks.js';

/**
 * B9 — serves whatever Person A's `test/attack-suite.js` last wrote to
 * `test/metrics.json`. C's Recharts screens (C7) read this directly.
 *
 * Until A's suite has run, we serve the fixture and set `source: "fixture"` so
 * the UI can badge it honestly. Never present target numbers as measured ones.
 */
const router = Router();

const METRICS_PATH = path.join(ROOT, 'test', 'metrics.json');

router.get('/', async (_req, res, next) => {
  try {
    if (env.mockMode) {
      return res.json({ ...mockMetrics, source: 'fixture', generatedAt: null });
    }

    try {
      const raw = await fs.readFile(METRICS_PATH, 'utf8');
      const parsed = JSON.parse(raw);
      return res.json({
        attacks: parsed.attacks ?? [],
        psnrCurve: parsed.psnrCurve ?? [],
        source: parsed.source ?? 'measured',
        generatedAt: parsed.generatedAt ?? null,
      });
    } catch {
      // test/metrics.json not written yet — A's suite has not run.
      return res.json({ ...mockMetrics, source: 'fixture', generatedAt: null });
    }
  } catch (err) {
    next(err);
  }
});

export default router;
