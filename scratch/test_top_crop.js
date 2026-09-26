import sharp from 'sharp';
import fs from 'fs';
import { dewarp } from '../server/core/lens.js';
import { extract } from '../server/core/watermark.js';
import { bitsMatching, parsePayload } from '../server/core/payload.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';

  // The corners that were used in INV-00035 (which produced 764x1024 with keyboard):
  const corners = [
    { x: 96, y: 128 },
    { x: 860, y: 128 },
    { x: 860, y: 1152 },
    { x: 96, y: 1152 }
  ];

  const flat = await dewarp(fs.readFileSync(p), corners);
  console.log(`INV-00035 flattened size: ${flat.width}x${flat.height}`);

  // Now, let's take the TOP screen portion of this image (top 55%):
  const screenH = Math.round(flat.height * 0.55);
  const screenOnly = await sharp(flat.buffer)
    .extract({ left: 0, top: 0, width: flat.width, height: screenH })
    .resize(2400, 1350, { fit: 'fill' })
    .png()
    .toBuffer();

  const reading = await extract(screenOnly);
  console.log('Top 55% reading payloadBits:', reading.payloadBits);

  const events = await prisma.decryptionEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { user: true },
  });

  for (const ev of events) {
    const matches = bitsMatching(reading.payloadBits, ev.payloadBits);
    console.log(`Event ${ev.id} (${ev.user.name}) -> matches: ${matches}/48 bits (${(matches/48*100).toFixed(1)}%)`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
