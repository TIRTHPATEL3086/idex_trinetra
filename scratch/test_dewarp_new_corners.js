import sharp from 'sharp';
import fs from 'fs';
import { dewarp, removeMoire } from '../server/core/lens.js';
import { hashes, hamming } from '../server/core/phash.js';
import { extract } from '../server/core/watermark.js';
import { parsePayload, bitsMatching } from '../server/core/payload.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  const targetPath = 'D:\\LDRP\\PROJECTS\\SIH_CRYPTO\\Crypto-2\\data\\marked\\7a5f6c0aa5abfb4a.png';
  const targetBuf = fs.readFileSync(targetPath);
  const targetHashes = await hashes(targetBuf);

  const corners = [
    { x: 7, y: 145 },
    { x: 920, y: 93 },
    { x: 866, y: 735 },
    { x: 53, y: 727 }
  ];

  console.log('Dewarping with new auto-detected corners...');
  const flat = await dewarp(fs.readFileSync(p), corners);
  console.log(`Dewarped size: ${flat.width}x${flat.height}`);

  const h = await hashes(flat.buffer);
  console.log('pHash distance:', hamming(h.pHash, targetHashes.pHash));
  console.log('dHash distance:', hamming(h.dHash, targetHashes.dHash));

  const clean = await removeMoire(flat.buffer);
  console.log(`Moire peaks removed: ${clean.peaks}`);

  // Test extract against recent decryption events in DB
  const events = await prisma.decryptionEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { user: true, asset: true },
  });

  const aligned = await sharp(clean.buffer)
    .resize(2400, 1350, { fit: 'fill' })
    .png()
    .toBuffer();

  const reading = await extract(aligned);
  console.log('Reading payloadBits:', reading.payloadBits);
  let parsed = null;
  try {
    parsed = parsePayload(reading.payloadBits);
    console.log('Parsed payload:', parsed);
  } catch (err) {
    console.log('Parse error:', err.message);
  }

  for (const ev of events) {
    const matches = bitsMatching(reading.payloadBits, ev.payloadBits);
    console.log(`Event ${ev.id} (${ev.user.name}) -> matches: ${matches}/48 (${(matches/48*100).toFixed(1)}%)`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
