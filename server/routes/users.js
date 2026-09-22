import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { bufferToHex } from '../lib/refs.js';
import { requireAuth } from '../middleware/auth.js';
import { can, ROLE_META } from '../lib/permissions.js';

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
    res.json({
      users: rows.map((u) => ({
        userId: u.id,
        name: u.name,
        dept: u.dept,
        role: u.role,
        roleLabel: ROLE_META[u.role]?.label ?? u.role,
        userRef: bufferToHex(u.userRef),
        active: u.active,
      })),
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/toggle-active', requireAuth, async (req, res, next) => {
  try {
    if (!can(req.user.role, 'users:write')) {
      return res.status(403).json({ error: { code: 'FORBIDDEN', message: 'Only an Administrator can revoke officer access.' } });
    }
    const id = Number(req.params.id);
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) return res.status(404).json({ error: { code: 'NOT_FOUND', message: `No user ${id}` } });

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
        ? `Officer ${updated.name} access restored`
        : `Officer ${updated.name} access REVOKED under Zero-Trust policy`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
