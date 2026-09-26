/**
 * Optical forensic lens — recovering a leak that was photographed off a screen.
 *
 * Insiders rarely leak a file; they photograph the monitor with a phone. That
 * photo is tilted and keystoned, carries the monitor's pixel-grid interference
 * (moire), and has the camera's own brightness and colour. Each stage below
 * undoes one of those, so the watermark extractor sees something close to the
 * released copy again:
 *
 *   detectQuad   find the four corners of the displayed document
 *   dewarp       perspective-correct that quadrilateral into a rectangle
 *   removeMoire  notch the interference peaks out of the 2-D spectrum
 *   matchTones   (per candidate, in trace.js) map the photo's tone curve onto
 *                the released copy's, undoing the camera's exposure
 *
 * Pure JavaScript on raw pixels via sharp — no native vision library, so it
 * runs on an offline laptop like the rest of the system.
 */
import sharp from 'sharp';

/* -------------------------------------------------------------- corners -- */

/**
 * Find the displayed document in a photo: the largest region that differs from
 * the photo's border colour, reduced to its four extreme corners.
 *
 * @returns {Promise<{corners:{x:number,y:number}[], coverage:number}|null>}
 *          corners in TL, TR, BR, BL order, in the photo's own pixels
 */
export async function detectQuad(buffer) {
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

  // Background = the median colour along the photo's border.
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
  // Clamp thresh so monitor/laptop photos with mixed borders don't blow up to 200+
  const thresh = Math.max(26, Math.min(68, 2.5 * Math.max(...spread)));

  const fg = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    const d = Math.max(
      Math.abs(data[i * 3] - med[0]),
      Math.abs(data[i * 3 + 1] - med[1]),
      Math.abs(data[i * 3 + 2] - med[2])
    );
    fg[i] = d > thresh ? 1 : 0;
  }

  // Close small gaps (dark text inside a bright page) with a 5x5 dilate + erode.
  const closed = erode(dilate(fg, W, H, 2), W, H, 2);

  // Largest 4-connected component.
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
      if (x < W - 1 && closed[i + 1] && label[i + 1] === -1)
        ((label[i + 1] = s), stack.push(i + 1));
      if (y > 0 && closed[i - W] && label[i - W] === -1) ((label[i - W] = s), stack.push(i - W));
      if (y < H - 1 && closed[i + W] && label[i + W] === -1)
        ((label[i + W] = s), stack.push(i + W));
    }
    if (n > bestSize) ((bestSize = n), (best = s));
  }
  const coverage = bestSize / (W * H);
  if (best < 0 || coverage < 0.05) return null;
  if (coverage > 0.96) {
    const insetX = Math.round(meta.width * 0.005);
    const insetY = Math.round(meta.height * 0.005);
    return {
      corners: [
        { x: insetX, y: insetY },
        { x: meta.width - 1 - insetX, y: insetY },
        { x: meta.width - 1 - insetX, y: meta.height - 1 - insetY },
        { x: insetX, y: meta.height - 1 - insetY },
      ],
      coverage: Math.round(coverage * 1000) / 1000,
    };
  }

  // Extreme points of the component: min/max of x+y and x-y.
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

/* --------------------------------------------------------------- dewarp -- */

/** Solve the 3x3 homography taking four src points onto four dst points. */
export function homography(src, dst) {
  const A = [];
  const b = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]);
    b.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]);
    b.push(v);
  }
  const h = solve(A, b);
  return [...h, 1];
}

function solve(A, b) {
  const n = b.length;
  const M = A.map((row, i) => [...row, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) throw new Error('The four corners are degenerate.');
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / M[i][i]);
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Perspective-correct the quadrilateral `corners` (TL, TR, BR, BL) into an
 * upright rectangle sized from the quad's own edge lengths.
 * @returns {Promise<{buffer:Buffer, width:number, height:number}>}
 */
export async function dewarp(buffer, corners) {
  const { data, info } = await sharp(buffer)
    .rotate()
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const [tl, tr, br, bl] = corners;
  const W = Math.max(16, Math.round((dist(tl, tr) + dist(bl, br)) / 2));
  const H = Math.max(16, Math.round((dist(tl, bl) + dist(tr, br)) / 2));
  // Map each output pixel back into the photo (inverse warp) and sample bilinearly.
  const Hm = homography(
    [
      { x: 0, y: 0 },
      { x: W - 1, y: 0 },
      { x: W - 1, y: H - 1 },
      { x: 0, y: H - 1 },
    ],
    corners
  );
  const out = Buffer.alloc(W * H * 3);
  const sw = info.width;
  const sh = info.height;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Hm[6] * x + Hm[7] * y + Hm[8];
      const sx = (Hm[0] * x + Hm[1] * y + Hm[2]) / d;
      const sy = (Hm[3] * x + Hm[4] * y + Hm[5]) / d;
      const x0 = Math.max(0, Math.min(sw - 2, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(sh - 2, Math.floor(sy)));
      const fx = Math.max(0, Math.min(1, sx - x0));
      const fy = Math.max(0, Math.min(1, sy - y0));
      for (let c = 0; c < 3; c++) {
        const p = (yy, xx) => data[(yy * sw + xx) * 3 + c];
        out[(y * W + x) * 3 + c] =
          p(y0, x0) * (1 - fx) * (1 - fy) +
          p(y0, x0 + 1) * fx * (1 - fy) +
          p(y0 + 1, x0) * (1 - fx) * fy +
          p(y0 + 1, x0 + 1) * fx * fy;
      }
    }
  }
  return {
    buffer: await sharp(out, { raw: { width: W, height: H, channels: 3 } })
      .png()
      .toBuffer(),
    width: W,
    height: H,
  };
}

/* ---------------------------------------------------------------- moire -- */

/** In-place iterative radix-2 FFT on (re, im) of length n (a power of two). */
function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len;
    const wr = Math.cos(ang);
    const wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1;
      let ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k;
        const b = a + len / 2;
        const tr = re[b] * cr - im[b] * ci;
        const ti = re[b] * ci + im[b] * cr;
        re[b] = re[a] - tr;
        im[b] = im[a] - ti;
        re[a] += tr;
        im[a] += ti;
        const nr = cr * wr - ci * wi;
        ci = cr * wi + ci * wr;
        cr = nr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) ((re[i] /= n), (im[i] /= n));
}

function fft2(re, im, N, M, inverse) {
  const rr = new Float64Array(M);
  const ri = new Float64Array(M);
  for (let y = 0; y < N; y++) {
    rr.set(re.subarray(y * M, y * M + M));
    ri.set(im.subarray(y * M, y * M + M));
    fft(rr, ri, inverse);
    re.set(rr, y * M);
    im.set(ri, y * M);
  }
  const cr = new Float64Array(N);
  const ci = new Float64Array(N);
  for (let x = 0; x < M; x++) {
    for (let y = 0; y < N; y++) ((cr[y] = re[y * M + x]), (ci[y] = im[y * M + x]));
    fft(cr, ci, inverse);
    for (let y = 0; y < N; y++) ((re[y * M + x] = cr[y]), (im[y * M + x] = ci[y]));
  }
}

const pow2 = (v) => 1 << Math.ceil(Math.log2(v));

/**
 * Remove periodic interference: isolated strong peaks in the 2-D spectrum,
 * away from the low frequencies that carry the picture itself, are notched out
 * of every channel.
 *
 * @returns {Promise<{buffer:Buffer, peaks:number}>}
 */
export async function removeMoire(buffer) {
  const { data, info } = await sharp(buffer)
    .removeAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const w = info.width;
  const h = info.height;
  const M = pow2(w);
  const N = pow2(h);
  if (M * N > 2048 * 2048) return { buffer, peaks: 0 }; // too large to be worth it

  const spectra = [0, 1, 2].map((c) => {
    const re = new Float64Array(N * M);
    const im = new Float64Array(N * M);
    let mean = 0;
    for (let i = 0; i < w * h; i++) mean += data[i * 3 + c];
    mean /= w * h;
    // Pad by mirroring edges so the padding adds no false periodic energy.
    for (let y = 0; y < N; y++) {
      const sy = y < h ? y : Math.max(0, 2 * h - y - 1);
      for (let x = 0; x < M; x++) {
        const sx = x < w ? x : Math.max(0, 2 * w - x - 1);
        re[y * M + x] = data[(Math.min(sy, h - 1) * w + Math.min(sx, w - 1)) * 3 + c] - mean;
      }
    }
    fft2(re, im, N, M, false);
    return { re, im, mean };
  });

  // Peak search on the luminance-weighted magnitude.
  const mag = new Float64Array(N * M);
  for (let i = 0; i < N * M; i++) {
    let s = 0;
    for (const [c, wgt] of [
      [0, 0.3],
      [1, 0.59],
      [2, 0.11],
    ])
      s += wgt * Math.hypot(spectra[c].re[i], spectra[c].im[i]);
    mag[i] = Math.log1p(s);
  }
  const keep = Math.max(6, Math.round(0.08 * Math.min(N, M))); // low-frequency guard radius
  const R = 3;
  const peaks = [];
  for (let y = 0; y < N; y++) {
    const fy = y <= N / 2 ? y : y - N;
    for (let x = 0; x < M; x++) {
      const fx = x <= M / 2 ? x : x - M;
      if (Math.hypot(fx / M, fy / N) * Math.min(N, M) < keep) continue;
      const v = mag[y * M + x];
      // local maximum well above its ring neighbourhood
      let isMax = true;
      let ring = 0;
      let cnt = 0;
      for (let dy = -2 * R; dy <= 2 * R && isMax; dy++)
        for (let dx = -2 * R; dx <= 2 * R; dx++) {
          if (!dx && !dy) continue;
          const j = ((y + dy + N) % N) * M + ((x + dx + M) % M);
          if (Math.abs(dx) <= 1 && Math.abs(dy) <= 1) {
            if (mag[j] > v) {
              isMax = false;
              break;
            }
          } else if (Math.max(Math.abs(dx), Math.abs(dy)) >= R) {
            ring += mag[j];
            cnt++;
          }
        }
      if (isMax && v - ring / cnt > 2.2) peaks.push({ x, y });
    }
  }

  // Notch each peak (and, by conjugate symmetry, its mirror) with a soft disk.
  const picked = peaks.slice(0, 40);
  for (const { x, y } of picked) {
    for (const [px, py] of [
      [x, y],
      [(M - x) % M, (N - y) % N],
    ]) {
      for (let dy = -R; dy <= R; dy++)
        for (let dx = -R; dx <= R; dx++) {
          const r = Math.hypot(dx, dy);
          if (r > R) continue;
          const g = r / R; // 0 at the centre -> fully removed
          const j = ((py + dy + N) % N) * M + ((px + dx + M) % M);
          for (const s of spectra) ((s.re[j] *= g), (s.im[j] *= g));
        }
    }
  }
  if (!picked.length) return { buffer, peaks: 0 };

  const out = Buffer.alloc(w * h * 3);
  spectra.forEach((s, c) => {
    fft2(s.re, s.im, N, M, true);
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++)
        out[(y * w + x) * 3 + c] = Math.max(0, Math.min(255, Math.round(s.re[y * M + x] + s.mean)));
  });
  return {
    buffer: await sharp(out, { raw: { width: w, height: h, channels: 3 } })
      .png()
      .toBuffer(),
    peaks: picked.length,
  };
}

/* ---------------------------------------------------------------- tones -- */

/**
 * Map `buffer`'s per-channel tone curve onto `reference`'s (histogram
 * matching). Both must be the same size. Undoes camera exposure and white
 * balance so the watermark's quantization steps line up again.
 */
export async function matchTones(buffer, reference) {
  const a = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const b = await sharp(reference).removeAlpha().raw().toBuffer();
  const n = a.info.width * a.info.height;
  const out = Buffer.alloc(n * 3);
  for (let c = 0; c < 3; c++) {
    const ha = new Float64Array(256);
    const hb = new Float64Array(256);
    for (let i = 0; i < n; i++) ((ha[a.data[i * 3 + c]] += 1), (hb[b[i * 3 + c]] += 1));
    for (let v = 1; v < 256; v++) ((ha[v] += ha[v - 1]), (hb[v] += hb[v - 1]));
    const lut = new Uint8Array(256);
    let j = 0;
    for (let v = 0; v < 256; v++) {
      while (j < 255 && hb[j] < ha[v]) j++;
      lut[v] = j;
    }
    for (let i = 0; i < n; i++) out[i * 3 + c] = lut[a.data[i * 3 + c]];
  }
  return sharp(out, { raw: { width: a.info.width, height: a.info.height, channels: 3 } })
    .png()
    .toBuffer();
}
