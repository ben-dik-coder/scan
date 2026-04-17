/**
 * Klipper ut de syv ikonene fra mockup-bildet (rutenett 4 + 3).
 * Juster konstantene øverst ved behov om utklipp ikke treffer perfekt.
 */
import sharp from 'sharp'
import { mkdir } from 'fs/promises'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const SRC = join(root, 'public/assets/home-dash-mockup-source.png')
const OUT = join(root, 'public/icons/home-dash')
const OUT_SIZE = 180

/** { name, left, top, width, height } i piksler for kildebildet */
const REGIONS = [
  { name: 'ny-registrering', left: 48, top: 40, width: 217, height: 165 },
  { name: 'kamera', left: 285, top: 40, width: 217, height: 165 },
  { name: 'kontrakter', left: 522, top: 40, width: 217, height: 165 },
  { name: 'album', left: 759, top: 40, width: 217, height: 165 },
  /* Bunnrad: tre ikoner venstre, «SCANIX APP ICONS» til høyre */
  { name: 'delsky', left: 72, top: 290, width: 200, height: 162 },
  { name: 'excel', left: 300, top: 290, width: 200, height: 162 },
  { name: 'strekning', left: 528, top: 290, width: 200, height: 162 },
]

async function main() {
  await mkdir(OUT, { recursive: true })
  const meta = await sharp(SRC).metadata()
  console.log('Kilde:', SRC, `${meta.width}×${meta.height}`)

  for (const r of REGIONS) {
    const outPath = join(OUT, `${r.name}.png`)
    await sharp(SRC)
      .extract({
        left: r.left,
        top: r.top,
        width: r.width,
        height: r.height,
      })
      .resize(OUT_SIZE, OUT_SIZE, {
        fit: 'cover',
        position: 'centre',
      })
      .png({ compressionLevel: 9 })
      .toFile(outPath)
    console.log('Skrev', outPath)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
