import { Router } from 'express';

import { env } from '../lib/env.js';
import { dbStatus } from '../lib/prisma.js';
import * as chain from '../core/chain.js';
import * as bktree from '../core/bktree.js';
import { fallbacksInUse } from '../core/index.js';

/**
 * The first thing C hits, and the first thing to check at the venue when
 * anything looks wrong. It answers, in one request:
 *   - is the API up
 *   - are we serving mocks
 *   - is Postgres reachable
 *   - is the chain reachable, and in which mode
 *   - is the search index built
 *   - IS ANYTHING STILL RUNNING ON A STAND-IN INSTEAD OF A's REAL CODE
 *
 * That last field is deliberately loud. Discovering a fallback on stage is the
 * worst possible time to discover it.
 */
const router = Router();

const bootedAt = Date.now();

router.get('/', async (_req, res, next) => {
  try {
    const [db, chainInfo] = await Promise.all([dbStatus(), chain.chainStatus()]);
    const fallbacks = fallbacksInUse();

    res.json({
      ok: true,
      mockMode: env.mockMode,
      chainMode: chainInfo.mode,
      db,
      uptimeSec: Math.round((Date.now() - bootedAt) / 1000),

      chain: {
        mode: chainInfo.mode,
        connected: chainInfo.connected,
        address: chainInfo.address,
        blockNumber: chainInfo.blockNumber,
        ...(chainInfo.error ? { error: chainInfo.error } : {}),
      },
      index: bktree.stats(),

      // Loud on purpose — see the comment above.
      coreFallback: fallbacks,
      coreReady: fallbacks.length === 0,
      warnings: buildWarnings({ db, chainInfo, fallbacks }),
    });
  } catch (err) {
    next(err);
  }
});

function buildWarnings({ db, chainInfo, fallbacks }) {
  const w = [];
  if (env.mockMode) w.push('MOCK_MODE=true — routes are returning fixtures, not real data.');
  if (db !== 'up') w.push('PostgreSQL is not reachable. Check DATABASE_URL.');
  if (chainInfo.mode === 'off') w.push('CHAIN_MODE=off — receipts are not being anchored.');
  if (chainInfo.mode !== 'off' && !chainInfo.connected) {
    w.push(`Chain mode "${chainInfo.mode}" is configured but not connected.`);
  }
  if (fallbacks.length) {
    w.push(
      `Running stand-ins instead of Person A's core: ${fallbacks.join(', ')}. ` +
        `DO NOT DEMO IN THIS STATE.`
    );
  }
  return w;
}

export default router;
