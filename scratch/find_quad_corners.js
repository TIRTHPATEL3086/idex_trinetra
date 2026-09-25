import sharp from 'sharp';
import fs from 'fs';

async function main() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  const buffer = fs.readFileSync(p);
  const meta = await sharp(buffer).metadata();
  const W = meta.width;
  const H = meta.height;
  const raw = await sharp(buffer).removeAlpha().raw().toBuffer();

  // Find all pixels where blue is dominant (the screen)
  // Let's find min/max y and x for the screen
  let minX = W, maxX = 0, minY = H, maxY = 0;
  const screenPts = [];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const idx = (y * W + x) * 3;
      const r = raw[idx], g = raw[idx + 1], b = raw[idx + 2];
      // The screen is blue pass: b > 70 and b > r + 30
      if (b > 70 && b - r > 30) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        screenPts.push({ x, y });
      }
    }
  }

  console.log(`Blue screen bbox: x=[${minX}, ${maxX}], y=[${minY}, ${maxY}], total screen pixels: ${screenPts.length}`);

  // Find the 4 extreme corners of this blue polygon
  // Top-left: min (x + y)
  // Top-right: max (x - y)
  // Bottom-right: max (x + y)
  // Bottom-left: min (x - y)
  let tl = screenPts[0], tr = screenPts[0], br = screenPts[0], bl = screenPts[0];
  let minSum = Infinity, maxSum = -Infinity, maxDiff = -Infinity, minDiff = Infinity;

  for (const pt of screenPts) {
    const sum = pt.x + pt.y;
    const diff = pt.x - pt.y;
    if (sum < minSum) { minSum = sum; tl = pt; }
    if (sum > maxSum) { maxSum = sum; br = pt; }
    if (diff > maxDiff) { maxDiff = diff; tr = pt; }
    if (diff < minDiff) { minDiff = diff; bl = pt; }
  }

  console.log('Detected 4 corners of the SCREEN:');
  console.log('TL:', tl);
  console.log('TR:', tr);
  console.log('BR:', br);
  console.log('BL:', bl);
}
main();
