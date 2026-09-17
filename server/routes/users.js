import { Router } from 'express';

import { prisma } from '../lib/prisma.js';
import { env } from '../lib/env.js';
import { mockUsers } from '../lib/mocks.js';
import { bufferToHex } from '../lib/refs.js';

/**
 * Convenience route for C's decrypt-screen dropdown.
 *
 * Both fields are returned on purpose: `name` is Postgres-only and `userRef` is
 * the hashed handle that reaches the chain. C shows them in separate, labelled
 * panels — never side by side as if they were the same fact.
 */
const router = Router();

router.get('/', async (_req, res, next) => {
  try {
    if (env.mockMode) return res.json({ users: mockUsers });

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
