import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { hashes, hamming } from '../server/core/phash.js';

async function main() {
  const dir = './data/marked';
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.png'));

  // Let's compute hashes for all marked files
  const markedHashes = [];
  for (const f of files) {
    const buf = fs.readFileSync(path.join(dir, f));
    const h = await hashes(buf);
    markedHashes.push({ file: f, hashes: h });
  }

  // Let's crop the "Code Cubicle" part from media_1790344414906.png
  // In the screenshot (655 x 1024), the preview image is around y=475 to 670, x=150 to 380
  // Let's inspect that region
  const userScreenshot = 'C:\\Users\\mrp23\\.gemini\\antigravity-ide\\brain\\141540fd-699c-40a0-9d1b-7c460d982020\\.user_uploaded\\media_1790344414906.png';
  const userCropBuf = await sharp(userScreenshot)
    .extract({ left: 155, top: 480, width: 225, height: 190 })
    .toBuffer();

  const userHashes = await hashes(userCropBuf);
  console.log('User crop pHash:', userHashes.pHash.toString(16));

  for (const m of markedHashes) {
    const pDist = hamming(userHashes.pHash, m.hashes.pHash);
    const dDist = hamming(userHashes.dHash, m.hashes.dHash);
    console.log(`File: ${m.file} => pDist: ${pDist}, dDist: ${dDist}`);
  }
}

main().catch(console.error);
