import sharp from 'sharp';
import fs from 'fs';

async function main() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  const meta = await sharp(p).metadata();
  console.log('Leak metadata:', meta);
}
main();
