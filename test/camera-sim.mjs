/**
 * Simulated "phone photo of a monitor", for testing the optical lens.
 *
 * Takes a released copy and applies what a real camera capture does: the
 * display upscales it, the monitor's pixel grid beats against the sensor
 * (moire), the phone is held at an angle (perspective), the camera changes
 * exposure and white balance, the lens blurs, the sensor adds noise and the
 * phone saves a JPEG.
 *
 *   import { cameraPhoto } from './camera-sim.mjs'
 */
import sharp from 'sharp';
import { homography } from '../server/core/lens.js';

/** Deterministic PRNG so a test run is repeatable. */
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32;
}

/**
 * @param {Buffer} marked  the released copy
 * @param {object} o       strengths; defaults approximate a handheld phone shot
 * @returns {Promise<{buffer:Buffer, corners:{x:number,y:number}[]}>}
 */
export async function cameraPhoto(marked, o = {}) {
  const {
    displayScale = 3,
    moireAmp = 9,
    tilt = 0.12, // keystone as a fraction of the page size
    gain = 0.82,
    offset = 18,
    warm = 1.06, // red gain vs blue
    blur = 0.8,
    noise = 4,
    quality = 85,
    seed = 7,
  } = o;
  const rand = rng(seed);
  const meta = await sharp(marked).metadata();
  const dw = meta.width * displayScale;
  const dh = meta.height * displayScale;

  // 1. On the monitor: upscaled, with the pixel-grid interference.
  const disp = await sharp(marked)
    .resize(dw, dh, { kernel: 'cubic' })
    .removeAlpha()
    .raw()
    .toBuffer();
  for (let y = 0; y < dh; y++)
    for (let x = 0; x < dw; x++) {
      const m =
        moireAmp * Math.sin(2 * Math.PI * (0.173 * x + 0.061 * y)) +
        (moireAmp / 2) * Math.sin(2 * Math.PI * (0.052 * x - 0.141 * y));
      for (let c = 0; c < 3; c++) {
        const i = (y * dw + x) * 3 + c;
        disp[i] = Math.max(0, Math.min(255, disp[i] + m));
      }
    }

  // 2. Photographed at an angle onto a dark desk, with exposure and colour cast.
  const PW = Math.round(dw * 1.45);
  const PH = Math.round(dh * 1.5);
  const ox = (PW - dw) / 2;
  const oy = (PH - dh) / 2;
  const t = tilt;
  const corners = [
    { x: ox + dw * t * 0.9, y: oy + dh * t * 0.5 },
    { x: ox + dw * (1 - t * 0.3), y: oy - dh * t * 0.2 },
    { x: ox + dw * (1 + t * 0.2), y: oy + dh * (1 + t * 0.15) },
    { x: ox - dw * t * 0.4, y: oy + dh * (1 - t * 0.35) },
  ].map((p) => ({ x: Math.round(p.x), y: Math.round(p.y) }));
  const Hm = homography(corners, [
    { x: 0, y: 0 },
    { x: dw - 1, y: 0 },
    { x: dw - 1, y: dh - 1 },
    { x: 0, y: dh - 1 },
  ]);
  const photo = Buffer.alloc(PW * PH * 3);
  const cast = [warm, 1, 1 / warm];
  for (let y = 0; y < PH; y++)
    for (let x = 0; x < PW; x++) {
      const d = Hm[6] * x + Hm[7] * y + Hm[8];
      const sx = (Hm[0] * x + Hm[1] * y + Hm[2]) / d;
      const sy = (Hm[3] * x + Hm[4] * y + Hm[5]) / d;
      const o3 = (y * PW + x) * 3;
      if (sx < 0 || sy < 0 || sx > dw - 2 || sy > dh - 2) {
        const desk = 22 + 10 * rand();
        photo[o3] = desk;
        photo[o3 + 1] = desk * 0.95;
        photo[o3 + 2] = desk * 0.9;
        continue;
      }
      const x0 = Math.floor(sx);
      const y0 = Math.floor(sy);
      const fx = sx - x0;
      const fy = sy - y0;
      for (let c = 0; c < 3; c++) {
        const p = (yy, xx) => disp[(yy * dw + xx) * 3 + c];
        const v =
          p(y0, x0) * (1 - fx) * (1 - fy) +
          p(y0, x0 + 1) * fx * (1 - fy) +
          p(y0 + 1, x0) * (1 - fx) * fy +
          p(y0 + 1, x0 + 1) * fx * fy;
        photo[o3 + c] = Math.max(
          0,
          Math.min(255, (v * gain + offset) * cast[c] + noise * (rand() - 0.5) * 2)
        );
      }
    }

  // 3. Lens blur and the phone's JPEG.
  const buffer = await sharp(photo, { raw: { width: PW, height: PH, channels: 3 } })
    .blur(blur > 0.3 ? blur : 0.3)
    .jpeg({ quality })
    .toBuffer();
  return { buffer, corners };
}
