import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';

import { prisma } from '../lib/prisma.js';
import { bufferToHex, hexToBuffer, userRef } from '../lib/refs.js';
import { hashPassword } from '../lib/auth.js';
import { badInput, forbidden, notFound } from '../lib/errors.js';
import { requireAuth, requireCap } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { can, ROLE_META } from '../lib/permissions.js';
import { generatePqcKeyPair, encryptKeyBundle } from '../core/pqc.js';
import { keyColumns, userKeys } from '../lib/keyring.js';

/**
 * Populates the officer picker on the decrypt screen.
 *
 * Both fields are returned on purpose: `name` is Postgres-only and `userRef` is
 * the hashed handle that reaches the chain. They belong in separate, labelled
 * groups in the UI — never side by side as if they were the same fact.
 */
const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    // The officer picker on the decrypt screen is the only consumer of this
    // route, and an officer may only pick themselves — so that is all they get.
    // The roster of who else holds clearance is not theirs to browse.
    const rows = can(req.user.role, 'users:read')
      ? await prisma.user.findMany({ orderBy: { id: 'asc' } })
      : [req.user];
    // Login emails are for the administrator who assigns them, nobody else.
    const showEmail = can(req.user.role, 'users:write');
    res.json({
      users: rows.map((u) => ({
        userId: u.id,
        name: u.name,
        dept: u.dept,
        role: u.role,
        roleLabel: ROLE_META[u.role]?.label ?? u.role,
        userRef: bufferToHex(u.userRef),
        active: u.active,
        ...(showEmail && {
          email: u.email,
          canSignIn: Boolean(u.passwordHash),
          lastLoginAt: u.lastLoginAt ? u.lastLoginAt.toISOString() : null,
        }),
      })),
    });
  } catch (err) {
    next(err);
  }
});

const SetSecurityQuestion = z.object({
  securityQuestion: z.string().trim().min(3, 'Question must be at least 3 characters'),
  securityAnswer: z.string().min(1, 'Answer cannot be blank'),
});

router.get('/security-question', requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { securityQuestion: true },
    });
    res.json({
      hasSecurityQuestion: Boolean(user?.securityQuestion),
      securityQuestion: user?.securityQuestion ?? null,
    });
  } catch (err) {
    next(err);
  }
});

router.post(
  '/security-question',
  requireAuth,
  validate(SetSecurityQuestion),
  async (req, res, next) => {
    try {
      const { securityQuestion, securityAnswer } = req.valid;
      await prisma.user.update({
        where: { id: req.user.id },
        data: {
          securityQuestion: securityQuestion.trim(),
          securityAnswer, // preserves exact case, spacing, and characters
        },
      });
      res.json({
        success: true,
        hasSecurityQuestion: true,
        securityQuestion: securityQuestion.trim(),
      });
    } catch (err) {
      next(err);
    }
  }
);

router.post('/:id/toggle-active', requireAuth, async (req, res, next) => {
  try {
    if (!can(req.user.role, 'users:write')) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Only an Administrator can revoke officer access.' },
      });
    }
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user)
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: `No user ${id}` } });

    const updated = await prisma.user.update({
      where: { id },
      data: { active: !user.active },
    });

    res.json({
      success: true,
      userId: updated.id,
      name: updated.name,
      active: updated.active,
      statusMessage: updated.active
        ? `${updated.name}: access restored`
        : `${updated.name}: access REVOKED under Zero-Trust policy`,
    });
  } catch (err) {
    next(err);
  }
});

// ------------------------------------------------------------ assignment ----

const email = z
  .string()
  .trim()
  .toLowerCase()
  .email('Enter a valid email address to use as the login ID.');
const password = z
  .string()
  .min(8, 'The password must be at least 8 characters.')
  .max(128, 'The password must be at most 128 characters.');

const CreateOfficer = z.object({
  name: z.string().trim().min(2, 'Enter the officer’s name.').max(80),
  dept: z.string().trim().max(60).optional().default(''),
  email,
  password,
});

/**
 * POST /api/users — an administrator assigns a new officer their login.
 *
 * Only ever creates an OFFICER: administrators and analysts are not minted from
 * a form. The officer also gets their post-quantum key pair here, as the seeded
 * accounts do, so documents dispatched from now on can be encapsulated to them.
 */
// The role is checked before the body, so a non-admin is refused outright
// rather than being told what a valid request would look like.
router.post('/', requireCap('users:write'), validate(CreateOfficer), async (req, res, next) => {
  try {
    const { name, dept, email: loginId, password: pw } = req.valid;

    const taken = await prisma.user.findUnique({ where: { email: loginId } });
    if (taken) throw badInput(`The login ID ${loginId} is already assigned.`);

    const pqc = generatePqcKeyPair();
    const user = await prisma.$transaction(async (tx) => {
      // userRef is derived from the id, which only exists once the row does,
      // so the row is written with a random placeholder and then corrected.
      const row = await tx.user.create({
        data: {
          name,
          dept: dept || null,
          email: loginId,
          role: 'OFFICER',
          passwordHash: hashPassword(pw),
          active: true,
          userRef: crypto.randomBytes(32),
          ...keyColumns(pqc, pw),
        },
      });
      return tx.user.update({
        where: { id: row.id },
        data: { userRef: hexToBuffer(userRef(row.id)) },
      });
    });

    res.status(201).json({
      userId: user.id,
      name: user.name,
      dept: user.dept,
      email: user.email,
      role: user.role,
      active: user.active,
    });
  } catch (err) {
    next(err);
  }
});

const SetPassword = z.object({ password });

/**
 * POST /api/users/:id/password — an administrator assigns a new password.
 *
 * Not for other administrators: one admin quietly re-keying another's account
 * is the kind of takeover the separation of duties exists to prevent.
 */
router.post(
  '/:id/password',
  requireCap('users:write'),
  validate(SetPassword),
  async (req, res, next) => {
    try {
      const id = Number(req.params.id);
      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) throw notFound(`No user ${id}`);
      if (user.role === 'ADMIN') {
        throw forbidden('An administrator’s password is not reset from here.');
      }

      // The user's key bundle is locked with their password, so it is re-locked
      // with the new one — through the escrow — or in-browser signing would stop
      // opening it.
      const keys = userKeys(user);
      await prisma.user.update({
        where: { id },
        data: {
          passwordHash: hashPassword(req.valid.password),
          ...(keys && { encryptedPqcKeys: encryptKeyBundle(keys, req.valid.password) }),
        },
      });
      res.json({ success: true, userId: id, email: user.email });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
