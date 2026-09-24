/**
 * One-off: escrow the PQC keys of accounts created before key escrow existed.
 *
 *   node scripts/backfill-pqc-escrow.mjs
 *
 * Their key bundles are encrypted with the account password, and the server
 * never learns passwords, so this opens each bundle with the password the seed
 * gave that account (the ones printed by `npm run db:seed` and listed in the
 * README) and stores the keys wrapped with the master key instead.
 *
 * This is a migration of seeded demo data, run once by hand. The running server
 * never tries passwords. An account whose password has changed since seeding is
 * reported and skipped: generate fresh keys for it on the PQC Enroll screen.
 */
import { PrismaClient } from '@prisma/client';

import { decryptKeyBundle } from '../server/core/pqc.js';
import { escrowKeys } from '../server/lib/keyring.js';

const SEEDED = {
  'u017@example.gov': 'officer123',
  'u023@example.gov': 'officer123',
  'u041@example.gov': 'officer123',
  'a004@example.gov': 'analyst123',
  'admin@example.gov': 'admin123',
};

const prisma = new PrismaClient();
let done = 0;
let skipped = 0;

const users = await prisma.user.findMany({
  where: { escrowedPqcKeys: null, encryptedPqcKeys: { not: null } },
});

for (const u of users) {
  const pw = SEEDED[u.email];
  let keys = null;
  if (pw) {
    try {
      keys = decryptKeyBundle(u.encryptedPqcKeys, pw);
    } catch {
      keys = null;
    }
  }
  if (!keys) {
    console.log(`  skip  ${u.email}  (not a seeded password — re-enroll on PQC Enroll)`);
    skipped++;
    continue;
  }
  await prisma.user.update({ where: { id: u.id }, data: { escrowedPqcKeys: escrowKeys(keys) } });
  console.log(`  ok    ${u.email}`);
  done++;
}

console.log(`\n  ${done} escrowed, ${skipped} skipped, ${users.length} needed it.\n`);
await prisma.$disconnect();
