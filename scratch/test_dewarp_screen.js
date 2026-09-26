import sharp from 'sharp';
import fs from 'fs';
import { dewarp, removeMoire, matchTones } from '../server/core/lens.js';
import { extract } from '../server/core/watermark.js';
import { parsePayload, bitsMatching } from '../server/core/payload.js';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  const buffer = fs.readFileSync(p);

  const corners = [
    { x: 120, y: 16 },
    { x: 826, y: 68 },
    { x: 857, y: 674 },
    { x: 25, y: 787 }
  ];

  console.log('Dewarping using screen corners...');
  const flat = await dewarp(buffer, corners);
  console.log(`Dewarped size: ${flat.width}x${flat.height}`);

  const clean = await removeMoire(flat.buffer);
  console.log(`Moire peaks removed: ${clean.peaks}`);

  // Test against the marked files of recent decryption events
  const events = await prisma.decryptionEvent.findMany({
    orderBy: { createdAt: 'desc' },
    take: 10,
    include: { user: true, asset: true },
  });

  for (const ev of events) {
    let size = await sharp(ev.markedPath).metadata();
    let aligned = await sharp(clean.buffer)
      .resize(size.width, size.height, { fit: 'fill' })
      .png()
      .toBuffer();

    // Standard extract
    let reading = await extract(aligned);
    let matches = bitsMatching(reading.payloadBits, ev.payloadBits);
    let parsed = null;
    try { parsed = parsePayload(reading.payloadBits); } catch {}

    console.log(`Event ${ev.id} (${ev.user.name}) => Direct matches: ${matches}/48 | crcOk: ${parsed?.crcOk}`);

    // Tone-matched extract
    try {
      const refBytes = await fs.promises.readFile(ev.markedPath);
      const toneAligned = await matchTones(aligned, refBytes);
      const toneReading = await extract(toneAligned);
      const toneMatches = bitsMatching(toneReading.payloadBits, ev.payloadBits);
      let toneParsed = null;
      try { toneParsed = parsePayload(toneReading.payloadBits); } catch {}
      console.log(`  Tone-matched matches: ${toneMatches}/48 | crcOk: ${toneParsed?.crcOk}`);
    } catch (e) {
      console.log('  Tone match error:', e.message);
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
