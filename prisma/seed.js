/**
 * Seed the database with 5 officers and 3 protected documents.
 *   npm run db:seed
 *
 * The assets are PNGs generated here and encrypted on the way in, so the whole
 * Upload -> Decrypt -> Trace loop has something to work with immediately and
 * nobody has to go find sample files.
 *
 * This script encrypts with node:crypto directly rather than going through
 * server/core/crypto.js, so the database can be seeded before that module is
 * implemented. It is plain AES-256-GCM, so whatever core/crypto.js ends up
 * doing must stay byte-compatible with it — decrypting these rows is a useful
 * first check that it is.
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { PrismaClient } from '@prisma/client';

import { env } from '../server/lib/env.js';
import { escrowKeys } from '../server/lib/keyring.js';
import { assetRef, userRef, hexToBuffer } from '../server/lib/refs.js';
import { hashPassword } from '../server/lib/auth.js';
import { writeDurable } from '../server/lib/files.js';
import { generatePqcKeyPair, encryptKeyBundle, encapsulateKey } from '../server/core/pqc.js';

const prisma = new PrismaClient();

const sha256 = (buffer) => crypto.createHash('sha256').update(buffer).digest();

function encrypt(buffer, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

/**
 * Demo accounts, one per role so the separation of duties can actually be
 * demonstrated rather than described. The passwords are deliberately obvious:
 * these are seed rows on a local database, and a password nobody can remember
 * is the fastest way to lose ninety seconds in front of a judge.
 */
const USERS = [
  {
    name: 'Officer U-017',
    dept: 'Ops Wing',
    email: 'u017@example.gov',
    role: 'OFFICER',
    password: 'officer123',
  },
  {
    name: 'Officer U-023',
    dept: 'Signals',
    email: 'u023@example.gov',
    role: 'OFFICER',
    password: 'officer123',
  },
  {
    name: 'Officer U-041',
    dept: 'Logistics',
    email: 'u041@example.gov',
    role: 'OFFICER',
    password: 'officer123',
  },
  {
    name: 'Analyst A-004',
    dept: 'Intel Cell',
    email: 'a004@example.gov',
    role: 'INVESTIGATOR',
    password: 'analyst123',
  },
  {
    name: 'Admin Desk',
    dept: 'HQ',
    email: 'admin@example.gov',
    role: 'ADMIN',
    password: 'admin123',
  },
];

const ASSETS = [
  { title: 'Ops Order 44', classification: 'CONFIDENTIAL', seed: 17 },
  { title: 'Border Survey Sheet 7', classification: 'SECRET', seed: 41 },
  { title: 'Logistics Annexure B', classification: 'RESTRICTED', seed: 93 },
];

async function main() {
  console.log('Seeding...\n');

  // Wipe in FK order so re-running is always safe.
  await prisma.investigation.deleteMany();
  await prisma.decryptionEvent.deleteMany();
  await prisma.assetKeyEncapsulation.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();
  await prisma.storedFile.deleteMany();

  // ---- users -------------------------------------------------------------
  const userPqcMap = new Map();

  for (const [i, u] of USERS.entries()) {
    const id = i + 1;
    const pqc = generatePqcKeyPair();
    const encryptedPqcKeys = encryptKeyBundle(
      { kemSecretKey: pqc.kemSecretKey, dsaSecretKey: pqc.dsaSecretKey },
      u.password
    );

    await prisma.user.create({
      data: {
        id,
        name: u.name,
        dept: u.dept,
        email: u.email,
        role: u.role,
        passwordHash: hashPassword(u.password),
        active: true,
        // The ONLY identity that ever reaches the chain.
        userRef: hexToBuffer(userRef(id)),
        kemPublicKey: Buffer.from(pqc.kemPublicKey),
        dsaPublicKey: Buffer.from(pqc.dsaPublicKey),
        encryptedPqcKeys,
        escrowedPqcKeys: escrowKeys({
          kemSecretKey: pqc.kemSecretKey,
          dsaSecretKey: pqc.dsaSecretKey,
        }),
      },
    });

    userPqcMap.set(id, { u, pqc });
    console.log(
      `  user  ${id}  ${u.name.padEnd(16)} ${u.role.padEnd(13)} ${u.dept} [PQC enrolled]`
    );
  }
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"User"','id'), ${USERS.length})`
  );

  // ---- assets ------------------------------------------------------------
  await fs.mkdir(env.cipherDir, { recursive: true });

  for (const [i, a] of ASSETS.entries()) {
    const id = i + 1;
    const plaintext = makePng(320, 200, a.seed);
    const contentKey = crypto.randomBytes(32);
    const { ciphertext, iv, authTag } = encrypt(plaintext, contentKey);
    const cipherPath = path.join(env.cipherDir, `asset-${id}.bin`);
    await writeDurable('cipher', cipherPath, ciphertext);

    const asset = await prisma.asset.create({
      data: {
        id,
        title: a.title,
        classification: a.classification,
        mimeType: 'image/png',
        cipherPath,
        iv,
        authTag,
        originalSha: sha256(plaintext),
        assetRef: hexToBuffer(assetRef(id)),
        sizeBytes: plaintext.length,
      },
    });

    // Encapsulate content key for all users so any authorized role can decrypt
    for (const [userId, { pqc }] of userPqcMap.entries()) {
      const { sharedSecret, ciphertext: kemCiphertext } = encapsulateKey(pqc.kemPublicKey);
      const { ciphertext: encKey, iv: keyIv, authTag: keyTag } = encrypt(contentKey, sharedSecret);

      await prisma.assetKeyEncapsulation.create({
        data: {
          assetId: asset.id,
          userId,
          kemCiphertext: Buffer.from(kemCiphertext),
          encryptedKey: encKey,
          iv: keyIv,
          authTag: keyTag,
        },
      });
    }

    console.log(
      `  asset ${id}  ${a.title.padEnd(24)} ${a.classification.padEnd(13)} ${plaintext.length} B [${userPqcMap.size} recipients encapsulated]`
    );
  }
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Asset"','id'), ${ASSETS.length})`
  );

  console.log(`\nDone — ${USERS.length} users, ${ASSETS.length} assets (all PQC-enabled).\n`);
  console.log('  Sign in at http://localhost:5173 with any of:');
  console.log('  ' + '─'.repeat(56));
  for (const u of USERS) {
    console.log(`  ${u.role.padEnd(13)} ${u.email.padEnd(22)} ${u.password}`);
  }
  console.log('  ' + '─'.repeat(56));
  console.log('\n  Check the data with: npm run db:studio\n');
}

/**
 * A valid PNG with a deterministic gradient, built by hand so the seed needs no
 * image library and no sample files on anyone's laptop.
 */
function makePng(width, height, seed) {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  let o = 0;
  for (let y = 0; y < height; y++) {
    raw[o++] = 0; // PNG filter type 0 (None) per scanline
    for (let x = 0; x < width; x++) {
      raw[o++] = (x * 3 + seed * 7) % 256;
      raw[o++] = (y * 5 + seed * 11) % 256;
      raw[o++] = ((x + y) * 2 + seed * 13) % 256;
    }
  }

  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body) >>> 0);
    return Buffer.concat([len, body, crc]);
  };

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type 2 = truecolour RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

let CRC_TABLE = null;
function crc32(buf) {
  if (!CRC_TABLE) {
    CRC_TABLE = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      CRC_TABLE[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return c ^ -1;
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
