/**
 * ============================================================================
 *  OWNER: PERSON A  (deliverable A7)  —  THIS TABLE WINS THE ROUND
 *  B and C: do not edit. Run it with `npm run attack:suite`.
 * ============================================================================
 *
 * Embeds a known 48-bit payload, runs 8 attacks against the marked image, tries
 * to extract the payload back from each, prints a table, and writes
 * `test/metrics.json` — which B serves at /api/metrics and C charts (C7).
 *
 * TARGETS (§5.3). These are the numbers to beat, not the numbers we have:
 *
 *  # | Attack              | How to produce it                        | Target
 * ---+---------------------+------------------------------------------+--------
 *  1 | JPEG quality 90     | sharp(buf).jpeg({quality:90})            | 48/48
 *  2 | JPEG quality 75     | same, q=75                               | >=46/48
 *  3 | JPEG quality 60     | same, q=60                               | >=44/48
 *  4 | JPEG quality 45     | same, q=45                               | >=41/48
 *  5 | Resize 50% and back | sharp().resize(w/2).resize(w)            | >=43/48
 *  6 | Crop 20% from edges | sharp().extract({...})                   | >=40/48
 *  7 | Gaussian noise      | add N(0, sigma) per pixel                | >=42/48
 *  8 | Screenshot sim      | resize + JPEG q80 + slight brightness    | >=40/48
 *
 * The H8 GO/NO-GO gate is attack #2: 46+/48 bits must survive JPEG q75.
 * If it does not, switch to the DCT fallback immediately — do not keep tuning.
 *
 * Also sweep DELTA over [4, 8, 12, 16, 24] to produce `psnrCurve`, which is the
 * "invisible vs robust" trade-off graph. That chart is what makes the choice of
 * DELTA=12 look measured rather than guessed.
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, 'metrics.json');

const ATTACKS = [
  { name: 'JPEG q90', target: 48 },
  { name: 'JPEG q75', target: 46 },
  { name: 'JPEG q60', target: 44 },
  { name: 'JPEG q45', target: 41 },
  { name: 'Resize 50%', target: 43 },
  { name: 'Crop 20%', target: 40 },
  { name: 'Gaussian noise', target: 42 },
  { name: 'Screenshot sim', target: 40 },
];

const DELTAS = [4, 8, 12, 16, 24];

async function main() {
  console.log('\n  Attack suite — SIH26237\n');

  // TODO(A): replace everything below with the real runs.
  //   1. load a sample image from test/fixtures/
  //   2. payloadBits = buildPayload(<some receiptId>)  [server/core/payload.js]
  //   3. { buffer, psnrDb } = await embed(original, payloadBits, delta)
  //   4. for each attack: attacked = await attack(buffer)
  //                       { payloadBits: got } = await extract(attacked)
  //                       bitsRecovered = bitsMatching(payloadBits, got)
  //   5. for each delta in DELTAS: record psnrDb + bitsRecovered after JPEG q75
  //   6. write metrics.json in the shape below

  console.log('  NOT IMPLEMENTED — this is Person A (deliverable A7).');
  console.log('  Targets:\n');
  for (const a of ATTACKS) {
    console.log(`    ${a.name.padEnd(16)} >= ${a.target}/48`);
  }
  console.log(`\n  Delta sweep: ${DELTAS.join(', ')}`);
  console.log(`\n  Writes: ${path.relative(process.cwd(), OUT)}`);
  console.log('  Served by B at GET /api/metrics, charted by C (C7).\n');

  // Shape contract — do not change without telling B and C.
  const metrics = {
    source: 'not-run',
    generatedAt: new Date().toISOString(),
    attacks: ATTACKS.map((a) => ({
      name: a.name,
      survived: null,
      bitsRecovered: null,
      psnrDb: null,
      target: a.target,
    })),
    psnrCurve: DELTAS.map((delta) => ({ delta, psnrDb: null, bitsRecovered: null })),
  };

  await fs.writeFile(OUT, JSON.stringify(metrics, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
