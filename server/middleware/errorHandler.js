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
 */
// eslint-disable-next-line no-unused-vars -- Express needs the 4-arg signature
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
  } else if (err?.code?.startsWith?.('P1')) {
    // Prisma connection-level errors — almost always "Postgres isn't running".
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
