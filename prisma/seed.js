/**
 * Seed: 5 users + 3 assets (§6.6, Hours 2-4).
 *   npm run db:seed
 *
 * The assets are generated PNGs, encrypted on the way in, so the whole
 * Upload -> Decrypt -> Trace loop has something to work on from minute one
 * without anyone needing to find sample files.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { PrismaClient } from '@prisma/client';

import { env, masterKey } from '../server/lib/env.js';
import { assetRef, userRef, hexToBuffer } from '../server/lib/refs.js';
import { encrypt, sha256 } from '../server/core/index.js';

const prisma = new PrismaClient();

const USERS = [
  { name: 'Officer U-017', dept: 'Ops Wing', email: 'u017@example.gov' },
  { name: 'Officer U-023', dept: 'Signals', email: 'u023@example.gov' },
  { name: 'Officer U-041', dept: 'Logistics', email: 'u041@example.gov' },
  { name: 'Analyst A-004', dept: 'Intel Cell', email: 'a004@example.gov' },
  { name: 'Admin Desk', dept: 'HQ', email: 'admin@example.gov' },
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
  await prisma.asset.deleteMany();
  await prisma.user.deleteMany();

  // ---- users -------------------------------------------------------------
  for (const [i, u] of USERS.entries()) {
    const id = i + 1;
    await prisma.user.create({
      data: {
        id,
        name: u.name,
        dept: u.dept,
        email: u.email,
        // The ONLY identity that ever reaches the chain.
        userRef: hexToBuffer(userRef(id)),
      },
    });
    console.log(`  user  ${id}  ${u.name.padEnd(16)} ${u.dept}`);
  }
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"User"','id'), ${USERS.length})`
  );

  // ---- assets ------------------------------------------------------------
  await fs.mkdir(env.cipherDir, { recursive: true });

  for (const [i, a] of ASSETS.entries()) {
    const id = i + 1;
    const plaintext = makePng(320, 200, a.seed);
    const { ciphertext, iv, authTag } = encrypt(plaintext, masterKey());
    const cipherPath = path.join(env.cipherDir, `asset-${id}.bin`);
    await fs.writeFile(cipherPath, ciphertext);

    await prisma.asset.create({
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
    console.log(
      `  asset ${id}  ${a.title.padEnd(24)} ${a.classification.padEnd(13)} ${plaintext.length} B`
    );
  }
  await prisma.$executeRawUnsafe(
    `SELECT setval(pg_get_serial_sequence('"Asset"','id'), ${ASSETS.length})`
  );

  console.log(`\nDone — ${USERS.length} users, ${ASSETS.length} assets.`);
  console.log('Check it with: npm run db:studio\n');
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
