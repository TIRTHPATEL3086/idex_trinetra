/**
 * Reading the mark out of a capture: a phone photo of a screen, a screenshot,
 * a crop — anything where the released page is not simply the whole image.
 *
 * The mark lives on a fixed pixel grid (level-2 DWT blocks of 4x4 pixels), so
 * it can only be read once the page has been put back exactly where it was
 * released, at its released size. Two ways of getting there are tried:
 *
 *   quad    — the page (or the screen showing it) is a bright quadrilateral
 *             against a darker surround: find its corners, undo the
 *             perspective and the monitor's moire. A phone photo.
 *   locate  — search the capture for the released page itself, at every
 *             plausible scale and offset, allowing it to run off the edge of
 *             the capture. A screenshot, a crop, a page scrolled half off
 *             screen, or the flattened photo from `quad`.
 *
 * Every placement found is then checked against the release it was matched
 * to: the bits read from the visible region must agree with that release's
 * own payload far beyond chance. Finding a matching picture is not enough to
 * name anyone — only the mark can do that.
 */
import sharp from 'sharp';

import { detectQuad, dewarp, homography, matchTones } from './lens.js';
import { extractVisible } from './watermark.js';
import { bitsMatching } from './payload.js';

/* ------------------------------------------------------------- helpers --- */

/** The four corners of a w x h image, TL, TR, BR, BL. */
const corners = (w, h) => [
  { x: 0, y: 0 },
  { x: w - 1, y: 0 },
  { x: w - 1, y: h - 1 },
  { x: 0, y: h - 1 },
];

const decoded = new WeakMap();

/**
 * Greyscale float pixels at a given size. Each image is decoded once and
 * resized from its raw pixels after that — the search asks for the same
 * page at dozens of sizes, and decoding a PNG each time dominated it.
 */
async function grey(buffer, width, height) {
  let raw = decoded.get(buffer);
  if (!raw) {
    // One channel exactly: greyscale() alone keeps an alpha channel if the
    // image has one, and the raw pixels would then be read interleaved.
    const { data, info } = await sharp(buffer)
      .removeAlpha()
      .greyscale()
      .extractChannel(0)
      .raw()
      .toBuffer({ resolveWithObject: true });
    raw = { data, width: info.width, height: info.height, channels: info.channels };
    decoded.set(buffer, raw);
  }
  const data = await sharp(raw.data, {
    raw: { width: raw.width, height: raw.height, channels: raw.channels },
  })
    .resize(width, height, { fit: 'fill' })
    .extractChannel(0) // raw input comes back out as sRGB otherwise
    .raw()
    .toBuffer();
  return Float32Array.from(data);
}

/**
 * Zero-mean normalised cross-correlation of template `t` (tw x th) placed at
 * (px, py) on image `im` (W x H), over the part of the two that overlaps.
 * The template may hang off any edge of the image.
 */
function ncc(im, W, H, t, tw, th, px, py) {
  const step = W > 400 ? 2 : 1;
  const x0 = Math.max(0, px);
  const y0 = Math.max(0, py);
  const x1 = Math.min(W, px + tw);
  const y1 = Math.min(H, py + th);
  if (x1 <= x0 || y1 <= y0) return { r: -1, n: 0 };
  let n = 0;
  let sa = 0;
  let sb = 0;
  let saa = 0;
  let sbb = 0;
  let sab = 0;
  for (let y = y0; y < y1; y += step) {
    const ri = y * W;
    const rt = (y - py) * tw - px;
    for (let x = x0; x < x1; x += step) {
      n++;
      const a = im[ri + x];
      const b = t[rt + x];
      sa += a;
      sb += b;
      saa += a * a;
      sbb += b * b;
      sab += a * b;
    }
  }
  const va = saa - (sa * sa) / n;
  const vb = sbb - (sb * sb) / n;
  if (va <= 1e-6 || vb <= 1e-6) return { r: -1, n: n * step * step };
  return { r: (sab - (sa * sb) / n) / Math.sqrt(va * vb), n: n * step * step };
}

/**
 * Where the released page sits in the capture, as a scale and an offset.
 *
 * Three passes, each narrowing the last: a wide search on small greyscale
 * copies over every plausible scale and offset, a finer one around the best
 * few, and a last one at the capture's own resolution, because the mark's
 * 4x4-pixel grid tolerates about a pixel of error. The page may run off the
 * capture on any side, but enough of it has to be in view to judge: at least
 * half its width (or the capture's) and a fifth of its height.
 *
 * @returns {{ scale:number, x:number, y:number, score:number }|null}
 *          capture pixels per released pixel, and the released page's
 *          top-left corner in capture pixels (may be negative)
 */
const weight = (r, n, area) => r * Math.min(1, n / (area * 0.25));

/**
 * The wide first pass of locate() on its own: the capture at 48 px across,
 * every plausible scale and offset. Cheap enough to run for every candidate
 * release, and its best score says which few are worth the fine passes.
 *
 * @returns {Array<{s:number,x:number,y:number,w:number}>} best fit per scale, best first
 */
async function coarseLocate(capture, capMeta, release) {
  const aspect = release.height / release.width;
  const cW = 48;
  const cH = Math.max(8, Math.round((capMeta.height / capMeta.width) * cW));
  const cap = await grey(capture, cW, cH);
  const fits = [];
  for (let frac = 0.2; frac <= 1.35; frac *= 1.07) {
    const tw = Math.round(cW * frac);
    const th = Math.round(tw * aspect);
    if (tw < 8 || th < 8) continue;
    const t = await grey(release.buffer, tw, th);
    const minX = Math.round(Math.min(tw, cW) * 0.5);
    const minY = Math.round(Math.min(th, cH) * 0.2);
    let best = null;
    for (let py = minY - th; py <= cH - minY; py++) {
      for (let px = minX - tw; px <= cW - minX; px++) {
        const { r, n } = ncc(cap, cW, cH, t, tw, th, px, py);
        const s = weight(r, n, cW * cH);
        if (!best || s > best.s) best = { s, x: px / cW, y: py / cW, w: tw / cW };
      }
    }
    if (best) fits.push(best);
  }
  return fits.sort((a, b) => b.s - a.s);
}

async function locate(capture, capMeta, release, coarse = null) {
  const relW = release.width;
  const aspect = release.height / relW;
  const fits = coarse ?? (await coarseLocate(capture, capMeta, release));
  if (!fits.length) return null;

  // Positions are carried between passes as fractions of the capture's width.
  const refine = async (starts, across, reach, step, scales) => {
    const W = Math.min(across, capMeta.width);
    const H = Math.max(8, Math.round((capMeta.height / capMeta.width) * W));
    const im = await grey(capture, W, H);
    let best = null;
    for (const c of starts) {
      for (const sf of scales) {
        const tw = Math.round(c.w * W * sf);
        const th = Math.round(tw * aspect);
        if (tw < 8 || th < 8) continue;
        const t = await grey(release.buffer, tw, th);
        // Keep the page centred on the same point while its size changes.
        const cx = c.x * W + (c.w * W - tw) / 2;
        const cy = c.y * W + (c.w * W * aspect - th) / 2;
        for (let dy = -reach; dy <= reach; dy += step) {
          for (let dx = -reach; dx <= reach; dx += step) {
            const px = Math.round(cx + dx);
            const py = Math.round(cy + dy);
            const { r, n } = ncc(im, W, H, t, tw, th, px, py);
            const s = weight(r, n, W * H);
            if (!best || s > best.s) best = { s, r, x: px / W, y: py / W, w: tw / W };
          }
        }
      }
    }
    return best;
  };
  const range = (from, to, step) => {
    const out = [];
    for (let v = from; v <= to + 1e-9; v += step) out.push(v);
    return out;
  };

  // --- 2. medium: 192 px across, around the best three ---------------------
  let best = await refine(fits.slice(0, 3), 192, 6, 2, range(0.97, 1.03, 0.015));
  best = await refine([best], 192, 1, 1, range(0.995, 1.005, 0.005));
  if (!best || best.r < 0.3) return null;

  // --- 3. fine: 768 px across, then the capture's own pixels -------------
  // The mark needs the page placed to about a pixel, and its size to about
  // a tenth of a percent, so the last pass repeats until it stops moving.
  best = await refine([best], 768, 3, 1, range(0.988, 1.012, 0.004));
  if (capMeta.width > 768) {
    for (let pass = 0; pass < 4; pass++) {
      const before = best;
      best = await refine([best], capMeta.width, 1, 1, range(0.998, 1.002, 0.001));
      const moved =
        Math.abs(best.x - before.x) * capMeta.width > 0.5 ||
        Math.abs(best.y - before.y) * capMeta.width > 0.5 ||
        Math.abs(best.w / before.w - 1) > 0.0005;
      if (!moved) break;
    }
  }
  if (!best || best.r < 0.35) return null;
  return {
    scale: (best.w * capMeta.width) / relW,
    x: best.x * capMeta.width,
    y: best.y * capMeta.width,
    score: Math.round(best.r * 1000) / 1000,
  };
}

/**
 * Put the located part of the capture back on a canvas the size of the
 * released copy, tone-matched to the release, and say which part is real.
 */
async function placeOnCanvas(capture, capMeta, release, fit) {
  const relW = release.width;
  const relH = release.height;
  // The capture's own rectangle, in released pixels.
  const vx0 = Math.max(0, Math.ceil(-fit.x / fit.scale));
  const vy0 = Math.max(0, Math.ceil(-fit.y / fit.scale));
  const vx1 = Math.min(relW, Math.floor((capMeta.width - fit.x) / fit.scale));
  const vy1 = Math.min(relH, Math.floor((capMeta.height - fit.y) / fit.scale));
  if (vx1 - vx0 < 32 || vy1 - vy0 < 32) return null;

  // The matching part of the capture, cut out and scaled to released pixels.
  const left = Math.max(0, Math.round(fit.x + vx0 * fit.scale));
  const top = Math.max(0, Math.round(fit.y + vy0 * fit.scale));
  const width = Math.min(capMeta.width - left, Math.round((vx1 - vx0) * fit.scale));
  const height = Math.min(capMeta.height - top, Math.round((vy1 - vy0) * fit.scale));
  if (width < 8 || height < 8) return null;
  let piece = await sharp(capture)
    .extract({ left, top, width, height })
    .resize(vx1 - vx0, vy1 - vy0, { fit: 'fill', kernel: 'cubic' })
    .removeAlpha()
    .png()
    .toBuffer();

  // Undo exposure and colour cast against the same part of the release.
  const refPiece = await sharp(release.buffer)
    .extract({ left: vx0, top: vy0, width: vx1 - vx0, height: vy1 - vy0 })
    .removeAlpha()
    .png()
    .toBuffer();
  piece = await matchTones(piece, refPiece);

  // Outside the visible part the canvas is flat grey. It carries no votes —
  // extractVisible only reads inside `visible` — so it cannot favour anyone.
  const canvas = await sharp({
    create: { width: relW, height: relH, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .composite([{ input: piece, left: vx0, top: vy0 }])
    .png()
    .toBuffer();
  return { canvas, visible: { x0: vx0, y0: vy0, x1: vx1, y1: vy1 } };
}

/** Read a placement against the release it was matched to. */
async function readAligned(capture, capMeta, release, fit) {
  const placed = await placeOnCanvas(capture, capMeta, release, fit);
  if (!placed) return null;
  const reading = await extractVisible(placed.canvas, release.deltaUsed, placed.visible);
  return {
    reading,
    matches: bitsMatching(reading.payloadBits, release.payloadBits),
    visible: placed.visible,
    fit,
    canvas: placed.canvas,
  };
}

/* --------------------------------------------------------- registration --- */

/** Apply homography `h` (row-major 3x3) to a point. */
const mapPt = (h, x, y) => {
  const d = h[6] * x + h[7] * y + h[8];
  return { x: (h[0] * x + h[1] * y + h[2]) / d, y: (h[3] * x + h[4] * y + h[5]) / d };
};

/**
 * Least-squares homography from n >= 4 point pairs (src -> dst), by the
 * normal equations of the usual 8-unknown linear system.
 */
function fitHomography(src, dst, axes = null) {
  const N = new Float64Array(64);
  const r = new Float64Array(8);
  const add = (row, v) => {
    for (let i = 0; i < 8; i++) {
      r[i] += row[i] * v;
      for (let j = 0; j < 8; j++) N[i * 8 + j] += row[i] * row[j];
    }
  };
  for (let i = 0; i < src.length; i++) {
    const { x, y } = src[i];
    const { x: u, y: v } = dst[i];
    // A point pinned on one axis only contributes that axis's equation.
    if (!axes || axes[i].x) add([x, y, 1, 0, 0, 0, -u * x, -u * y], u);
    if (!axes || axes[i].y) add([0, 0, 0, x, y, 1, -v * x, -v * y], v);
  }
  // Gaussian elimination with partial pivoting on the 8x8 system.
  const M = Array.from({ length: 8 }, (_, i) => [...N.subarray(i * 8, i * 8 + 8), r[i]]);
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let k = c + 1; k < 8; k++) if (Math.abs(M[k][c]) > Math.abs(M[p][c])) p = k;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-12) return null;
    for (let k = 0; k < 8; k++) {
      if (k === c) continue;
      const f = M[k][c] / M[c][c];
      for (let j = c; j <= 8; j++) M[k][j] -= f * M[c][j];
    }
  }
  return [...M.map((row, i) => row[8] / M[i][i]), 1];
}

/**
 * Least-squares affine map from points pinned per axis: the x equations come
 * only from points whose horizontal position is known, the y equations only
 * from those whose vertical position is. Three per axis is enough, and an
 * affine map cannot bend away from a cluster the way a homography can.
 */
function fitAffineAxes(src, dst, axes) {
  const solve3 = (rows) => {
    if (rows.length < 3) return null;
    const N = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    for (const [x, y, t] of rows) {
      const v = [x, y, 1];
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) N[i][j] += v[i] * v[j];
        N[i][3] += v[i] * t;
      }
    }
    for (let c = 0; c < 3; c++) {
      let p = c;
      for (let k = c + 1; k < 3; k++) if (Math.abs(N[k][c]) > Math.abs(N[p][c])) p = k;
      [N[c], N[p]] = [N[p], N[c]];
      if (Math.abs(N[c][c]) < 1e-9) return null;
      for (let k = 0; k < 3; k++) {
        if (k === c) continue;
        const f = N[k][c] / N[c][c];
        for (let j = c; j < 4; j++) N[k][j] -= f * N[c][j];
      }
    }
    return N.map((row, i) => row[3] / N[i][i]);
  };
  const ax = solve3(src.map((p, i) => [p.x, p.y, dst[i].x]).filter((_, i) => axes[i].x));
  const ay = solve3(src.map((p, i) => [p.x, p.y, dst[i].y]).filter((_, i) => axes[i].y));
  return ax && ay ? [...ax, ...ay, 0, 0, 1] : null;
}

/**
 * Resample the photo onto the released page's own pixel grid through `h`
 * (released pixel -> photo pixel). Straight from the photo, so it is
 * interpolated once however many times the fit is refined.
 */
function warpToRelease(photo, pw, ph, h, W, H) {
  const out = Buffer.alloc(W * H * 3);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = h[6] * x + h[7] * y + h[8];
      const sx = (h[0] * x + h[1] * y + h[2]) / d;
      const sy = (h[3] * x + h[4] * y + h[5]) / d;
      const x0 = Math.max(0, Math.min(pw - 2, Math.floor(sx)));
      const y0 = Math.max(0, Math.min(ph - 2, Math.floor(sy)));
      const fx = Math.max(0, Math.min(1, sx - x0));
      const fy = Math.max(0, Math.min(1, sy - y0));
      const i00 = (y0 * pw + x0) * 3;
      const i01 = i00 + 3;
      const i10 = i00 + pw * 3;
      const i11 = i10 + 3;
      const o = (y * W + x) * 3;
      for (let c = 0; c < 3; c++) {
        out[o + c] =
          photo[i00 + c] * (1 - fx) * (1 - fy) +
          photo[i01 + c] * fx * (1 - fy) +
          photo[i10 + c] * (1 - fx) * fy +
          photo[i11 + c] * fx * fy;
      }
    }
  }
  return out;
}

const toGrey = (rgb, n) => {
  const g = new Float32Array(n);
  for (let i = 0; i < n; i++)
    g[i] = 0.299 * rgb[i * 3] + 0.587 * rgb[i * 3 + 1] + 0.114 * rgb[i * 3 + 2];
  return g;
};

/**
 * Register a photo onto a release exactly.
 *
 * Starting from a rough mapping (the detected corners, or a located quad),
 * warp the photo onto the release's grid, then measure how far each patch of
 * the page still is from where the release has it: every textured tile in a
 * grid across the page is matched against the release by correlation. Those
 * offsets, carried back into the photo, give a least-squares homography far
 * more exact than four corners found at a fraction of the photo's
 * resolution. A few rounds settle it to a fraction of a pixel.
 *
 * @returns {Promise<{ buffer:Buffer, visible:object, residual:number }|null>}
 */
async function registerOnto(photoBuf, h0, release) {
  const { data: photo, info } = await sharp(photoBuf)
    .removeAlpha()
    .toColourspace('srgb')
    .raw()
    .toBuffer({ resolveWithObject: true });
  const W = release.width;
  const H = release.height;
  const refRgb = await sharp(release.buffer).removeAlpha().toColourspace('srgb').raw().toBuffer();
  const ref = toGrey(refRgb, W * H);

  // The tiles worth matching: those with texture in the release. A blank
  // margin correlates with everything and pins nothing.
  const T = 48; // half-size of a tile, released pixels
  const tiles = [];
  for (let gy = 0; gy < 9; gy++) {
    for (let gx = 0; gx < 7; gx++) {
      const cx = Math.round(T + ((W - 2 * T) * gx) / 6);
      const cy = Math.round(T + ((H - 2 * T) * gy) / 8);
      let s = 0;
      let ss = 0;
      for (let y = cy - T; y < cy + T; y += 2)
        for (let x = cx - T; x < cx + T; x += 2) {
          const v = ref[y * W + x];
          s += v;
          ss += v * v;
        }
      const n = T * T;
      if (ss / n - (s / n) ** 2 > 60) tiles.push({ cx, cy });
    }
  }
  if (tiles.length < 6) return null;

  // The part of the page the photo covers, in released pixels: the photo's
  // own corners carried back onto the page, and the largest upright
  // rectangle inside them.
  const coverage = (hm) => {
    const inv = homography(
      corners(W, H).map((c) => mapPt(hm, c.x, c.y)),
      corners(W, H)
    );
    const [tl, tr, br, bl] = corners(info.width, info.height).map((c) => mapPt(inv, c.x, c.y));
    const v = {
      x0: Math.max(0, Math.ceil(Math.max(tl.x, bl.x)) + 1),
      y0: Math.max(0, Math.ceil(Math.max(tl.y, tr.y)) + 1),
      x1: Math.min(W, Math.floor(Math.min(tr.x, br.x)) - 1),
      y1: Math.min(H, Math.floor(Math.min(bl.y, br.y)) - 1),
    };
    return v.x1 - v.x0 >= 64 && v.y1 - v.y0 >= 64 ? v : null;
  };

  let h = h0;
  let residual = Infinity;
  for (let round = 0, reach = 14; round < 6; round++, reach = Math.max(3, reach >> 1)) {
    const vis = coverage(h);
    if (!vis) break;
    const warped = toGrey(warpToRelease(photo, info.width, info.height, h, W, H), W * H);
    const src = [];
    const dst = [];
    const axes = [];
    const shifts = [];
    const offs = [];
    for (const { cx, cy } of tiles) {
      // Only tiles the photo shows in full.
      if (cx - T < vis.x0 || cy - T < vis.y0 || cx + T > vis.x1 || cy + T > vis.y1) continue;
      const side = 2 * reach + 1;
      const rs = new Float32Array(side * side).fill(-2);
      let best = null;
      for (let dy = -reach; dy <= reach; dy++) {
        for (let dx = -reach; dx <= reach; dx++) {
          let sa = 0;
          let sb = 0;
          let saa = 0;
          let sbb = 0;
          let sab = 0;
          let n = 0;
          for (let y = cy - T; y < cy + T; y += 2) {
            const wy = y + dy;
            if (wy < 0 || wy >= H) continue;
            const ro = y * W;
            const wo = wy * W + dx;
            for (let x = cx - T; x < cx + T; x += 2) {
              const wx = x + dx;
              if (wx < 0 || wx >= W) continue;
              const a = ref[ro + x];
              const b = warped[wo + x];
              sa += a;
              sb += b;
              saa += a * a;
              sbb += b * b;
              sab += a * b;
              n++;
            }
          }
          const va = saa - (sa * sa) / n;
          const vb = sbb - (sb * sb) / n;
          if (va <= 1e-6 || vb <= 1e-6) continue;
          const r = (sab - (sa * sb) / n) / Math.sqrt(va * vb);
          rs[(dy + reach) * side + dx + reach] = r;
          if (!best || r > best.r) best = { r, dx, dy };
        }
      }
      if (!best || best.r < 0.6) continue;
      const at = (dx, dy) =>
        Math.abs(dx) <= reach && Math.abs(dy) <= reach ? rs[(dy + reach) * side + dx + reach] : -2;
      // A tile pins the page only if its peak is sharp both ways. A line of
      // text matches itself anywhere along its length, so on its own it says
      // where the page is vertically and nothing about where it is across.
      const drop = (a, b) => best.r - Math.max(a, b);
      const pins = {
        x: drop(at(best.dx - 2, best.dy), at(best.dx + 2, best.dy)) >= 0.005,
        y: drop(at(best.dx, best.dy - 2), at(best.dx, best.dy + 2)) >= 0.005,
      };
      if (!pins.x && !pins.y) continue;
      // Sub-pixel: a parabola through the peak and its two neighbours on
      // each axis. Whole-pixel offsets alone leave the fit a pixel short.
      const vertex = (m, c, p) => {
        const den = m - 2 * c + p;
        return m > -2 && p > -2 && den < 0
          ? Math.max(-0.5, Math.min(0.5, (0.5 * (m - p)) / den))
          : 0;
      };
      const fx = best.dx + vertex(at(best.dx - 1, best.dy), best.r, at(best.dx + 1, best.dy));
      const fy = best.dy + vertex(at(best.dx, best.dy - 1), best.r, at(best.dx, best.dy + 1));
      // The release's (cx, cy) shows up at (cx+fx, cy+fy) of the warp, which
      // the current mapping takes to this point of the photo.
      src.push({ x: cx, y: cy });
      dst.push(mapPt(h, cx + (pins.x ? fx : 0), cy + (pins.y ? fy : 0)));
      axes.push(pins);
      shifts.push({ fx, fy, pins });
      offs.push(Math.hypot(pins.x ? fx : 0, pins.y ? fy : 0));
    }
    const xs = shifts.filter((t) => t.pins.x).map((t) => t.fx);
    const ys = shifts.filter((t) => t.pins.y).map((t) => t.fy);
    if (!xs.length && !ys.length) break;
    let next;
    if (xs.length < 3 || ys.length < 3) {
      // Too few constraints on one axis for a full perspective fit — a slice
      // of text pins the page vertically and hardly at all across. Move the
      // mapping by the median shift instead, which cannot run away.
      const med = (v) => (v.length ? [...v].sort((a, b) => a - b)[v.length >> 1] : 0);
      const mx = med(xs);
      const my = med(ys);
      next = [
        h[0],
        h[1],
        h[0] * mx + h[1] * my + h[2],
        h[3],
        h[4],
        h[3] * mx + h[4] * my + h[5],
        h[6],
        h[7],
        h[6] * mx + h[7] * my + h[8],
      ];
    } else if (xs.length < 8 || ys.length < 8) {
      next = fitAffineAxes(src, dst, axes);
    } else {
      next = fitHomography(src, dst, axes);
    }
    if (!next || !coverage(next)) break;
    // Drop the tiles the fit explains worst — a repeated pattern such as
    // lines of text can lock a tile onto the wrong line — and fit again.
    const err = src.map((p, i) => {
      const q = mapPt(next, p.x, p.y);
      return Math.hypot(axes[i].x ? q.x - dst[i].x : 0, axes[i].y ? q.y - dst[i].y : 0);
    });
    const cut = [...err].sort((a, b) => a - b)[Math.floor(err.length * 0.8)];
    const keepIdx = err.map((e, i) => (e <= Math.max(cut, 0.75) ? i : -1)).filter((i) => i >= 0);
    if (keepIdx.length >= 6 && keepIdx.length < src.length && xs.length >= 8 && ys.length >= 8) {
      next =
        fitHomography(
          keepIdx.map((i) => src[i]),
          keepIdx.map((i) => dst[i]),
          keepIdx.map((i) => axes[i])
        ) ?? next;
    }
    h = next;
    residual = offs.reduce((a, b) => a + b, 0) / offs.length;
    if (residual < 0.15) break;
  }

  const vis = coverage(h);
  if (!vis) return null;

  // Tone-match on the covered part only; outside it the warp holds edge
  // smear, which carries no votes but would skew the tone curve.
  const region = { left: vis.x0, top: vis.y0, width: vis.x1 - vis.x0, height: vis.y1 - vis.y0 };
  const rgb = warpToRelease(photo, info.width, info.height, h, W, H);
  const seen = await sharp(rgb, { raw: { width: W, height: H, channels: 3 } })
    .extract(region)
    .png()
    .toBuffer();
  const refPart = await sharp(release.buffer).removeAlpha().extract(region).png().toBuffer();
  const toned = await matchTones(seen, refPart);
  const buffer = await sharp({
    create: { width: W, height: H, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .composite([{ input: toned, left: vis.x0, top: vis.y0 }])
    .png()
    .toBuffer();
  return { buffer, visible: vis, residual: Math.round(residual * 100) / 100 };
}

/* -------------------------------------------------------------- public --- */

/** Longest side a capture is worked at. A phone photo is often 4000+ px; the
    page inside it rarely needs more than this to be read at released size. */
const WORK_SIDE = 2400;
/** Placements read per view: the best-scoring ones only. */
const READ_TOP = 3;

/** Read a registered page against the release it was registered onto. */
async function readRegistered(reg, release) {
  const reading = await extractVisible(reg.buffer, release.deltaUsed, reg.visible);
  return {
    reading,
    matches: bitsMatching(reading.payloadBits, release.payloadBits),
    visible: reg.visible,
    canvas: reg.buffer,
  };
}

/**
 * Try to read a capture against each candidate release.
 *
 * @param {Buffer} buffer    the uploaded capture
 * @param {Array<{id:number, payloadBits:string, deltaUsed:number, buffer:Buffer}>} releases
 *        candidate releases with their released copies, most likely first
 * @param {{ minBits?:number, budgetMs?:number }} opts
 * @returns {Promise<null|{ releaseId:number, reading:object, matches:number,
 *          method:'locate'|'quad', fit:object, visible:object, visibleShare:number,
 *          canvas:Buffer, corners:object[]|null }>}
 */
export async function recoverFromCapture(
  buffer,
  releases,
  { minBits = 40, budgetMs = 60000 } = {}
) {
  const started = Date.now();
  const late = () => Date.now() - started > budgetMs;
  const photo = await sharp(buffer)
    .rotate()
    .resize({
      width: WORK_SIDE,
      height: WORK_SIDE,
      fit: 'inside',
      withoutEnlargement: true,
      kernel: 'lanczos3',
    })
    .png()
    .toBuffer();
  const photoMeta = await sharp(photo).metadata();

  const sized = [];
  for (const rel of releases) {
    const m = await sharp(rel.buffer).metadata();
    sized.push({ ...rel, width: m.width, height: m.height });
  }

  let best = null;
  const keep = (method, rel, fit, read, quadCorners = null) => {
    if (best && read.matches <= best.matches) return;
    const v = read.visible;
    best = {
      releaseId: rel.id,
      reading: read.reading,
      matches: read.matches,
      method,
      corners: quadCorners,
      fit,
      visible: v,
      canvas: read.canvas,
      visibleShare:
        Math.round((((v.x1 - v.x0) * (v.y1 - v.y0)) / (rel.width * rel.height)) * 100) / 100,
    };
  };
  const done = () => best && best.matches >= 46;

  // Place every release coarsely, then finely only the most convincing few:
  // the fine passes cost far more than the coarse one.
  const placeAll = async (view, meta) => {
    const coarse = [];
    for (const rel of sized) {
      if (late()) break;
      const fits = await coarseLocate(view, meta, rel);
      if (fits.length) coarse.push({ rel, fits });
    }
    coarse.sort((a, b) => b.fits[0].s - a.fits[0].s);
    const placed = [];
    for (const { rel, fits } of coarse.slice(0, READ_TOP)) {
      if (late()) break;
      const fit = await locate(view, meta, rel, fits);
      if (fit) placed.push({ rel, fit });
    }
    return placed.sort((a, b) => b.fit.score - a.fit.score);
  };

  // --- a photo of a screen or a sheet: a bright quadrilateral --------------
  // Flatten it by its corners, find each release on the flattened page, then
  // register the photo itself onto the release — the corners alone are found
  // at a fraction of the photo's resolution and are not exact enough.
  const quad = await detectQuad(photo).catch(() => null);
  if (quad && quad.coverage < 0.97) {
    try {
      const flat = await dewarp(photo, quad.corners);
      const flatMeta = { width: flat.width, height: flat.height };
      const flatToPhoto = homography(corners(flat.width, flat.height), quad.corners);
      for (const { rel, fit } of await placeAll(flat.buffer, flatMeta)) {
        if (late() || done()) break;
        // Released page corner -> flattened page -> photo.
        const onPhoto = corners(rel.width, rel.height).map((c) => {
          const f = { x: fit.x + c.x * fit.scale, y: fit.y + c.y * fit.scale };
          return mapPt(flatToPhoto, f.x, f.y);
        });
        const h0 = homography(corners(rel.width, rel.height), onPhoto);
        const reg = await registerOnto(photo, h0, rel);
        if (reg)
          keep(
            'quad',
            rel,
            { ...fit, residual: reg.residual },
            await readRegistered(reg, rel),
            quad.corners
          );
      }
    } catch {
      // A degenerate quadrilateral just leaves the capture to the search below.
    }
    if (best && best.matches >= minBits) return best;
  }

  // --- a screenshot, a crop: the page somewhere inside, at some scale ------
  for (const { rel, fit } of await placeAll(photo, photoMeta)) {
    if (late() || done()) break;
    const read = await readAligned(photo, photoMeta, rel, fit);
    if (read) keep('locate', rel, read.fit ? { ...read.fit, score: fit.score } : fit, read);
    // Not read cleanly: register it as well, which also absorbs a slight
    // keystone or a viewer that stretched the page unevenly.
    if (!done() && (!read || read.matches < minBits)) {
      const h0 = [fit.scale, 0, fit.x, 0, fit.scale, fit.y, 0, 0, 1];
      const reg = await registerOnto(photo, h0, rel);
      if (reg)
        keep('locate', rel, { ...fit, residual: reg.residual }, await readRegistered(reg, rel));
    }
  }
  return best && best.matches >= minBits ? best : null;
}
