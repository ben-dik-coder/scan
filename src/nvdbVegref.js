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
 * Stabil nøkkel for NVDB-segment (sticky valg mellom parallelle gater).
 * @param {object} seg
 * @returns {string | number | null}
 */
export function segmentStableId(seg) {
  if (!seg || typeof seg !== 'object') return null
  const id = /** @type {{ id?: unknown }} */ (seg).id
  if (typeof id === 'number' && Number.isFinite(id)) return id
  if (typeof id === 'string' && id.trim()) return id.trim()
  const kf = /** @type {{ vegsystemreferanse?: { kortform?: unknown } }} */ (seg)
    .vegsystemreferanse?.kortform
  if (typeof kf === 'string' && kf.trim()) return `kf:${kf.trim()}`
  return null
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
    nvdbId: segmentStableId(/** @type {object} */ (seg)),
  }
}

function roadKindPenalty(seg) {
  const t = `${seg?.typeVeg || ''} ${seg?.typeVeg_sosi || ''}`
  if (/bilveg|kjørebane|rampe|kollektiv/i.test(t)) return 0
  if (/gang|sykkel|fortau/i.test(t)) return 45
  return 12
}

/**
 * Velg segment: nærhet + vegtype, med hysterese mot forrige treff når GPS er ustabil
 * (typisk tettbygd med parallelle kommunalveier / stedsnavn).
 * @param {object[]} objekter
 * @param {number} lat
 * @param {number} lng
 * @param {{ accuracyM?: number, prevNvdbId?: string | number | null }} [opts]
 */
function pickBestSegment(objekter, lat, lng, opts = {}) {
  const accuracyM =
    typeof opts.accuracyM === 'number' && !Number.isNaN(opts.accuracyM)
      ? Math.min(120, Math.max(8, opts.accuracyM))
      : 28
  const prevNvdbId = opts.prevNvdbId ?? null

  const scored = []
  for (const seg of objekter) {
    const d = describeSegmentForPoint(seg, lat, lng)
    if (!d) continue
    const id = segmentStableId(seg)
    let score = d.distToRoadM + roadKindPenalty(seg)
    if (prevNvdbId != null && id !== null && id === prevNvdbId) {
      score -= Math.min(52, 16 + accuracyM * 0.7)
    }
    scored.push({ seg, score, d, id })
  }
  if (!scored.length) return null

  scored.sort((a, b) => a.score - b.score)
  const best = scored[0]
  if (prevNvdbId == null || best.id === prevNvdbId) return best.seg

  const prevRow = scored.find((r) => r.id === prevNvdbId)
  if (!prevRow) return best.seg

  const margin = Math.min(50, Math.max(9, accuracyM * 0.48))
  if (accuracyM >= 20 && prevRow.score - best.score < margin) {
    return prevRow.seg
  }
  return best.seg
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {{
 *   signal?: AbortSignal
 *   accuracyM?: number
 *   prevNvdbId?: string | number | null
 * }} [opts]
 */
export async function fetchRoadReferenceNear(lat, lng, opts = {}) {
  const { signal, accuracyM, prevNvdbId } = opts
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

  const best = pickBestSegment(objs, lat, lng, {
    accuracyM,
    prevNvdbId: prevNvdbId ?? null,
  })
  if (!best) return null

  return describeSegmentForPoint(best, lat, lng)
}
