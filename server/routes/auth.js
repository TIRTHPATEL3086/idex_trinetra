import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { bufferToHex } from '../lib/refs.js';
import { validate } from '../middleware/validate.js';
import { unauthorized } from '../middleware/auth.js';
import {
  verifyPassword,
  issueToken,
  sessionCookie,
  clearedCookie,
  hashPassword,
} from '../lib/auth.js';
import { capabilitiesOf, LANDING, ROLE_META } from '../lib/permissions.js';

/**
 * Sign in, sign out, and "who am I".
 *
 * A failed login says the same thing whether the email is unknown, the password
 * is wrong, or the account is deactivated. Telling an attacker which of the
 * three it was hands them a way to enumerate valid accounts, and the honest
 * message is no more useful to the person who simply mistyped.
 */
const router = Router();

const LoginBody = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
  securityAnswer: z.string().optional(),
  newSecurityQuestion: z.string().optional(),
  newSecurityAnswer: z.string().optional(),
});

/** The shape the frontend stores as "the current session". */
function publicUser(user) {
  return {
    userId: user.id,
    name: user.name,
    email: user.email,
    dept: user.dept,
    role: user.role,
    roleLabel: ROLE_META[user.role]?.label ?? user.role,
    userRef: bufferToHex(user.userRef),
    capabilities: capabilitiesOf(user.role),
    landing: LANDING[user.role] ?? '/assets',
    lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
    hasSecurityQuestion: Boolean(user.securityQuestion),
    securityQuestion: user.securityQuestion ?? null,
  };
}

// ------------------------------------------------ POST /api/auth/login ------
router.post('/login', validate(LoginBody), async (req, res, next) => {
  try {
    const { email, password } = req.valid;
    const user = await prisma.user.findUnique({ where: { email } });

    // One message, one timing profile: hash against a dummy when the account
    // does not exist so a missing row is not measurably faster than a bad
    // password.
    const ok = user?.active
      ? verifyPassword(password, user.passwordHash)
      : verifyPassword(password, DUMMY_HASH) && false;

    if (!ok) throw unauthorized('That email and password do not match an active account.');

    const { token, expiresAt } = issueToken({ userId: user.id, role: user.role });

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    res.setHeader('Set-Cookie', sessionCookie(token, expiresAt));
    res.json({
      user: publicUser({ ...updated, lastLoginAt: user.lastLoginAt }),
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ----------------------------------------------- POST /api/auth/logout ------
router.post('/logout', (_req, res) => {
  res.setHeader('Set-Cookie', clearedCookie());
  res.json({ ok: true });
});

// --------------------------------------------------- GET /api/auth/me -------
/** The client calls this on boot to find out whether it still has a session. */
// "Who is signed in?" has a normal answer when nobody is: null, not a 401.
// The app asks on every load, and a 401 there showed as an error in the
// browser console for every visitor who had not signed in yet.
router.get('/me', (req, res) => {
  res.json({ user: req.user ? publicUser(req.user) : null });
});

/**
 * A real scrypt hash of a value nobody can log in with, so the unknown-account
 * path does the same work as the wrong-password path. Computed once at import.
 */
const DUMMY_HASH = hashPassword('no-such-account-' + Math.random());

export default router;
