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
 * Bearing fra (lat1,lng1) til (lat2,lng2) i grader [0,360), nord = 0, med klokka.
 */
export function bearingDeg(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180
  const φ1 = toRad(lat1)
  const φ2 = toRad(lat2)
  const Δλ = toRad(lng2 - lng1)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x =
    Math.cos(φ1) * Math.sin(φ2) -
    Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  let θ = Math.atan2(y, x)
  θ = (θ * 180) / Math.PI
  return (θ + 360) % 360
}

/**
 * Minste vinkelavstand mellom to retninger i grader [0, 180].
 */
export function headingDiffDeg(h1, h2) {
  if (
    h1 == null ||
    h2 == null ||
    typeof h1 !== 'number' ||
    typeof h2 !== 'number' ||
    Number.isNaN(h1) ||
    Number.isNaN(h2)
  ) {
    return 0
  }
  let d = Math.abs(h1 - h2) % 360
  if (d > 180) d = 360 - d
  return d
}

function pointToSegmentClosest(lat, lng, a, b) {
  let bestD = Infinity
  let bestT = 0
  const steps = 50
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
  const distM = close.distM
  if (
    distM <= 25 &&
    typeof fraM === 'number' &&
    typeof tilM === 'number' &&
    tilM > fraM &&
    geomLen != null &&
    geomLen > 0
  ) {
    /* Projisert punkt langs WKT (close.alongM); ved <12 m er treffet «snappet» til vei. */
    const frac = Math.min(1, Math.max(0, close.alongM / geomLen))
    meterVal = Math.round(fraM + frac * (tilM - fraM))
  }

  const baseRoad = formatVegsystemLine(vref?.vegsystem)
  const baseRoadShort = formatVegsystemShort(vref?.vegsystem)
  const addrName =
    seg &&
    typeof seg.adresse === 'object' &&
    typeof seg.adresse.navn === 'string'
      ? seg.adresse.navn.trim()
      : ''
  /** Når NVDB har adressenavn: alltid primær visning = navn (stabil UI); vegtype i sekundær linje. */
  const hasAddr = Boolean(addrName)
  const roadLineDisplay = hasAddr ? addrName : baseRoad
  const roadLineDisplayShort = hasAddr ? addrName : baseRoadShort

  return {
    roadLine: baseRoad,
    roadLineShort: baseRoadShort,
    roadLineDisplay,
    roadLineDisplayShort,
    s: str?.strekning != null ? String(str.strekning) : '–',
    d: str?.delstrekning != null ? String(str.delstrekning) : '–',
    m: meterVal != null ? String(meterVal) : '–',
    kortform: typeof vref?.kortform === 'string' ? vref.kortform : '',
    distToRoadM: distM,
    /** Langt fra projected linje: UI skal ikke oppdatere metertall (behold forrige). */
    skipMeterUpdate: distM > 25,
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
 * Retning langs segment (første → siste punkt i WKT), grader [0,360).
 * @param {object} seg
 * @returns {number | null}
 */
function segmentRoadHeadingDeg(seg) {
  const wkt = seg?.geometri?.wkt
  const pts = parseLineStringLatLngWkt(wkt)
  if (pts.length < 2) return null
  const a = pts[0]
  const b = pts[pts.length - 1]
  return bearingDeg(a.lat, a.lng, b.lat, b.lng)
}

/**
 * Velg segment: nærhet + vegtype, med hysterese mot forrige treff når GPS er ustabil
 * (typisk tettbygd med parallelle kommunalveier / stedsnavn).
 * @param {object[]} objekter
 * @param {number} lat
 * @param {number} lng
 * @param {{ accuracyM?: number, prevNvdbId?: string | number | null, userHeadingDeg?: number | null, speed?: number }} [opts]
 * @returns {{
 *   seg: object
 *   chosenScore: number
 *   bestScore: number
 *   prevSegScore: number | null
 * } | null}
 */
function pickBestSegment(objekter, lat, lng, opts = {}) {
  const accuracyM =
    typeof opts.accuracyM === 'number' && !Number.isNaN(opts.accuracyM)
      ? Math.min(120, Math.max(8, opts.accuracyM))
      : 28
  const prevNvdbId = opts.prevNvdbId ?? null
  const speed = typeof opts.speed === 'number' && !Number.isNaN(opts.speed) ? opts.speed : 0
  const speedFactor = Math.min(1.5, speed / 10)
  const userHeadingDeg =
    typeof opts.userHeadingDeg === 'number' &&
    !Number.isNaN(opts.userHeadingDeg)
      ? opts.userHeadingDeg
      : null

  const scored = []
  for (const seg of objekter) {
    const d = describeSegmentForPoint(seg, lat, lng)
    if (!d) continue
    const id = segmentStableId(seg)
    const dist = Math.min(d.distToRoadM, 100)
    let score = dist + roadKindPenalty(seg)
    if (prevNvdbId != null && id !== null) {
      if (id === prevNvdbId) {
        score -= 80 * speedFactor
        if (speed < 2) score += 20
      } else {
        score += 40 * speedFactor
      }
    }
    const roadH = segmentRoadHeadingDeg(seg)
    if (userHeadingDeg != null && roadH != null) {
      const hd = headingDiffDeg(userHeadingDeg, roadH)
      if (speed >= 3) score += hd * 0.5
      if (hd < 25 && d.distToRoadM < 20) score -= 15
      if (hd < 10) score += dist * 0.5
    }
    if (speed < 2) score -= 20
    scored.push({ seg, score, d, id })
  }
  if (!scored.length) return null

  scored.sort((a, b) => a.score - b.score)
  const best = scored[0]
  const bestScore = best.score
  const prevRow =
    prevNvdbId != null ? scored.find((r) => r.id === prevNvdbId) : null
  const prevSegScore =
    prevRow != null && typeof prevRow.score === 'number' ? prevRow.score : null

  if (prevNvdbId == null || best.id === prevNvdbId) {
    return { seg: best.seg, chosenScore: best.score, bestScore, prevSegScore }
  }

  if (!prevRow) {
    return { seg: best.seg, chosenScore: best.score, bestScore, prevSegScore: null }
  }

  const margin = Math.min(50, Math.max(9, accuracyM * 0.48))
  if (accuracyM >= 20 && prevRow.score - best.score < margin) {
    return {
      seg: prevRow.seg,
      chosenScore: prevRow.score,
      bestScore,
      prevSegScore,
    }
  }
  return { seg: best.seg, chosenScore: best.score, bestScore, prevSegScore }
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {{
 *   signal?: AbortSignal
 *   accuracyM?: number
 *   prevNvdbId?: string | number | null
 *   userHeadingDeg?: number | null
 *   speed?: number
 * }} [opts]
 */
export async function fetchRoadReferenceNear(lat, lng, opts = {}) {
  const { signal, accuracyM, prevNvdbId, userHeadingDeg, speed } = opts
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

  const picked = pickBestSegment(objs, lat, lng, {
    accuracyM,
    prevNvdbId: prevNvdbId ?? null,
    userHeadingDeg: userHeadingDeg ?? null,
    speed: speed ?? 0,
  })
  if (!picked) return null

  const described = describeSegmentForPoint(picked.seg, lat, lng)
  if (!described) return null
  if (
    typeof picked.chosenScore === 'number' &&
    (picked.prevSegScore == null || typeof picked.prevSegScore === 'number')
  ) {
    described._vegrefMeta = {
      newSegScore: picked.chosenScore,
      prevSegScore: picked.prevSegScore,
      bestScore: picked.bestScore,
    }
  }
  return described
}
