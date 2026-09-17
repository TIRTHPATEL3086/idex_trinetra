/**
 * One error shape for every route (docs/CONTRACTS.md §3):
 *   { "error": { "code": "BAD_INPUT", "message": "..." } }
 *
 * Throw an ApiError anywhere; the middleware turns it into that JSON.
 */
export class ApiError extends Error {
  /**
   * @param {string} code    one of the codes in the table below
   * @param {string} message human-readable, safe to show the jury
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

export const badInput = (msg, meta) => new ApiError('BAD_INPUT', msg, 400, meta);
export const notFound = (msg = 'Not found') => new ApiError('NOT_FOUND', msg, 404);
export const tooLarge = (msg) => new ApiError('PAYLOAD_TOO_LARGE', msg, 413);
export const unsupportedMedia = (msg) => new ApiError('UNSUPPORTED_MEDIA', msg, 415);
export const chainError = (msg, meta) => new ApiError('CHAIN_ERROR', msg, 502, meta);
export const coreNotReady = (msg) => new ApiError('CORE_NOT_READY', msg, 503);
export const internal = (msg = 'Internal error') => new ApiError('INTERNAL', msg, 500);
