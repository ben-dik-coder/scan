/**
 * Trim alpha, then scale each icon to the same square canvas so visual size matches in UI.
 * Run after replacing PNGs: node scripts/normalize-home-icons.mjs
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = 512;
const ICONS = [
  'registrering.png',
  'kamera.png',
  'kontraktai.png',
  'album.png',
  'delsky.png',
];

async function run() {
  for (const name of ICONS) {
    const filePath = join(__dirname, '../public/icons', name);
    const buf = readFileSync(filePath);
    const out = await sharp(buf)
      .ensureAlpha()
      .trim()
      .resize(OUT, OUT, {
        fit: 'contain',
        position: 'centre',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .png({ compressionLevel: 9 })
      .toBuffer();
    writeFileSync(filePath, out);
    const m = await sharp(out).metadata();
    console.log(name, `${m.width}x${m.height}`);
  }
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
