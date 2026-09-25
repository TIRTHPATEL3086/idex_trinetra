import sharp from 'sharp';
import fs from 'fs';
import { extract } from '../server/core/watermark.js';
import { parsePayload, bitsMatching } from '../server/core/payload.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  
  // Crop the screen!
  // In the photo: left ≈ 65, top ≈ 210, width ≈ 775, height ≈ 455
  console.log('Extracting screen crop...');
  const screenCrop = await sharp(p)
    .extract({ left: 65, top: 210, width: 775, height: 455 })
    .resize(2400, 1350, { fit: 'fill' })
    .png()
    .toBuffer();

  const reading = await extract(screenCrop);
  console.log('Extracted payloadBits:', reading.payloadBits);
  console.log('bitConfidence:', reading.bitConfidence);
  
  let parsed = null;
  try {
    parsed = parsePayload(reading.payloadBits);
    console.log('Parsed payload:', parsed);
  } catch (err) {
    console.log('Parse error:', err.message);
  }

  // Compare with all 10 decryption events in DB!
  const events = await prisma.decryptionEvent.findMany({
    include: { user: true, asset: true }
  });
  console.log('\nMatching against events in DB:');
  for (const ev of events) {
    const matches = bitsMatching(reading.payloadBits, ev.payloadBits);
    console.log(`Event ${ev.id} (${ev.user.name}) -> matches: ${matches}/48 bits (${(matches/48*100).toFixed(1)}%)`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
