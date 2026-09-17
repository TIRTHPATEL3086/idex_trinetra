import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { bufferToHex } from '../lib/refs.js';

/**
 * Populates the officer picker on the decrypt screen.
 *
 * Both fields are returned on purpose: `name` is Postgres-only and `userRef` is
 * the hashed handle that reaches the chain. They belong in separate, labelled
 * groups in the UI — never side by side as if they were the same fact.
 */
const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    const rows = await prisma.user.findMany({ orderBy: { id: 'asc' } });
    res.json({
      users: rows.map((u) => ({
        userId: u.id,
        name: u.name,
        dept: u.dept,
        userRef: bufferToHex(u.userRef),
      })),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
