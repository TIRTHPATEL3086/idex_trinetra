import { prisma } from '../lib/prisma.js';
import { ApiError } from '../lib/errors.js';
import { parseCookies, readToken, SESSION_COOKIE } from '../lib/auth.js';
import { can } from '../lib/permissions.js';

/**
 * Three middlewares, in the order they run:
 *
 *   attachUser   — decode the cookie, load the row, hang it on req.user.
 *   requireAuth  — 401 if there is no req.user.
 *   requireCap   — 403 if req.user's role does not hold the capability.
 *
 * `attachUser` re-reads the user row on every request rather than trusting the
 * role baked into the token. It costs one indexed primary-key lookup and it
 * means deactivating an account or demoting a role takes effect on the next
 * request instead of whenever the token happens to expire.
 */

export const unauthorized = (msg = 'Sign in to continue.') =>
  new ApiError('UNAUTHENTICATED', msg, 401);

export const forbidden = (msg = 'Your role does not permit this.', meta) =>
  new ApiError('FORBIDDEN', msg, 403, meta);

/** Never rejects — it only populates `req.user` when there is a valid session. */
export async function attachUser(req, _res, next) {
  req.user = null;
  try {
    const cookies = parseCookies(req.headers.cookie);
    const bearer = /^Bearer (.+)$/i.exec(req.headers.authorization || '')?.[1];
    const claims = readToken(cookies[SESSION_COOKIE] || bearer);
    if (!claims) return next();

    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (user && user.active) req.user = user;
    next();
  } catch {
    // A database blip must not make every route look unauthenticated in a way
    // that hides the real problem — fall through and let the route fail loudly.
    next();
  }
}

export function requireAuth(req, _res, next) {
  if (!req.user) return next(unauthorized());
  next();
}

/** "An auditor", but "a officer" reads as a typo. */
const article = (word) => (/^[aeiou]/i.test(word) ? 'An' : 'A');

/** The refusal an over-reaching role gets, phrased for a person to read. */
const refusal = (role) => `${article(role)} ${role.toLowerCase()} account cannot do this.`;

/**
 * @param {string} capability a key of lib/permissions.js CAPABILITIES
 */
export function requireCap(capability) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (!can(req.user.role, capability)) {
      return next(forbidden(refusal(req.user.role), { required: capability, role: req.user.role }));
    }
    next();
  };
}

/** Accepts any one of several capabilities — used where two roles reach the
 *  same route by different routes through the table. */
export function requireAnyCap(...capabilities) {
  return (req, _res, next) => {
    if (!req.user) return next(unauthorized());
    if (capabilities.some((c) => can(req.user.role, c))) return next();
    next(forbidden(refusal(req.user.role), { required: capabilities, role: req.user.role }));
  };
}
