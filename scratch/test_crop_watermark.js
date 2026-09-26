import sharp from 'sharp';
import fs from 'fs';
import { extract } from '../server/core/watermark.js';
import { parsePayload, bitsMatching } from '../server/core/payload.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  const crop = await sharp(p)
    .extract({ left: 75, top: 180, width: 800, height: 480 })
    .resize(2400, 1350, { fit: 'fill' })
    .png()
    .toBuffer();

  const reading = await extract(crop);
  console.log('Direct crop reading payloadBits:', reading.payloadBits);
  let parsed = null;
  try {
    parsed = parsePayload(reading.payloadBits);
    console.log('Parsed:', parsed);
  } catch (e) {
    console.log('Parse error:', e.message);
  }

  const events = await prisma.decryptionEvent.findMany({
    take: 10,
    orderBy: { createdAt: 'desc' },
    include: { user: true, asset: true },
  });

  for (const ev of events) {
    const matches = bitsMatching(reading.payloadBits, ev.payloadBits);
    console.log(`Event ${ev.id} (${ev.user.name}) -> matches: ${matches}/48 bits`);
  }
}
main().catch(console.error).finally(() => prisma.$disconnect());
