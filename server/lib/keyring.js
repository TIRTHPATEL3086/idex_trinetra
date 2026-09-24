/**
 * Server-side key handling for released documents.
 *
 * Every document is encrypted under its own random content key, and that key is
 * encapsulated (ML-KEM-768) once per recipient. To release a copy the server has
 * to get the content key back, which means opening some recipient's KEM secret
 * key. It does that from the escrow: each user's PQC secret keys, wrapped with
 * the master key when the keys are generated.
 *
 * That replaces an earlier approach that opened key bundles by trying demo
 * passwords until one worked. Nothing here knows or guesses a password.
 */
import { prisma } from './prisma.js';
import { masterKey } from './env.js';
import { encrypt, decrypt } from '../core/crypto.js';
import { decapsulateKey, encapsulateKey, encryptKeyBundle } from '../core/pqc.js';

const VERSION = 'escrow-v1';

/** Wrap a user's PQC secret keys with the master key. */
export function escrowKeys({ kemSecretKey, dsaSecretKey }) {
  const payload = Buffer.from(
    JSON.stringify({
      kemSecretKey: Buffer.from(kemSecretKey).toString('base64'),
      dsaSecretKey: Buffer.from(dsaSecretKey).toString('base64'),
    })
  );
  const { ciphertext, iv, authTag } = encrypt(payload, masterKey());
  return JSON.stringify({
    version: VERSION,
    iv: iv.toString('hex'),
    authTag: authTag.toString('hex'),
    ciphertext: ciphertext.toString('base64'),
  });
}

/** @returns {{ kemSecretKey: Buffer, dsaSecretKey: Buffer } | null} */
export function openEscrow(escrowed) {
  if (!escrowed) return null;
  const e = JSON.parse(escrowed);
  if (e.version !== VERSION) return null;
  const plain = decrypt(
    Buffer.from(e.ciphertext, 'base64'),
    masterKey(),
    Buffer.from(e.iv, 'hex'),
    Buffer.from(e.authTag, 'hex')
  );
  const data = JSON.parse(plain.toString('utf8'));
  return {
    kemSecretKey: Buffer.from(data.kemSecretKey, 'base64'),
    dsaSecretKey: Buffer.from(data.dsaSecretKey, 'base64'),
  };
}

/**
 * Everything a user row needs for a fresh key pair: public keys, the bundle the
 * user opens with their own passphrase, and the server escrow.
 */
export function keyColumns(pqc, passphrase) {
  const secret = { kemSecretKey: pqc.kemSecretKey, dsaSecretKey: pqc.dsaSecretKey };
  return {
    kemPublicKey: Buffer.from(pqc.kemPublicKey),
    dsaPublicKey: Buffer.from(pqc.dsaPublicKey),
    encryptedPqcKeys: encryptKeyBundle(secret, passphrase),
    escrowedPqcKeys: escrowKeys(secret),
  };
}

/** A user's secret keys from the escrow, or null if they have none. */
export function userKeys(user) {
  try {
    return openEscrow(user?.escrowedPqcKeys);
  } catch {
    return null; // a corrupt or foreign escrow is treated as absent
  }
}

function openEncapsulation(enc, keys) {
  const sharedSecret = decapsulateKey(enc.kemCiphertext, keys.kemSecretKey);
  return decrypt(enc.encryptedKey, sharedSecret, Buffer.from(enc.iv), Buffer.from(enc.authTag));
}

/**
 * Recover a document's content key from any of its encapsulations whose
 * recipient has escrowed keys, trying `preferUserId` first.
 *
 * @returns {Promise<Buffer|null>}
 */
export async function recoverContentKey(assetId, preferUserId) {
  const encs = await prisma.assetKeyEncapsulation.findMany({
    where: { assetId },
    include: { user: { select: { escrowedPqcKeys: true } } },
  });
  encs.sort((a, b) => (b.userId === preferUserId) - (a.userId === preferUserId));
  for (const enc of encs) {
    const keys = userKeys(enc.user);
    if (!keys) continue;
    try {
      return openEncapsulation(enc, keys);
    } catch {
      // This recipient's copy does not open (e.g. re-keyed since); try the next.
    }
  }
  return null;
}

/**
 * Encapsulate `contentKey` to `user` and store it, keeping any passphrase
 * already allotted on that record.
 */
export async function encapsulateFor(assetId, user, contentKey, allottedPassphrase) {
  const { sharedSecret, ciphertext: kemCiphertext } = encapsulateKey(user.kemPublicKey);
  const { ciphertext: encryptedKey, iv, authTag } = encrypt(contentKey, sharedSecret);
  const data = { kemCiphertext: Buffer.from(kemCiphertext), encryptedKey, iv, authTag };
  if (allottedPassphrase !== undefined) data.allottedPassphrase = allottedPassphrase;
  return prisma.assetKeyEncapsulation.upsert({
    where: { assetId_userId: { assetId, userId: user.id } },
    update: data,
    create: { assetId, userId: user.id, ...data },
  });
}
