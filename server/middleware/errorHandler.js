import multer from 'multer';
import { ZodError } from 'zod';
import { ApiError, badInput, tooLarge, notFound } from '../lib/errors.js';
import { env } from '../lib/env.js';

/** 404 for anything that reached the end of the router stack. */
export function notFoundHandler(req, _res, next) {
  next(notFound(`No route for ${req.method} ${req.originalUrl}`));
}

/**
 * The last middleware. Everything the API returns on failure passes through
 * here, so this shape is guaranteed:
 *   { "error": { "code": "...", "message": "..." } }
 *
 * The unused `_next` is required: Express only treats a handler as an error
 * handler when it declares all four arguments.
 */
export function errorHandler(err, req, res, _next) {
  let apiError;

  if (err instanceof ApiError) {
    apiError = err;
  } else if (err instanceof ZodError) {
    apiError = badInput(err.errors.map((e) => `${e.path.join('.')}: ${e.message}`).join('; '));
  } else if (err instanceof multer.MulterError) {
    apiError =
      err.code === 'LIMIT_FILE_SIZE'
        ? tooLarge(`File is larger than the ${env.maxUploadMb} MB limit.`)
        : badInput(`Upload failed: ${err.message}`);
  } else if (err?.code === 'P2025') {
    apiError = notFound('That record does not exist.');
  } else if (err?.code === 'P2002') {
    apiError = badInput('That record already exists (unique constraint).');
  } else if (isDbUnavailable(err)) {
    // Connection / auth failures — Postgres not running, or wrong credentials.
    // These carry no P1xxx code, so match by class name too, and never leak the
    // raw driver message (it can include the connection string).
    apiError = new ApiError(
      'INTERNAL',
      'Database unavailable. Is PostgreSQL running and DATABASE_URL correct?',
      500
    );
  } else {
    apiError = new ApiError('INTERNAL', err?.message || 'Internal error', 500);
  }

  if (apiError.status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl} -> ${apiError.code}`);
    console.error(err);
  }

  const body = apiError.toJSON();
  if (env.nodeEnv !== 'production' && apiError.status >= 500) {
    body.error.stack = err?.stack;
  }

  res.status(apiError.status).json(body);
}

/** Prisma connection/auth failures — by P1xxx code or by error class name. */
function isDbUnavailable(err) {
  if (typeof err?.code === 'string' && err.code.startsWith('P1')) return true;
  const name = err?.name || '';
  return (
    name === 'PrismaClientInitializationError' ||
    name === 'PrismaClientRustPanicError' ||
    /database server/i.test(err?.message || '')
  );
}
