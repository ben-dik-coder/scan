/**
 * Removes edge-connected near-black background (e.g. solid black outside icon art).
 * Same flood logic as white-to-alpha; keep threshold conservative so icon art rarely touches edges.
 */
import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rel = process.argv[2] || 'public/icons/kamera.png';
const input = join(__dirname, '..', rel);
const output = input;

function isBg(r, g, b) {
  const mx = Math.max(r, g, b);
  const sum = r + g + b;
  return mx <= 34 && sum <= 105;
}

async function main() {
  const { data, info } = await sharp(readFileSync(input))
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const { width: w, height: h, channels } = info;
  if (channels !== 4) throw new Error(`expected 4 channels, got ${channels}`);

  const out = Buffer.from(data);
  const seen = new Uint8Array(w * h);
  const q = [];

  function push(x, y) {
    const k = y * w + x;
    if (seen[k]) return;
    const i = k * 4;
    const r = out[i];
    const g = out[i + 1];
    const b = out[i + 2];
    if (out[i + 3] < 8) return;
    if (!isBg(r, g, b)) return;
    seen[k] = 1;
    q.push(k);
  }

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (q.length) {
    const k = q.pop();
    const i = k * 4;
    out[i + 3] = 0;
    const x = k % w;
    const y = (k / w) | 0;
    if (x > 0) push(x - 1, y);
    if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1);
    if (y < h - 1) push(x, y + 1);
  }

  const png = await sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  writeFileSync(output, png);
  console.log('Wrote', output, `${w}x${h}, dark→alpha (edge flood)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
