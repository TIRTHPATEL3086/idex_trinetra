import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';

import { ROOT } from '../lib/env.js';
import { requireCap } from '../middleware/auth.js';

/**
 * Serves whatever `test/attack-suite.js` last wrote to `test/metrics.json`:
 * the eight-attack survival table and the PSNR-vs-delta curve. The frontend
 * charts it directly.
 *
 * Before the suite has been run the file does not exist, and this returns empty
 * arrays with `source: "not-run"`. It never invents numbers — a chart of made-up
 * robustness figures is worse than no chart.
 */
const router = Router();

const METRICS_PATH = path.join(ROOT, 'test', 'metrics.json');

router.get('/', requireCap('metrics:read'), async (_req, res, next) => {
  try {
    const raw = await fs.readFile(METRICS_PATH, 'utf8').catch(() => null);

    if (raw === null) {
      return res.json({
        attacks: [],
        psnrCurve: [],
        source: 'not-run',
        generatedAt: null,
        hint: 'Run `npm run attack:suite` to generate test/metrics.json.',
      });
    }

    const parsed = JSON.parse(raw);
    res.json({
      attacks: parsed.attacks ?? [],
      psnrCurve: parsed.psnrCurve ?? [],
      source: parsed.source ?? 'measured',
      generatedAt: parsed.generatedAt ?? null,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
