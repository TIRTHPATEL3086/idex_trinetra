import sharp from 'sharp';
import fs from 'fs';

async function main() {
  const p = './data/marked/03dbdab3702ea769.png';
  const meta = await sharp(p).metadata();
  console.log('03dbdab3702ea769.png metadata:', meta);
}
main();
