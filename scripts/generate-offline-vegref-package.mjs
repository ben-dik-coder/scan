import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const NVDB_SEGMENTERT =
  'https://nvdbapiles.atlas.vegvesen.no/vegnett/api/v4/veglenkesekvenser/segmentert'
const DEFAULT_CLIENT = 'Scanix'
const DEFAULT_PAGE_SIZE = 400

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')

function parseArgs(argv) {
  const out = {}
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i]
    if (!part.startsWith('--')) continue
    const key = part.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      out[key] = 'true'
      continue
    }
    out[key] = next
    i += 1
  }
  return out
}

function usageAndExit(message = '') {
  if (message) console.error(message)
  console.error(
    [
      'Usage:',
      '  node scripts/generate-offline-vegref-package.mjs \\',
      '    --bbox "minLng,minLat,maxLng,maxLat" \\',
      '    --version "beisfjord-2026-04-09" \\',
      '    --out "public/offline/vegref-data.json" \\',
      '    --manifest "public/offline/vegref-manifest.json"',
      '',
      'Fliser (flere små JSON-filer + regionTiles i manifest):',
      '  ... \\',
      '    --tile-split "2x2" \\',
      '    --out-dir "public/offline" \\',
      '    --tile-prefix "vegref-tile"',
    ].join('\n'),
  )
  process.exit(1)
}

function resolvePath(relOrAbs) {
  return path.isAbsolute(relOrAbs) ? relOrAbs : path.join(rootDir, relOrAbs)
}

function parseBbox(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null
  const parts = raw.split(',').map((v) => Number(v.trim()))
  if (parts.length !== 4 || parts.some((v) => !Number.isFinite(v))) return null
  const [minLng, minLat, maxLng, maxLat] = parts
  if (minLng >= maxLng || minLat >= maxLat) return null
  return { minLng, minLat, maxLng, maxLat }
}

function formatBbox(bbox) {
  return `${bbox.minLng},${bbox.minLat},${bbox.maxLng},${bbox.maxLat}`
}

/**
 * @param {{ minLng: number, minLat: number, maxLng: number, maxLat: number }} bbox
 * @param {number} cols
 * @param {number} rows
 */
function splitBbox(bbox, cols, rows) {
  const { minLng, minLat, maxLng, maxLat } = bbox
  const dLng = (maxLng - minLng) / cols
  const dLat = (maxLat - minLat) / rows
  /** @type {{ minLng: number, minLat: number, maxLng: number, maxLat: number }[]} */
  const tiles = []
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      tiles.push({
        minLng: minLng + c * dLng,
        minLat: minLat + r * dLat,
        maxLng: minLng + (c + 1) * dLng,
        maxLat: minLat + (r + 1) * dLat,
      })
    }
  }
  return tiles
}

/**
 * @param {string | undefined} raw e.g. "2x2"
 */
function parseTileSplit(raw) {
  if (typeof raw !== 'string' || !raw.includes('x')) return null
  const parts = raw.split('x').map((v) => Number(v.trim()))
  if (parts.length !== 2 || parts.some((v) => !Number.isFinite(v))) return null
  const [cols, rows] = parts
  if (cols < 1 || rows < 1 || cols > 12 || rows > 12) return null
  return { cols: Math.floor(cols), rows: Math.floor(rows) }
}

function normalizeSegment(seg) {
  return {
    id: seg?.id ?? null,
    geometri:
      seg?.geometri && typeof seg.geometri === 'object'
        ? {
            wkt: typeof seg.geometri.wkt === 'string' ? seg.geometri.wkt : '',
            lengde:
              typeof seg.geometri.lengde === 'number' ? seg.geometri.lengde : null,
          }
        : { wkt: '', lengde: null },
    vegsystemreferanse:
      seg?.vegsystemreferanse && typeof seg.vegsystemreferanse === 'object'
        ? seg.vegsystemreferanse
        : null,
    adresse:
      seg?.adresse && typeof seg.adresse === 'object'
        ? { navn: typeof seg.adresse.navn === 'string' ? seg.adresse.navn : '' }
        : { navn: '' },
    typeVeg: typeof seg?.typeVeg === 'string' ? seg.typeVeg : '',
    typeVeg_sosi: typeof seg?.typeVeg_sosi === 'string' ? seg.typeVeg_sosi : '',
  }
}

async function fetchPage(url) {
  const res = await fetch(url, {
    headers: {
      'X-Client': DEFAULT_CLIENT,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`NVDB ${res.status}${text ? `: ${text.slice(0, 200)}` : ''}`)
  }
  return res.json()
}

async function fetchAllSegments(bbox) {
  const startUrl = new URL(NVDB_SEGMENTERT)
  startUrl.searchParams.set('kartutsnitt', formatBbox(bbox))
  startUrl.searchParams.set('srid', '4326')
  startUrl.searchParams.set('antall', String(DEFAULT_PAGE_SIZE))
  startUrl.searchParams.set('inkluderAntall', 'false')

  const rows = []
  const seenIds = new Set()
  let nextUrl = startUrl.toString()
  let page = 0

  while (nextUrl) {
    page += 1
    const data = await fetchPage(nextUrl)
    const objs = Array.isArray(data?.objekter) ? data.objekter : []
    for (const seg of objs) {
      const key =
        seg?.id != null
          ? `id:${seg.id}`
          : typeof seg?.vegsystemreferanse?.kortform === 'string'
            ? `kf:${seg.vegsystemreferanse.kortform}`
            : JSON.stringify(seg?.geometri?.wkt || seg)
      if (seenIds.has(key)) continue
      seenIds.add(key)
      rows.push(normalizeSegment(seg))
    }
    const nextHref =
      typeof data?.metadata?.neste?.href === 'string'
        ? data.metadata.neste.href
        : ''
    nextUrl = nextHref || ''
    console.log(`Fetched page ${page} (${objs.length} segments, total ${rows.length})`)
    if (!objs.length) break
  }

  return rows
}

async function writeJson(targetPath, value) {
  await fs.mkdir(path.dirname(targetPath), { recursive: true })
  await fs.writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8')
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const bbox = parseBbox(args.bbox)
  if (!bbox) usageAndExit('Missing or invalid --bbox')

  const version =
    typeof args.version === 'string' && args.version.trim()
      ? args.version.trim()
      : `offline-${new Date().toISOString().slice(0, 10)}`
  const manifestPath = resolvePath(
    args.manifest || 'public/offline/vegref-manifest.json',
  )
  const generatedAt = new Date().toISOString()
  const tileSplit = parseTileSplit(args['tile-split'] || args.tileSplit)

  if (tileSplit) {
    const outDir = resolvePath(args['out-dir'] || 'public/offline')
    const tilePrefix =
      typeof args['tile-prefix'] === 'string' && args['tile-prefix'].trim()
        ? args['tile-prefix'].trim()
        : 'vegref-tile'
    const tiles = splitBbox(bbox, tileSplit.cols, tileSplit.rows)
    /** @type {{ name: string, tileIndex: number, bbox: object, dataUrl: string }[]} */
    const regionTiles = []
    let total = 0
    for (let i = 0; i < tiles.length; i += 1) {
      const tb = tiles[i]
      console.log(
        `Tile ${i + 1}/${tiles.length}: fetching NVDB for ${formatBbox(tb)} ...`,
      )
      const segments = await fetchAllSegments(tb)
      total += segments.length
      const tilePath = path.join(outDir, `${tilePrefix}-${i}.json`)
      const pkg = {
        version,
        generatedAt,
        source: {
          type: 'nvdb-segmentert',
          bbox: tb,
        },
        segments,
      }
      await writeJson(tilePath, pkg)
      const relTile = `/${path.relative(path.join(rootDir, 'public'), tilePath).replaceAll(path.sep, '/')}`
      regionTiles.push({
        name: `${tilePrefix}-${i}`,
        tileIndex: i,
        bbox: tb,
        dataUrl: relTile,
      })
    }
    const manifest = {
      version,
      generatedAt,
      regionTiles,
    }
    await writeJson(manifestPath, manifest)
    console.log(
      JSON.stringify(
        {
          ok: true,
          mode: 'tiles',
          version,
          generatedAt,
          tileSplit: `${tileSplit.cols}x${tileSplit.rows}`,
          segmentCount: total,
          regionTiles: regionTiles.length,
          manifest: path.relative(rootDir, manifestPath),
        },
        null,
        2,
      ),
    )
    return
  }

  const outPath = resolvePath(args.out || 'public/offline/vegref-data.json')

  console.log(`Fetching NVDB segments for bbox ${formatBbox(bbox)} ...`)
  const segments = await fetchAllSegments(bbox)
  if (!segments.length) {
    throw new Error('NVDB returned no segments for the selected bbox')
  }

  const pkg = {
    version,
    generatedAt,
    source: {
      type: 'nvdb-segmentert',
      bbox,
    },
    segments,
  }

  const relDataPath = `/${path.relative(path.join(rootDir, 'public'), outPath).replaceAll(path.sep, '/')}`
  const manifest = {
    version,
    generatedAt,
    dataUrl: relDataPath,
  }

  await writeJson(outPath, pkg)
  await writeJson(manifestPath, manifest)
  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: 'single',
        version,
        generatedAt,
        count: segments.length,
        out: path.relative(rootDir, outPath),
        manifest: path.relative(rootDir, manifestPath),
      },
      null,
      2,
    ),
  )
}

await main().catch((err) => {
  console.error(err)
  process.exit(1)
})
