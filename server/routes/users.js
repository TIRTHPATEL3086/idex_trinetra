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
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
