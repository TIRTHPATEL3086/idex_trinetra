import sharp from 'sharp';
import fs from 'fs';

function dilate(m, W, H, r) {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 0;
      for (let dy = -r; dy <= r && !v; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx >= 0 && yy >= 0 && xx < W && yy < H && m[yy * W + xx]) {
            v = 1;
            break;
          }
        }
      out[y * W + x] = v;
    }
  return out;
}

function erode(m, W, H, r) {
  const out = new Uint8Array(m.length);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      let v = 1;
      for (let dy = -r; dy <= r && v; dy++)
        for (let dx = -r; dx <= r; dx++) {
          const xx = x + dx;
          const yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H || !m[yy * W + xx]) {
            v = 0;
            break;
          }
        }
      out[y * W + x] = v;
    }
  return out;
}

async function detectQuadNew(buffer) {
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
  
  // Clamped thresh so monitor/laptop photos with mixed borders don't blow up
  const thresh = Math.max(28, Math.min(68, 2.5 * Math.max(...spread)));

  const fg = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const d = Math.max(
      Math.abs(data[i * 3] - med[0]),
      Math.abs(data[i * 3 + 1] - med[1]),
      Math.abs(data[i * 3 + 2] - med[2])
    );
    fg[i] = d > thresh ? 1 : 0;
  }

  const closed = erode(dilate(fg, W, H, 2), W, H, 2);

  const label = new Int32Array(W * H).fill(-1);
  let best = -1;
  let bestSize = 0;
  for (let s = 0; s < W * H; s++) {
    if (!closed[s] || label[s] !== -1) continue;
    const stack = [s];
    label[s] = s;
    let n = 0;
    while (stack.length) {
      const i = stack.pop();
      n++;
      const x = i % W;
      const y = (i / W) | 0;
      if (x > 0 && closed[i - 1] && label[i - 1] === -1) ((label[i - 1] = s), stack.push(i - 1));
      if (x < W - 1 && closed[i + 1] && label[i + 1] === -1) ((label[i + 1] = s), stack.push(i + 1));
      if (y > 0 && closed[i - W] && label[i - W] === -1) ((label[i - W] = s), stack.push(i - W));
      if (y < H - 1 && closed[i + W] && label[i + W] === -1) ((label[i + W] = s), stack.push(i + W));
    }
    if (n > bestSize) ((bestSize = n), (best = s));
  }
  const coverage = bestSize / (W * H);
  console.log('Component coverage:', coverage, 'bestSize:', bestSize);
  if (best < 0 || coverage < 0.05) return null;

  const ext = { tl: [Infinity], br: [-Infinity], tr: [-Infinity], bl: [Infinity] };
  for (let i = 0; i < W * H; i++) {
    if (label[i] !== best) continue;
    const x = i % W;
    const y = (i / W) | 0;
    if (x + y < ext.tl[0]) ext.tl = [x + y, x, y];
    if (x + y > ext.br[0]) ext.br = [x + y, x, y];
    if (x - y > ext.tr[0]) ext.tr = [x - y, x, y];
    if (x - y < ext.bl[0]) ext.bl = [x - y, x, y];
  }
  const toPhoto = ([, x, y]) => ({
    x: Math.round(((x + 0.5) / W) * meta.width),
    y: Math.round(((y + 0.5) / H) * meta.height),
  });
  return {
    corners: [toPhoto(ext.tl), toPhoto(ext.tr), toPhoto(ext.br), toPhoto(ext.bl)],
    coverage: Math.round(coverage * 1000) / 1000,
  };
}

async function main() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  const buf = fs.readFileSync(p);
  const res = await detectQuadNew(buf);
  console.log('Result of detectQuadNew:', res);
}
main();
