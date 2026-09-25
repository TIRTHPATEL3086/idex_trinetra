import sharp from 'sharp';
import fs from 'fs';

async function main() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  const buffer = fs.readFileSync(p);
  const meta = await sharp(buffer).metadata();
  const W = meta.width;
  const raw = await sharp(buffer).removeAlpha().raw().toBuffer();

  const y = 450;
  console.log(`Inspecting row y=${y} across x=0 to ${W-1}:`);
  for (let x = 0; x < W; x += 30) {
    const idx = (y * W + x) * 3;
    const r = raw[idx], g = raw[idx + 1], b = raw[idx + 2];
    console.log(`x=${x}: R=${r}, G=${g}, B=${b} | Blue-Red diff=${b - r}`);
  }
}
main();
