import crypto from 'node:crypto';
import { env } from './env.js';

/**
 * Passwords and sessions, built on `node:crypto` alone.
 *
 * No bcrypt, no jsonwebtoken, no express-session. Those are three more native
 * or transitive dependencies to install on a machine that may be offline an
 * hour before a demo, and everything they do here is a dozen lines of the
 * standard library: scrypt for the password, HMAC-SHA256 for the session.
 *
 * The session token is stateless and signed, so a restarted API does not log
 * everyone out — but it is also revocable in the ways that matter: it carries
 * the role it was issued with, and every request re-reads the user row, so
 * deactivating an account or changing a role takes effect on the next request
 * rather than whenever the token happens to expire.
 */

// scrypt parameters — the same cost as core/crypto.js deriveKey().
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 32 };
const SALT_BYTES = 16;

// ------------------------------------------------------------ passwords ----

/**
 * @param {string} password
 * @returns {string} `<salt-hex>:<key-hex>` — the whole thing goes in one column.
 */
export function hashPassword(password) {
  const salt = crypto.randomBytes(SALT_BYTES);
  const key = crypto.scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
  return `${salt.toString('hex')}:${key.toString('hex')}`;
}

/**
 * Constant-time verification. Returns false rather than throwing on a
 * malformed or missing hash, so a user row with no password simply cannot
 * sign in instead of 500-ing the login route.
 *
 * @param {string} password
 * @param {string|null} stored `<salt-hex>:<key-hex>`
 */
export function verifyPassword(password, stored) {
  if (typeof stored !== 'string' || !stored.includes(':')) return false;
  const [saltHex, keyHex] = stored.split(':');
  try {
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(keyHex, 'hex');
    if (salt.length !== SALT_BYTES || expected.length !== SCRYPT.keylen) return false;
    const actual = crypto.scryptSync(password, salt, SCRYPT.keylen, SCRYPT);
    return crypto.timingSafeEqual(expected, actual);
  } catch {
    return false;
  }
}

// --------------------------------------------------------------- tokens ----

const b64url = (buf) => Buffer.from(buf).toString('base64url');
const unb64url = (str) => Buffer.from(str, 'base64url');

const sign = (data) => b64url(crypto.createHmac('sha256', env.authSecret).update(data).digest());

/**
 * Issue `<payload-b64url>.<hmac-b64url>`.
 *
 * @param {{ userId:number, role:string }} claims
 * @returns {{ token:string, expiresAt:Date }}
 */
export function issueToken({ userId, role }) {
  const now = Date.now();
  const expMs = now + env.sessionTtlHours * 3600_000;
  const payload = b64url(
    JSON.stringify({ sub: userId, role, iat: now, exp: expMs, jti: crypto.randomUUID() })
  );
  return { token: `${payload}.${sign(payload)}`, expiresAt: new Date(expMs) };
}

/**
 * Verify the signature and the expiry. Never throws — an unreadable token is
 * simply not a session.
 *
 * @returns {{ sub:number, role:string, iat:number, exp:number }|null}
 */
export function readToken(token) {
  if (typeof token !== 'string') return null;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return null;

  const payload = token.slice(0, dot);
  const provided = token.slice(dot + 1);
  const expected = sign(payload);

  // Compare as bytes, in constant time, and only when the lengths already match
  // (timingSafeEqual throws on a length mismatch).
  const a = unb64url(provided);
  const b = unb64url(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  try {
    const claims = JSON.parse(unb64url(payload).toString('utf8'));
    if (typeof claims.exp !== 'number' || claims.exp < Date.now()) return null;
    if (typeof claims.sub !== 'number') return null;
    return claims;
  } catch {
    return null;
  }
}

// -------------------------------------------------------------- cookies ----

export const SESSION_COOKIE = 'provenance_session';

/** Minimal `Cookie:` header parser — one line of the six a package would add. */
export function parseCookies(header) {
  const out = {};
  if (typeof header !== 'string') return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const key = part.slice(0, eq).trim();
    if (!key) continue;
    try {
      out[key] = decodeURIComponent(part.slice(eq + 1).trim());
    } catch {
      out[key] = part.slice(eq + 1).trim();
    }
  }
  return out;
}

/**
 * httpOnly so no script can read the session, SameSite=Lax so a cross-site
 * form post cannot carry it, Secure once we are actually on https.
 */
export function sessionCookie(token, expiresAt) {
  const sameSite = env.nodeEnv === 'production' ? 'SameSite=None' : 'SameSite=Lax';
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    sameSite,
    `Expires=${expiresAt.toUTCString()}`,
    `Max-Age=${Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / 1000))}`,
  ];
  if (env.nodeEnv === 'production') parts.push('Secure');
  return parts.join('; ');
}

/** The same cookie, already expired — what logout sends. */
export function clearedCookie() {
  const sameSite = env.nodeEnv === 'production' ? 'SameSite=None' : 'SameSite=Lax';
  const parts = [
    `${SESSION_COOKIE}=`,
    'Path=/',
    'HttpOnly',
    sameSite,
    'Expires=Thu, 01 Jan 1970 00:00:00 GMT',
    'Max-Age=0',
  ];
  if (env.nodeEnv === 'production') parts.push('Secure');
  return parts.join('; ');
}
