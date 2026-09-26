import sharp from 'sharp';
import fs from 'fs';
import { hashes, hamming } from '../server/core/phash.js';

async function main() {
  const leakPath = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  const targetPath = 'D:\\LDRP\\PROJECTS\\SIH_CRYPTO\\Crypto-2\\data\\marked\\7a5f6c0aa5abfb4a.png';

  const leakBuf = fs.readFileSync(leakPath);
  const targetBuf = fs.readFileSync(targetPath);
  const targetHashes = await hashes(targetBuf);

  console.log('Target pHash:', targetHashes.pHash.toString(16));

  // Let's grid search around y: 180 to 240, h: 420 to 520, x: 50 to 110, w: 720 to 800
  let best = { pDist: 64, dDist: 64, top: 0, left: 0, width: 0, height: 0 };

  for (let top = 180; top <= 240; top += 15) {
    for (let height = 400; height <= 500; height += 20) {
      for (let left = 60; left <= 110; left += 15) {
        for (let width = 720; width <= 800; width += 20) {
          const crop = await sharp(leakBuf)
            .extract({ left, top, width, height })
            .resize(2400, 1350, { fit: 'fill' })
            .png()
            .toBuffer();
          const h = await hashes(crop);
          const pDist = hamming(h.pHash, targetHashes.pHash);
          const dDist = hamming(h.dHash, targetHashes.dHash);
          if (pDist < best.pDist || (pDist === best.pDist && dDist < best.dDist)) {
            best = { pDist, dDist, top, height, left, width };
            console.log(`New best: pDist=${pDist}, dDist=${dDist} at left=${left}, top=${top}, w=${width}, h=${height}`);
          }
        }
      }
    }
  }

  console.log('\nFinal Optimal Crop:', best);
}

main().catch(console.error);
