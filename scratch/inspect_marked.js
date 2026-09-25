import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { extract } from '../server/core/watermark.js';
import { parsePayload } from '../server/core/payload.js';

async function main() {
  const dir = './data/marked';
  const files = fs.readdirSync(dir);
  console.log(`Found ${files.length} marked files:`);
  for (const f of files) {
    if (!f.endsWith('.png')) continue;
    const full = path.join(dir, f);
    const buf = fs.readFileSync(full);
    const meta = await sharp(buf).metadata();
    try {
      const res = await extract(buf);
      let parsed = null;
      try {
        parsed = parsePayload(res.payloadBits);
      } catch (e) {
        parsed = { error: e.message };
      }
      console.log(`File: ${f} (${meta.width}x${meta.height}) => bits: ${res.payloadBits} | shortId: ${parsed?.shortId} | crcOk: ${parsed?.crcOk}`);
    } catch (err) {
      console.log(`File: ${f} error: ${err.message}`);
    }
  }
}

main().catch(console.error);
