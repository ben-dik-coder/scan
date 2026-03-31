/**
 * NVDB API Les V4 – vegsystemreferanse nær punkt (Statens vegvesen).
 * Krever header X-Client. CORS tillates fra nettleser.
 */

const NVDB_SEGMENTERT =
  'https://nvdbapiles.atlas.vegvesen.no/vegnett/veglenkesekvenser/segmentert'

function haversineM(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toR = (d) => (d * Math.PI) / 180
  const dLat = toR(lat2 - lat1)
  const dLng = toR(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)))
}

/**
 * @param {string} wkt
 * @returns {{ lat: number, lng: number }[]}
 */
export function parseLineStringLatLngWkt(wkt) {
  if (typeof wkt !== 'string') return []
  const m = wkt.match(/LINESTRING\s+Z\s*\(([^)]+)\)/i) || wkt.match(/LINESTRING\s*\(([^)]+)\)/i)
  if (!m) return []
  const pts = []
  for (const part of m[1].split(',')) {
    const nums = part.trim().split(/\s+/).map(Number)
    if (nums.length >= 2 && !Number.isNaN(nums[0]) && !Number.isNaN(nums[1])) {
      pts.push({ lat: nums[0], lng: nums[1] })
    }
  }
  return pts
}

/**
 * Avstand punkt → linjestykke + t langs [0,1].
 */
function pointToSegmentClosest(lat, lng, a, b) {
  let bestD = Infinity
  let bestT = 0
  const steps = 24
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const plat = a.lat + t * (b.lat - a.lat)
    const plng = a.lng + t * (b.lng - a.lng)
    const d = haversineM(lat, lng, plat, plng)
    if (d < bestD) {
      bestD = d
      bestT = t
    }
  }
  return { distM: bestD, t: bestT }
}

/**
 * @param {{ lat: number, lng: number }[]} pts
 * @param {number} lat
 * @param {number} lng
 * @returns {{ distM: number, alongM: number, totalM: number } | null}
 */
function closestOnPolyline(pts, lat, lng) {
  if (pts.length < 2) return null
  let bestDist = Infinity
  let alongBest = 0
  let alongAcc = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const segLen = haversineM(a.lat, a.lng, b.lat, b.lng)
    const { distM, t } = pointToSegmentClosest(lat, lng, a, b)
    if (distM < bestDist) {
      bestDist = distM
      alongBest = alongAcc + t * segLen
    }
    alongAcc += segLen
  }
  return { distM: bestDist, alongM: alongBest, totalM: alongAcc }
}

const KATEGORI_LABEL = {
  E: 'Europaveg',
  R: 'Riksveg',
  F: 'Fylkesveg',
  K: 'Kommunal veg',
  P: 'Privat veg',
  S: 'Skogsbilveg',
}

/** Kort vegklasse (EV, RV, FV, …) for kompakt visning. */
const KATEGORI_SHORT = {
  E: 'EV',
  R: 'RV',
  F: 'FV',
  K: 'KV',
  P: 'PV',
  S: 'SV',
}

function formatVegsystemLine(vs) {
  if (!vs || typeof vs !== 'object') return 'Ukjent veg'
  const cat = vs.vegkategori
  const num = vs.nummer
  const label = KATEGORI_LABEL[cat] || 'Veg'
  if (typeof num === 'number' && !Number.isNaN(num)) {
    return `${label} ${num}`
  }
  return label
}

function formatVegsystemShort(vs) {
  if (!vs || typeof vs !== 'object') return 'Ukjent veg'
  const cat = vs.vegkategori
  const num = vs.nummer
  const label = KATEGORI_SHORT[cat] || 'Veg'
  if (typeof num === 'number' && !Number.isNaN(num)) {
    return `${label} ${num}`
  }
  return label
}

/**
 * @param {object} seg NVDB segment-objekt
 * @param {number} lat
 * @param {number} lng
 */
export function describeSegmentForPoint(seg, lat, lng) {
  const wkt = seg?.geometri?.wkt
  const pts = parseLineStringLatLngWkt(wkt)
  const geomLen =
    typeof seg?.geometri?.lengde === 'number' && seg.geometri.lengde > 0
      ? seg.geometri.lengde
      : null
  const close = closestOnPolyline(pts, lat, lng)
  if (!close) return null

  const vref = seg.vegsystemreferanse
  const str = vref?.strekning
  const fraM = str?.fra_meter
  const tilM = str?.til_meter
  let meterVal = null
  if (
    typeof fraM === 'number' &&
    typeof tilM === 'number' &&
    tilM > fraM &&
    geomLen != null &&
    geomLen > 0
  ) {
    const frac = Math.min(1, Math.max(0, close.alongM / geomLen))
    meterVal = Math.round(fraM + frac * (tilM - fraM))
  }

  const baseRoad = formatVegsystemLine(vref?.vegsystem)
  const baseRoadShort = formatVegsystemShort(vref?.vegsystem)
  const cat = vref?.vegsystem?.vegkategori
  const addrName =
    seg &&
    typeof seg.adresse === 'object' &&
    typeof seg.adresse.navn === 'string'
      ? seg.adresse.navn.trim()
      : ''
  /** På forsiden: vis vegens navn i stedet for «Kommunal veg …» når NVDB har adressenavn. */
  const roadLineDisplay =
    cat === 'K' && addrName ? addrName : baseRoad
  /** Forkortet hovedvisning (EV 6, KV 12, eller gatenavn). */
  const roadLineDisplayShort =
    cat === 'K' && addrName ? addrName : baseRoadShort

  return {
    roadLine: baseRoad,
    roadLineShort: baseRoadShort,
    roadLineDisplay,
    roadLineDisplayShort,
    s: str?.strekning != null ? String(str.strekning) : '–',
    d: str?.delstrekning != null ? String(str.delstrekning) : '–',
    m: meterVal != null ? String(meterVal) : '–',
    kortform: typeof vref?.kortform === 'string' ? vref.kortform : '',
    distToRoadM: close.distM,
  }
}

function roadKindPenalty(seg) {
  const t = `${seg?.typeVeg || ''} ${seg?.typeVeg_sosi || ''}`
  if (/bilveg|kjørebane|rampe|kollektiv/i.test(t)) return 0
  if (/gang|sykkel|fortau/i.test(t)) return 45
  return 12
}

/**
 * @param {object[]} objekter
 * @param {number} lat
 * @param {number} lng
 */
function pickBestSegment(objekter, lat, lng) {
  let best = null
  let bestScore = Infinity
  for (const seg of objekter) {
    const d = describeSegmentForPoint(seg, lat, lng)
    if (!d) continue
    const score = d.distToRoadM + roadKindPenalty(seg)
    if (score < bestScore) {
      bestScore = score
      best = seg
    }
  }
  return best
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {{ signal?: AbortSignal }} [opts]
 */
export async function fetchRoadReferenceNear(lat, lng, opts = {}) {
  const { signal } = opts
  const padLat = 0.0042
  const cos = Math.cos((lat * Math.PI) / 180) || 1
  const padLng = padLat / cos
  const minLat = lat - padLat
  const maxLat = lat + padLat
  const minLng = lng - padLng
  const maxLng = lng + padLng
  const kartutsnitt = `${minLng},${minLat},${maxLng},${maxLat}`

  const url = new URL(NVDB_SEGMENTERT)
  url.searchParams.set('kartutsnitt', kartutsnitt)
  url.searchParams.set('srid', '4326')
  url.searchParams.set('antall', '100')
  url.searchParams.set('inkluderAntall', 'false')

  const r = await fetch(url.toString(), {
    signal,
    headers: {
      'X-Client': 'Scanix',
      Accept: 'application/json',
    },
  })

  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`NVDB ${r.status}${t ? `: ${t.slice(0, 120)}` : ''}`)
  }

  const data = await r.json()
  const objs = data.objekter
  if (!Array.isArray(objs) || objs.length === 0) return null

  const best = pickBestSegment(objs, lat, lng)
  if (!best) return null

  return describeSegmentForPoint(best, lat, lng)
}
