import sharp from 'sharp';
import fs from 'fs';

async function testClampedThresh() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  const buffer = fs.readFileSync(p);
  const meta = await sharp(buffer).rotate().metadata();
  const scale = Math.min(1, 640 / Math.max(meta.width, meta.height));
  const W = Math.max(8, Math.round(meta.width * scale));
  const H = Math.max(8, Math.round(meta.height * scale));

  const { data } = await sharp(buffer)
    .rotate()
    .resize(W, H, { fit: 'fill' })
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const border = [];
  for (let x = 0; x < W; x++) border.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) border.push(y * W, y * W + W - 1);
  const med = [0, 1, 2].map((c) => {
    const v = border.map((i) => data[i * 3 + c]).sort((a, b) => a - b);
    return v[v.length >> 1];
  });
  const spread = [0, 1, 2].map((c) => {
    const v = border.map((i) => Math.abs(data[i * 3 + c] - med[c])).sort((a, b) => a - b);
    return v[Math.floor(v.length * 0.9)];
  });

  // Clamp thresh to sensible max (e.g. 50-70) instead of blowing up to 207!
  const thresh = Math.max(28, Math.min(65, 2.5 * Math.max(...spread)));
  console.log('Med:', med, 'Clamped Thresh:', thresh);

  const fg = new Uint8Array(W * H);
  let fgCount = 0;
  for (let i = 0; i < W * H; i++) {
    const d = Math.max(
      Math.abs(data[i * 3] - med[0]),
      Math.abs(data[i * 3 + 1] - med[1]),
      Math.abs(data[i * 3 + 2] - med[2])
    );
    if (d > thresh) {
      fg[i] = 1;
      fgCount++;
    }
  }
  console.log('FG Count with clamped thresh:', fgCount, 'Ratio:', fgCount / (W * H));
}

testClampedThresh();
