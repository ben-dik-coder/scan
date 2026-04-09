import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { resolveRoadReferenceFromSegments } from '../src/nvdbVegref.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const root = path.resolve(__dirname, '..')

function readJson(relPath) {
  return fs.readFile(path.join(root, relPath), 'utf8').then((raw) => JSON.parse(raw))
}

function bboxForSegment(seg) {
  const wkt = seg?.geometri?.wkt
  if (typeof wkt !== 'string') return null
  const match =
    wkt.match(/LINESTRING\s+Z\s*\(([^)]+)\)/i) ||
    wkt.match(/LINESTRING\s*\(([^)]+)\)/i)
  if (!match) return null
  let minLat = Infinity
  let minLng = Infinity
  let maxLat = -Infinity
  let maxLng = -Infinity
  for (const part of match[1].split(',')) {
    const [lat, lng] = part.trim().split(/\s+/).map(Number)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    minLat = Math.min(minLat, lat)
    minLng = Math.min(minLng, lng)
    maxLat = Math.max(maxLat, lat)
    maxLng = Math.max(maxLng, lng)
  }
  if (![minLat, minLng, maxLat, maxLng].every(Number.isFinite)) return null
  return [minLat, minLng, maxLat, maxLng]
}

function intersects(a, b) {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
}

function queryLocalSegments(segments, lat, lng, accuracyM) {
  const padLat = Math.max(0.002, Math.min(0.02, accuracyM / 111000 + 0.001))
  const cos = Math.cos((lat * Math.PI) / 180) || 1
  const padLng = padLat / cos
  const query = [lat - padLat, lng - padLng, lat + padLat, lng + padLng]
  return segments.filter((seg) => {
    const bbox = bboxForSegment(seg)
    return bbox ? intersects(bbox, query) : false
  })
}

function comparable(res) {
  if (!res) return null
  return {
    nvdbId: res.nvdbId ?? null,
    road: res.roadLineDisplayShort ?? '',
    s: res.s ?? '',
    d: res.d ?? '',
    m: res.m ?? '',
  }
}

async function main() {
  const pkg = await readJson('fixtures/vegref/offline-package.sample.json')
  const trace = await readJson('fixtures/vegref/trace.sample.json')
  const segments = Array.isArray(pkg?.segments) ? pkg.segments : []
  const mismatches = []

  for (const [index, point] of trace.entries()) {
    const opts = {
      accuracyM: point.accuracyM ?? 12,
      speed: point.speed ?? 0,
      prevNvdbId: null,
      userHeadingDeg: null,
    }
    const onlineLike = comparable(
      resolveRoadReferenceFromSegments(segments, point.lat, point.lng, opts),
    )
    const localCandidates = queryLocalSegments(
      segments,
      point.lat,
      point.lng,
      opts.accuracyM,
    )
    const offlineLike = comparable(
      resolveRoadReferenceFromSegments(
        localCandidates,
        point.lat,
        point.lng,
        opts,
      ),
    )
    if (JSON.stringify(onlineLike) !== JSON.stringify(offlineLike)) {
      mismatches.push({ index, onlineLike, offlineLike })
    }
  }

  if (mismatches.length) {
    console.error(JSON.stringify({ ok: false, mismatches }, null, 2))
    process.exitCode = 1
    return
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        points: trace.length,
        packageVersion: pkg?.version ?? 'unknown',
      },
      null,
      2,
    ),
  )
}

await main()
