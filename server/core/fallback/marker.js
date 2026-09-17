/**
 * Owner: B. Shared marker so core/index.js can tell "A hasn't written this yet"
 * apart from "A's code threw a real error".
 */
export class NotImplementedError extends Error {
  constructor(what) {
    super(`core:${what} is still a stub — Person A has not implemented it yet`);
    this.name = 'NotImplementedError';
    this.isNotImplemented = true;
    this.what = what;
  }
}

export const NOT_IMPLEMENTED = (what) => new NotImplementedError(what);

export const isNotImplemented = (err) => Boolean(err && err.isNotImplemented);
