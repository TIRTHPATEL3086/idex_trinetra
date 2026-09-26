import sharp from 'sharp';
import fs from 'fs';

async function main() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  const buffer = fs.readFileSync(p);
  const meta = await sharp(buffer).metadata();
  const W = meta.width;
  const H = meta.height;
  const raw = await sharp(buffer).removeAlpha().raw().toBuffer();

  // Let's compute average color per row from y = 0 to H-1
  console.log(`Height: ${H}, Width: ${W}`);
  for (let y = 0; y < H; y += 40) {
    let r = 0, g = 0, b = 0;
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 3;
      r += raw[idx];
      g += raw[idx + 1];
      b += raw[idx + 2];
    }
    r /= W; g /= W; b /= W;
    console.log(`y=${y}: R=${r.toFixed(0)}, G=${g.toFixed(0)}, B=${b.toFixed(0)} | Blue-Red diff=${(b - r).toFixed(0)}`);
  }
}
main();
