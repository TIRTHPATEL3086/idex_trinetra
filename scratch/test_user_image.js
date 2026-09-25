import sharp from 'sharp';
import fs from 'fs';

async function check() {
  const p = 'C:\\Users\\mrp23\\.gemini\\antigravity-ide\\brain\\141540fd-699c-40a0-9d1b-7c460d982020\\.user_uploaded\\media_1790344414906.png';
  if (!fs.existsSync(p)) {
    console.log('File does not exist:', p);
    return;
  }
  const meta = await sharp(p).metadata();
  console.log('Image metadata:', meta);
}
check();
