/**
 * One error shape for every route:
 *   { "error": { "code": "BAD_INPUT", "message": "..." } }
 *
 * Throw an ApiError anywhere; the middleware turns it into that JSON.
 */
export class ApiError extends Error {
  /**
   * @param {string} code    one of the codes in the table below
   * @param {string} message human-readable, safe to surface in the UI
   * @param {number} status  HTTP status
   * @param {object} [meta]  extra fields merged into the error object
   */
  constructor(code, message, status = 500, meta = undefined) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.meta = meta;
  }

  toJSON() {
    return { error: { code: this.code, message: this.message, ...(this.meta || {}) } };
  }
}

/**
 * Thrown by a `server/core/` function Person A has not written yet. It carries
 * a 503 so an unfinished module surfaces as a clean "not ready" response
 * instead of a stack trace, and the message names the exact export.
 */
export const notImplemented = (what) =>
  new ApiError('CORE_NOT_READY', `core:${what} is not implemented yet`, 503, { module: what });

export const badInput = (msg, meta) => new ApiError('BAD_INPUT', msg, 400, meta);
export const unauthenticated = (msg = 'Sign in to continue.') =>
  new ApiError('UNAUTHENTICATED', msg, 401);
export const forbidden = (msg = 'Your role does not permit this.', meta) =>
  new ApiError('FORBIDDEN', msg, 403, meta);
export const notFound = (msg = 'Not found') => new ApiError('NOT_FOUND', msg, 404);
export const tooLarge = (msg) => new ApiError('PAYLOAD_TOO_LARGE', msg, 413);
export const unsupportedMedia = (msg) => new ApiError('UNSUPPORTED_MEDIA', msg, 415);
export const chainError = (msg, meta) => new ApiError('CHAIN_ERROR', msg, 502, meta);
export const coreNotReady = (msg) => new ApiError('CORE_NOT_READY', msg, 503);
export const internal = (msg = 'Internal error') => new ApiError('INTERNAL', msg, 500);
