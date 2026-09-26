import fs from 'fs';
import { detectQuad } from '../server/core/lens.js';

async function main() {
  const p = 'C:\\Users\\mrp23\\Downloads\\WhatsApp Image 2026-09-25 at 8.56.47 PM.jpeg';
  const buf = fs.readFileSync(p);
  const res = await detectQuad(buf);
  console.log('detectQuad result:', res);
}
main();
