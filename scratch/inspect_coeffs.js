import sharp from 'sharp';
import fs from 'fs';
import { env } from '../server/lib/env.js';

async function main() {
  const origPath = 'D:\\LDRP\\PROJECTS\\SIH_CRYPTO\\Crypto-2\\data\\marked\\7a5f6c0aa5abfb4a.png';
  const leakPath = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';

  const origBuf = fs.readFileSync(origPath);
  const cropBuf = await sharp(leakPath)
    .extract({ left: 75, top: 180, width: 800, height: 480 })
    .resize(2400, 1350, { fit: 'fill' })
    .png()
    .toBuffer();

  const origRGB = await sharp(origBuf).removeAlpha().raw().toBuffer();
  const cropRGB = await sharp(cropBuf).removeAlpha().raw().toBuffer();

  // Compare pixel values at center
  console.log('Sample orig RGB at (1200, 675):', origRGB[ (675*2400 + 1200)*3 ], origRGB[ (675*2400 + 1200)*3 + 1 ], origRGB[ (675*2400 + 1200)*3 + 2 ]);
  console.log('Sample crop RGB at (1200, 675):', cropRGB[ (675*2400 + 1200)*3 ], cropRGB[ (675*2400 + 1200)*3 + 1 ], cropRGB[ (675*2400 + 1200)*3 + 2 ]);
}

main().catch(console.error);
