import express from 'express';
import cors from 'cors';

import { env, warnAboutConfig } from './lib/env.js';
import { prisma, dbStatus } from './lib/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import * as bktree from './core/bktree.js';
import * as chain from './core/chain.js';

import healthRouter from './routes/health.js';
import assetsRouter from './routes/assets.js';
import usersRouter from './routes/users.js';
import decryptRouter, { filesRouter } from './routes/decrypt.js';
import traceRouter from './routes/trace.js';
import auditRouter from './routes/audit.js';
import metricsRouter from './routes/metrics.js';

/**
 * The Express application: routes, CORS, the shared error shape, and a boot
 * sequence that builds the search index from PostgreSQL.
 */

const app = express();

app.use(
  cors({
    origin: (origin, cb) => {
      // Same-origin/curl requests have no Origin header — always allow those.
      if (!origin || env.corsOrigin.includes(origin)) return cb(null, true);
      cb(new Error(`CORS: ${origin} is not in CORS_ORIGIN`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Request log — one line each, so a failing demo is diagnosable in real time.
app.use((req, res, next) => {
  const t = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${Date.now() - t}ms`);
  });
  next();
});

// ------------------------------------------------------------- routes ------
app.use('/api/health', healthRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/users', usersRouter);
app.use('/api/decrypt', decryptRouter);
app.use('/api/trace', traceRouter);
app.use('/api/audit', auditRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/files', filesRouter);

app.use(notFoundHandler);
app.use(errorHandler);

// --------------------------------------------------------------- boot ------
async function start() {
  console.log('');
  console.log('  SIH26237 — Crypto Decryption Provenance');
  console.log('  ' + '─'.repeat(58));

  warnAboutConfig((msg) => console.log('  ' + msg));

  // Build the BK-tree from Postgres. A dead DB must not stop the server from
  // booting; the health endpoint reports it instead.
  const db = await dbStatus();
  if (db === 'up') {
    try {
      await bktree.rebuild(prisma, (m) => console.log('  ' + m));
    } catch (err) {
      console.warn(`  [bktree] rebuild failed: ${err.message}`);
    }
  } else {
    console.warn('  [db] PostgreSQL unreachable — search index not built.');
    console.warn('  [db] docker run -e POSTGRES_PASSWORD=dev -p 5432:5432 -d postgres:16');
  }

  const chainInfo = await chain.chainStatus();
  console.log(
    `  [chain] mode=${chainInfo.mode} connected=${chainInfo.connected}` +
      (chainInfo.address ? ` at ${chainInfo.address}` : '')
  );

  app.listen(env.port, () => {
    console.log('  ' + '─'.repeat(58));
    console.log(`  API      http://localhost:${env.port}/api/health`);
    console.log(`  CORS     ${env.corsOrigin.join(', ')}`);
    console.log(`  DELTA    ${env.watermarkDelta}`);
    console.log('');
  });
}

// Never leave a Postgres connection pool dangling on Ctrl-C.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, async () => {
    console.log(`\n  ${signal} — shutting down.`);
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  });
}

start().catch((err) => {
  console.error('Failed to start:', err);
  process.exit(1);
});

export default app;
