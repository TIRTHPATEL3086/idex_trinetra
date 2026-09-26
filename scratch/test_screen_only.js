import sharp from 'sharp';
import fs from 'fs';
import { dewarp } from '../server/core/lens.js';
import { hashes, hamming } from '../server/core/phash.js';

async function main() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  const targetPath = 'D:\\LDRP\\PROJECTS\\SIH_CRYPTO\\Crypto-2\\data\\marked\\7a5f6c0aa5abfb4a.png';
  const targetHashes = await hashes(fs.readFileSync(targetPath));

  // The corners submitted in INV-00035 were:
  // TL: (96, 128), TR: (860, 128), BR: (860, 1152), BL: (96, 1152)
  // But the screen ends around y = 670!
  // If we set the bottom corners to y = 670:
  const screenCorners = [
    { x: 96, y: 160 },
    { x: 860, y: 160 },
    { x: 860, y: 680 },
    { x: 96, y: 680 },
  ];

  const flat = await dewarp(fs.readFileSync(p), screenCorners);
  console.log(`Dewarped screen only size: ${flat.width}x${flat.height}`);

  const h = await hashes(flat.buffer);
  console.log('pHash dist to target:', hamming(h.pHash, targetHashes.pHash));
  console.log('dHash dist to target:', hamming(h.dHash, targetHashes.dHash));
}

main().catch(console.error);
