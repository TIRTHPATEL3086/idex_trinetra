import fs from 'node:fs/promises';
import path from 'node:path';

import { prisma } from './prisma.js';

/**
 * Files the server writes — an asset's ciphertext, every released copy — kept
 * on disk and, alongside, in the database.
 *
 * The disk is the fast path. The database copy is what survives a host whose
 * disk is wiped on every restart or deploy (Render's free plan, most PaaS
 * containers): without it a document uploaded before a restart can no longer
 * be decrypted, its released copies cannot be previewed, and a photo of one
 * cannot be traced, because tracing aligns the photo against the copy.
 *
 * The key is the kind plus the file's name, so it does not depend on where
 * CIPHER_DIR or MARKED_DIR happen to point on a given machine.
 */
const keyFor = (kind, filePath) => `${kind}/${path.basename(filePath)}`;

/** Write to disk and to the database. */
export async function writeDurable(kind, filePath, bytes) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, bytes);
  const key = keyFor(kind, filePath);
  await prisma.storedFile.upsert({
    where: { key },
    create: { key, bytes },
    update: { bytes },
  });
}

/**
 * Read from disk, else from the database — refilling the disk so the next
 * read is local again. Null when neither has it.
 */
export async function readDurable(kind, filePath) {
  if (!filePath) return null;
  const local = await fs.readFile(filePath).catch(() => null);
  if (local?.length) return local;
  const row = await prisma.storedFile.findUnique({
    where: { key: keyFor(kind, filePath) },
    select: { bytes: true },
  });
  if (!row) return null;
  const bytes = Buffer.from(row.bytes);
  // Written aside and renamed into place, so a request reading the same file
  // meanwhile never sees it half written.
  const partial = `${filePath}.${process.pid}.${Date.now()}.part`;
  await fs
    .mkdir(path.dirname(filePath), { recursive: true })
    .then(() => fs.writeFile(partial, bytes))
    .then(() => fs.rename(partial, filePath))
    .catch(() => fs.rm(partial, { force: true }).catch(() => {})); // a read-only disk still serves from the database
  return bytes;
}

export const readCipher = (asset) => readDurable('cipher', asset?.cipherPath);
export const readMarked = (event) => readDurable('marked', event?.markedPath);
