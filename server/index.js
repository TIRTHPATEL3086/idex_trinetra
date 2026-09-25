import path from 'node:path';
import express from 'express';
import cors from 'cors';

// Enable clean JSON serialization for BigInt values across all Express routes
BigInt.prototype.toJSON = function () {
  return this.toString();
};

import { env, ROOT, warnAboutConfig } from './lib/env.js';
import { prisma, dbStatus } from './lib/prisma.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { attachUser } from './middleware/auth.js';
import * as bktree from './core/bktree.js';
import * as chain from './core/chain.js';

import authRouter from './routes/auth.js';
import healthRouter from './routes/health.js';
import assetsRouter from './routes/assets.js';
import usersRouter from './routes/users.js';
import decryptRouter, { filesRouter } from './routes/decrypt.js';
import traceRouter from './routes/trace.js';
import auditRouter from './routes/audit.js';
import metricsRouter from './routes/metrics.js';
import keysRouter from './routes/keys.js';

/**
 * The Express application: routes, CORS, the shared error shape, and a boot
 * sequence that builds the search index from PostgreSQL.
 */

const app = express();

// Trust reverse proxy headers (required on Render, Heroku, AWS for secure cookies)
app.set('trust proxy', 1);

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

// Decode the session cookie on every request. This never rejects — it only
// populates `req.user`; the individual routes decide what that entitles you to.
app.use(attachUser);

// ------------------------------------------------------------- routes ------
// /auth and /health stay open: the login screen itself needs to render, and it
// shows the system status chip before anyone has signed in.
app.use('/api/auth', authRouter);
app.use('/api/health', healthRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/users', usersRouter);
app.use('/api/decrypt', decryptRouter);
app.use('/api/trace', traceRouter);
app.use('/api/audit', auditRouter);
app.use('/api/metrics', metricsRouter);
app.use('/api/keys', keysRouter);
app.use('/api/files', filesRouter);

// ------------------------------------------------ field kit: one port -----
// The offline field kit (npm run offline) serves the built web app from this
// same process, so the whole system is one address with nothing to fetch from
// the internet. In development Vite serves the client instead.
if (process.env.SERVE_CLIENT === '1') {
  const dist = path.join(ROOT, 'client', 'dist');
  app.use(express.static(dist, { index: false }));
  app.get(/^(?!\/api\/).*/, (req, res, next) => {
    if (!req.accepts('html')) return next();
    res.sendFile(path.join(dist, 'index.html'));
  });
}

// Root landing endpoint
app.get('/', (req, res) => {
  const frontendUrl = env.corsOrigin[0] || 'http://localhost:5173';
  if (req.accepts('html')) {
    return res.send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <title>Crypto Decryption Provenance API</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0b0f19; color: #f3f4f6; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .card { background: #111827; border: 1px solid #1f2937; padding: 2rem 2.5rem; border-radius: 1rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5); max-width: 480px; width: 100%; text-align: center; }
          .badge { display: inline-block; background: #064e3b; color: #34d399; font-size: 0.75rem; font-weight: 600; padding: 0.25rem 0.75rem; border-radius: 9999px; margin-bottom: 1rem; border: 1px solid #059669; }
          h1 { font-size: 1.5rem; margin: 0 0 0.5rem; color: #fff; }
          p { color: #9ca3af; font-size: 0.95rem; line-height: 1.5; margin: 0 0 1.5rem; }
          .btn { display: inline-block; background: #2563eb; color: #fff; text-decoration: none; padding: 0.75rem 1.5rem; border-radius: 0.5rem; font-weight: 600; transition: background 0.2s; }
          .btn:hover { background: #1d4ed8; }
          .links { margin-top: 1.5rem; font-size: 0.85rem; color: #6b7280; display: flex; justify-content: center; gap: 1rem; }
          .links a { color: #60a5fa; text-decoration: none; }
        </style>
      </head>
      <body>
        <div class="card">
          <span class="badge">&#9679; API Server Online</span>
          <h1>Backend API Running</h1>
          <p>This is the REST API service (Port 4000). The web application interface is running on Port 5173.</p>
          <a class="btn" href="${frontendUrl}">Open Frontend Dashboard (5173) &rarr;</a>
          <div class="links">
            <a href="/api/health">/api/health</a>
            <a href="/api/auth/me">/api/auth/me</a>
          </div>
        </div>
      </body>
      </html>
    `);
  }
  res.json({
    name: 'SIH26237 — Crypto Decryption Provenance API',
    status: 'online',
    frontend: frontendUrl,
    endpoints: {
      health: '/api/health',
      auth: '/api/auth/me',
      assets: '/api/assets',
    },
  });
});

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

  const server = app.listen(env.port, () => {
    console.log('  ' + '─'.repeat(58));
    console.log(`  API      http://localhost:${env.port}/api/health`);
    console.log(`  CORS     ${env.corsOrigin.join(', ')}`);
    console.log(`  DELTA    ${env.watermarkDelta}`);
    console.log('');
  });

  // A clear message beats an unhandled 'error' stack trace when the port is
  // already taken — the single most common thing to go wrong on boot.
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  Port ${env.port} is already in use.`);
      console.error(`  Stop whatever is on it, or set PORT to a free port in .env.\n`);
    } else {
      console.error('\n  Server error:', err.message, '\n');
    }
    process.exit(1);
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
