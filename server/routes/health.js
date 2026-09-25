import { Router } from 'express';

import { env } from '../lib/env.js';
import { dbStatus } from '../lib/prisma.js';
import { networkProfile } from '../lib/network.js';
import * as chain from '../core/chain.js';
import * as bktree from '../core/bktree.js';

/**
 * One request that answers everything worth knowing when something looks wrong:
 * is Postgres reachable, is the chain connected and in which mode, and is the
 * search index built. `warnings` spells out anything degraded in plain English
 * so nobody has to read logs to find out.
 */
const router = Router();

const bootedAt = Date.now();

router.get('/', async (_req, res, next) => {
  try {
    const [db, chainInfo] = await Promise.all([dbStatus(), chain.chainStatus()]);

    res.json({
      ok: true,
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
      watermark: { delta: env.watermarkDelta },
      network: networkProfile(),

      warnings: buildWarnings({ db, chainInfo }),
    });
  } catch (err) {
    next(err);
  }
});

function buildWarnings({ db, chainInfo }) {
  const w = [];
  if (db !== 'up') w.push('PostgreSQL is not reachable. Check DATABASE_URL.');
  if (chainInfo.mode === 'off') w.push('CHAIN_MODE=off — receipts are not being anchored.');
  if (chainInfo.mode !== 'off' && !chainInfo.connected) {
    w.push(`Chain mode "${chainInfo.mode}" is configured but not connected.`);
  }
  if (!bktree.isReady()) w.push('Search index has not been built.');
  return w;
}

export default router;
