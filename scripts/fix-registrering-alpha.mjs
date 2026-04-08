/**
 * Makes outer "checkerboard preview" pixels transparent on registrering.png.
 * Source file is JPEG-in-PNG without alpha; those gray/white squares are opaque pixels.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const input = join(__dirname, '../public/icons/registrering.png');
const output = join(__dirname, '../public/icons/registrering.png');

const EDGE_FRAC = 0.22; // outer band where checkerboard lives
const MIN_LUM = 168; // gray/white checkerboard
const MAX_SAT = 0.19; // low saturation = gray/white, not colored icon parts

async function main() {
  const img = sharp(readFileSync(input));
  const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  if (channels !== 4) throw new Error(`expected 4 channels, got ${channels}`);

  const edge = Math.round(Math.min(w, h) * EDGE_FRAC);
  const out = Buffer.from(data);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const d = Math.min(x, y, w - 1 - x, h - 1 - y);
      if (d > edge) continue;

      const i = (y * w + x) * 4;
      const r = out[i] / 255;
      const g = out[i + 1] / 255;
      const b = out[i + 2] / 255;
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      const mx = Math.max(r, g, b);
      const mn = Math.min(r, g, b);
      const sat = mx - mn;

      if (lum >= MIN_LUM / 255 && sat <= MAX_SAT) {
        out[i + 3] = 0;
      }
    }
  }

  const png = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  writeFileSync(output, png);
  console.log('Wrote', output, `${w}x${h}, alpha fixed (edge band)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
