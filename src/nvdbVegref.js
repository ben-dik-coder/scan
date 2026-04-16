/**
 * NVDB API Les V4 – vegsystemreferanse nær punkt (Statens vegvesen).
 * Eksplisitt v4-sti jf. https://nvdb-docs.atlas.vegvesen.no/nvdbapil/v4/Vegnett
 * Krever header X-Client. CORS tillates fra nettleser.
 */

const NVDB_SEGMENTERT =
  'https://nvdbapiles.atlas.vegvesen.no/vegnett/api/v4/veglenkesekvenser/segmentert'

const NVDB_POSISJON =
  'https://nvdbapiles.atlas.vegvesen.no/vegnett/api/v4/posisjon'

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
 * @param {{ lat: number, lng: number }[]} pts
 */
function lineStringPointsLookLikeWgs84Degrees(pts) {
  if (pts.length === 0) return false
  for (const p of pts) {
    if (
      Math.abs(p.lat) > 90 ||
      Math.abs(p.lng) > 180 ||
      Math.abs(p.lat) >= 1000 ||
      Math.abs(p.lng) >= 1000
    )
      return false
  }
  return true
}

/**
 * Tolker LINESTRING som WGS84-grader (første to tall = det NVDB gir som lat/lng ved srid=4326).
 * Ved annen geometri.srid (f.eks. 5973) returneres tom liste – ikke bruk haversine på projiserte koordinater uten transformasjon.
 *
 * @param {string} wkt
 * @param {number | null | undefined} [geomSrid] `geometri.srid` fra NVDB-segment
 * @returns {{ lat: number, lng: number }[]}
 */
export function parseLineStringLatLngWkt(wkt, geomSrid) {
  if (typeof wkt !== 'string') return []
  if (geomSrid != null && geomSrid !== 4326) {
    return []
  }
  const m = wkt.match(/LINESTRING\s+Z\s*\(([^)]+)\)/i) || wkt.match(/LINESTRING\s*\(([^)]+)\)/i)
  if (!m) return []
  const pts = []
  for (const part of m[1].split(',')) {
    const nums = part.trim().split(/\s+/).map(Number)
    if (nums.length >= 2 && !Number.isNaN(nums[0]) && !Number.isNaN(nums[1])) {
      pts.push({ lat: nums[0], lng: nums[1] })
    }
  }
  if (!lineStringPointsLookLikeWgs84Degrees(pts)) return []
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
 * @returns {{ distM: number, alongM: number, totalM: number, closestIdx: number } | null}
 */
function closestOnPolyline(pts, lat, lng) {
  if (pts.length < 2) return null
  let bestDist = Infinity
  let alongBest = 0
  let bestIdx = 0
  let alongAcc = 0
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i]
    const b = pts[i + 1]
    const segLen = haversineM(a.lat, a.lng, b.lat, b.lng)
    const { distM, t } = pointToSegmentClosest(lat, lng, a, b)
    if (distM < bestDist) {
      bestDist = distM
      alongBest = alongAcc + t * segLen
      bestIdx = i
    }
    alongAcc += segLen
  }
  return { distM: bestDist, alongM: alongBest, totalM: alongAcc, closestIdx: bestIdx }
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
 * @param {number} [accuracyM]
 */
export function describeSegmentForPoint(seg, lat, lng, accuracyM = 28) {
  const wkt = seg?.geometri?.wkt
  const geomSrid =
    typeof seg?.geometri?.srid === 'number' && !Number.isNaN(seg.geometri.srid)
      ? seg.geometri.srid
      : null
  const pts = parseLineStringLatLngWkt(wkt, geomSrid)
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
  const acc =
    typeof accuracyM === 'number' && !Number.isNaN(accuracyM)
      ? Math.min(60, Math.max(8, accuracyM))
      : 28
  /* Litt romsligere ved siden av kjørebane (rå GPS) — ellers blir meter ofte «–». */
  const meterDistThreshold = Math.min(88, Math.max(26, Math.round(acc * 1.22)))
  if (
    distM <= meterDistThreshold &&
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
    skipMeterUpdate: distM > meterDistThreshold,
    nvdbId: segmentStableId(/** @type {object} */ (seg)),
    vegkategori:
      typeof vref?.vegsystem?.vegkategori === 'string'
        ? vref.vegsystem.vegkategori
        : null,
  }
}

function roadKindPenalty(seg) {
  const t = `${seg?.typeVeg || ''} ${seg?.typeVeg_sosi || ''}`
  if (/bilveg|kjørebane|rampe|kollektiv/i.test(t)) return 0
  if (/gang|sykkel|fortau/i.test(t)) return 45
  return 12
}

/** @param {object} seg */
function segmentVegkategori(seg) {
  const vs = seg?.vegsystemreferanse?.vegsystem
  return vs && typeof vs === 'object' ? vs.vegkategori : null
}

/**
 * 0 = E/R/F, 1 = K/ukjent, 2 = P/S (myk «sideveg»-tier for hysterese).
 * @param {string | null | undefined} cat
 */
function roadCategoryTierFromCode(cat) {
  if (!cat || typeof cat !== 'string') return 1
  const c = cat.trim().toUpperCase()
  if (c === 'E' || c === 'R' || c === 'F') return 0
  if (c === 'K') return 1
  if (c === 'P' || c === 'S') return 2
  return 1
}

/** @param {object} seg */
function roadCategoryTierFromSeg(seg) {
  return roadCategoryTierFromCode(segmentVegkategori(seg))
}

/**
 * Myk straff på totalscore (lavere er bedre): P/S etter E/R/F/K når avstand ellers er lik.
 * @param {object} seg
 */
function roadCategoryScorePenalty(seg) {
  const cat = segmentVegkategori(seg)
  if (!cat || typeof cat !== 'string') return 5
  const c = cat.trim().toUpperCase()
  if (c === 'E' || c === 'R' || c === 'F') return 0
  if (c === 'K') return 4
  if (c === 'P' || c === 'S') return 12
  return 5
}

/**
 * @param {object} seg
 * @returns {string}
 */
function segmentAdresseNavn(seg) {
  const ad = seg?.adresse
  if (!ad || typeof ad !== 'object') return ''
  const n = ad.navn
  return typeof n === 'string' ? n.trim() : ''
}

/**
 * Retning langs segment ved nærmeste punkt (tangent), grader [0,360).
 * Bruker segment-indeks fra closestOnPolyline for lokal retning.
 * @param {object} seg
 * @param {number} lat
 * @param {number} lng
 * @returns {number | null}
 */
function segmentRoadHeadingDeg(seg, lat, lng) {
  const wkt = seg?.geometri?.wkt
  const geomSrid =
    typeof seg?.geometri?.srid === 'number' && !Number.isNaN(seg.geometri.srid)
      ? seg.geometri.srid
      : null
  const pts = parseLineStringLatLngWkt(wkt, geomSrid)
  if (pts.length < 2) return null
  if (lat != null && lng != null) {
    const close = closestOnPolyline(pts, lat, lng)
    if (close) {
      const i = close.closestIdx
      const a = pts[i]
      const b = pts[Math.min(i + 1, pts.length - 1)]
      return bearingDeg(a.lat, a.lng, b.lat, b.lng)
    }
  }
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
 *   ranked: Array<{ seg: object, score: number, d: object, id: string | number | null }>
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
  const lowSpeedUrbanHeading =
    userHeadingDeg != null && speed >= 1.2 && speed < 3.5 && accuracyM <= 24

  const scored = []
  for (const seg of objekter) {
    const d = describeSegmentForPoint(seg, lat, lng, accuracyM)
    if (!d) continue
    const id = segmentStableId(seg)
    const dist = Math.min(d.distToRoadM, 100)
    let score = dist + roadKindPenalty(seg) + roadCategoryScorePenalty(seg)
    if (prevNvdbId != null && id !== null) {
      if (id === prevNvdbId) {
        score -= 22 * speedFactor
        if (speed < 2) score -= 14
        /* Stikkrenne/bilde ved veikant: ofte 2–5 m fra senterlinja — lett ekstra lås til forrige vei. */
        if (speed < 3 && dist <= 12) score -= 8
      } else {
        score += 12 * speedFactor
        if (speed < 2) score += 10
        else if (speed >= 2 && speed < 14) score += 5
      }
    }
    const roadH = segmentRoadHeadingDeg(seg, lat, lng)
    if (userHeadingDeg != null && roadH != null && (speed >= 3.5 || lowSpeedUrbanHeading)) {
      const hd = headingDiffDeg(userHeadingDeg, roadH)
      const headingWeight = speed >= 3.5 ? 0.5 : 0.22
      score += hd * headingWeight
      if (hd < 25 && d.distToRoadM < 20) score -= speed >= 3.5 ? 15 : 9
      if (hd < 10) score += dist * (speed >= 3.5 ? 0.5 : 0.18)
    }
    /* Kommunalveg med gatenavn: lett bonus — ikke overstyr nærhet (unngå «feil gate»). */
    if (segmentVegkategori(seg) === 'K' && segmentAdresseNavn(seg)) {
      score -= 10
    }
    scored.push({ seg, score, d, id })
  }
  if (!scored.length) return null

  scored.sort((a, b) => a.score - b.score)
  const ranked = scored.slice(0, 18)
  const best = scored[0]
  const bestScore = best.score
  const prevRow =
    prevNvdbId != null ? scored.find((r) => r.id === prevNvdbId) : null
  const prevSegScore =
    prevRow != null && typeof prevRow.score === 'number' ? prevRow.score : null

  if (prevNvdbId == null || best.id === prevNvdbId) {
    return {
      seg: best.seg,
      chosenScore: best.score,
      bestScore,
      prevSegScore,
      ranked,
    }
  }

  if (!prevRow) {
    return {
      seg: best.seg,
      chosenScore: best.score,
      bestScore,
      prevSegScore: null,
      ranked,
    }
  }

  /* Større margin ved ustabil GPS → færre hopp mellom parallelle veier / veinavn. */
  const baseMargin = Math.min(40, Math.max(9, accuracyM * 0.42))
  const accBoost =
    accuracyM >= 24 ? Math.min(18, (accuracyM - 22) * 0.55) : 0
  const denseUrbanStickiness =
    accuracyM <= 32 && speed < 14 ? (speed < 4 ? 12 : 7) : 0
  /* God GPS + høy fart: uten ekstra hysterese hopper vi ofte mellom parallelle felt/ramper (meter/stedsnavn faller ut). */
  const highSpeedStickiness =
    speed >= 12 ? Math.min(34, 8 + (speed - 12) * 0.55) : 0
  const nearInspectionMargin =
    speed < 3 &&
    accuracyM <= 24 &&
    prevRow != null &&
    typeof prevRow.d?.distToRoadM === 'number' &&
    prevRow.d.distToRoadM <= 12
      ? 12
      : 0
  let margin =
    (speed < 2 ? Math.max(baseMargin, 28) : baseMargin) +
    accBoost +
    denseUrbanStickiness +
    highSpeedStickiness +
    nearInspectionMargin

  const prevTier = roadCategoryTierFromSeg(prevRow.seg)
  const bestTier = roadCategoryTierFromSeg(best.seg)
  if (prevTier <= 1 && bestTier >= 2) {
    margin += 10
  }
  if (prevTier >= 2 && bestTier <= 1) {
    margin -= 14
  }
  const dPrev = prevRow.d.distToRoadM
  const dBest = best.d.distToRoadM
  if (
    typeof dPrev === 'number' &&
    typeof dBest === 'number' &&
    prevTier >= 2 &&
    bestTier <= 1 &&
    dBest + 6 < dPrev
  ) {
    margin -= 10
  }
  if (userHeadingDeg != null && prevTier >= 2 && bestTier <= 1) {
    const hBest = segmentRoadHeadingDeg(best.seg, lat, lng)
    const hPrev = segmentRoadHeadingDeg(prevRow.seg, lat, lng)
    if (hBest != null && hPrev != null) {
      const hdB = headingDiffDeg(userHeadingDeg, hBest)
      const hdP = headingDiffDeg(userHeadingDeg, hPrev)
      if (hdB + 12 < hdP) margin -= 8
    }
  }
  margin = Math.max(0, margin)

  const useSegmentStickiness =
    accuracyM >= 18 || speed < 2 || speed >= 10
  if (useSegmentStickiness && prevRow.score - best.score < margin) {
    return {
      seg: prevRow.seg,
      chosenScore: prevRow.score,
      bestScore,
      prevSegScore,
      ranked,
    }
  }
  return {
    seg: best.seg,
    chosenScore: best.score,
    bestScore,
    prevSegScore,
    ranked,
  }
}

function sleepMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Flytter punkt langs kompassretning (grader, 0 = nord) for å legge NVDB-søket tyngre «foran» bilen.
 * @param {number} lat
 * @param {number} lng
 * @param {number} headingDeg
 * @param {number} meters
 */
function shiftLatLngAlongHeading(lat, lng, headingDeg, meters) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !Number.isFinite(headingDeg) || meters <= 0) {
    return { lat, lng }
  }
  const rad = (headingDeg * Math.PI) / 180
  const cosLat = Math.cos((lat * Math.PI) / 180) || 1
  const dLat = (meters * Math.cos(rad)) / 111111
  const dLng = (meters * Math.sin(rad)) / (111111 * cosLat)
  return { lat: lat + dLat, lng: lng + dLng }
}

/**
 * @param {object[]} rows
 */
function dedupeNvdbObjekter(rows) {
  const seen = new Set()
  const out = []
  for (let i = 0; i < rows.length; i++) {
    const s = rows[i]
    if (!s || typeof s !== 'object') continue
    const id = 'id' in s && s.id != null ? String(s.id) : null
    const kf =
      s.vegsystemreferanse &&
      typeof s.vegsystemreferanse.kortform === 'string'
        ? s.vegsystemreferanse.kortform
        : ''
    const wkt =
      s.geometri && typeof s.geometri.wkt === 'string'
        ? s.geometri.wkt.slice(0, 80)
        : ''
    const key = id ?? (kf ? `kf:${kf}` : `i:${i}:${wkt}`)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(s)
  }
  return out
}

/**
 * Løser vegreferanse fra en liste kandidatsegmenter.
 * @param {object[]} objekter
 * @param {number} lat
 * @param {number} lng
 * @param {{
 *   accuracyM?: number
 *   prevNvdbId?: string | number | null
 *   userHeadingDeg?: number | null
 *   speed?: number
 * }} [opts]
 */
export function resolveRoadReferenceFromSegments(objekter, lat, lng, opts = {}) {
  const { accuracyM, prevNvdbId, userHeadingDeg, speed } = opts
  const objs = Array.isArray(objekter) ? objekter : []
  if (!Array.isArray(objs) || objs.length === 0) return null

  const picked = pickBestSegment(objs, lat, lng, {
    accuracyM,
    prevNvdbId: prevNvdbId ?? null,
    userHeadingDeg: userHeadingDeg ?? null,
    speed: speed ?? 0,
  })
  if (!picked) return null

  const described = describeSegmentForPoint(picked.seg, lat, lng, accuracyM)
  if (!described) return null

  if (
    typeof picked.chosenScore === 'number' &&
    (picked.prevSegScore == null || typeof picked.prevSegScore === 'number')
  ) {
    described._vegrefMeta = {
      newSegScore: picked.chosenScore,
      prevSegScore: picked.prevSegScore,
      bestScore: picked.bestScore,
      scoreDelta:
        picked.prevSegScore != null
          ? picked.prevSegScore - picked.chosenScore
          : null,
    }
  }
  return described
}

/**
 * Én NVDB-runde (nettverksfeil kastes; tomt treff returnerer null uten kast).
 * @param {number} lat
 * @param {number} lng
 * @param {{
 *   signal?: AbortSignal
 *   accuracyM?: number
 *   prevNvdbId?: string | number | null
 *   userHeadingDeg?: number | null
 *   speed?: number
 *   onRawSegments?: (objekter: object[]) => void
 * }} [opts]
 */
export async function fetchRoadReferenceNearOnlineOnce(lat, lng, opts = {}) {
  const { signal, onRawSegments } = opts
  const speedMps =
    typeof opts.speed === 'number' && !Number.isNaN(opts.speed) ? opts.speed : 0
  const accM =
    typeof opts.accuracyM === 'number' && !Number.isNaN(opts.accuracyM)
      ? opts.accuracyM
      : 28
  const hd = opts.userHeadingDeg

  let qLat = lat
  let qLng = lng
  /* Forskyv søk «forover» ved fart — men ikke ved dårlig GPS (kan treffe feil vei i kartutsnitt). */
  if (
    typeof hd === 'number' &&
    Number.isFinite(hd) &&
    speedMps >= 8 &&
    accM <= 40
  ) {
    const forwardM = Math.min(42, 3 + speedMps * 1.35)
    const sh = shiftLatLngAlongHeading(lat, lng, hd, forwardM)
    qLat = sh.lat
    qLng = sh.lng
  }

  const denseUrbanMode =
    accM <= 32 &&
    (speedMps < 14 || opts.prevNvdbId != null)
  const speedPadFactor =
    speedMps > 28 ? 1.08 : speedMps > 15 ? 1.05 : denseUrbanMode ? 0.82 : 1
  const accPadFactor =
    accM > 55 ? 1.06 : accM > 42 ? 1.03 : denseUrbanMode ? 0.9 : 1
  const basePadLat = denseUrbanMode ? 0.00135 : 0.0018
  const padLat = basePadLat * speedPadFactor * accPadFactor
  const cos = Math.cos((qLat * Math.PI) / 180) || 1
  const padLng = padLat / cos
  const minLat = qLat - padLat
  const maxLat = qLat + padLat
  const minLng = qLng - padLng
  const maxLng = qLng + padLng
  const kartutsnitt = `${minLng},${minLat},${maxLng},${maxLat}`

  const url = new URL(NVDB_SEGMENTERT)
  url.searchParams.set('kartutsnitt', kartutsnitt)
  url.searchParams.set('srid', '4326')
  url.searchParams.set('antall', denseUrbanMode ? '160' : '100')
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

  let data
  try {
    data = await r.json()
  } catch {
    throw new Error('NVDB: ugyldig JSON')
  }
  let allObjs = dedupeNvdbObjekter(
    Array.isArray(data?.objekter) ? data.objekter : [],
  )

  const nesteHref =
    data &&
    typeof data === 'object' &&
    data.metadata &&
    typeof data.metadata === 'object' &&
    typeof data.metadata.neste?.href === 'string'
      ? data.metadata.neste.href
      : ''
  const wantExtraPage =
    nesteHref &&
    (allObjs.length >= (denseUrbanMode ? 120 : 92) ||
      speedMps > 22 ||
      denseUrbanMode)

  if (wantExtraPage && !signal?.aborted) {
    try {
      const r2 = await fetch(nesteHref, {
        signal,
        headers: {
          'X-Client': 'Scanix',
          Accept: 'application/json',
        },
      })
      if (r2.ok) {
        const data2 = await r2.json()
        const o2 = Array.isArray(data2?.objekter) ? data2.objekter : []
        allObjs = dedupeNvdbObjekter([...allObjs, ...o2])
      }
    } catch {
      /* valgfri side 2 */
    }
  }

  if (typeof onRawSegments === 'function' && allObjs.length) {
    try {
      onRawSegments(allObjs)
    } catch {
      /* ikke blokker vegreferanse ved cache-feil */
    }
  }
  return resolveRoadReferenceFromSegments(allObjs, lat, lng, opts)
}

/**
 * Flere forsøk ved midlertidige nettfeil (mobil, tunnel, 5xx).
 * @param {number} lat
 * @param {number} lng
 * @param {{
 *   signal?: AbortSignal
 *   accuracyM?: number
 *   prevNvdbId?: string | number | null
 *   userHeadingDeg?: number | null
 *   speed?: number
 *   onRawSegments?: (objekter: object[]) => void
 * }} [opts]
 */
export async function fetchRoadReferenceNearOnline(lat, lng, opts = {}) {
  const { signal } = opts
  /** @type {unknown} */
  let lastErr = null
  for (let attempt = 0; attempt < 3; attempt++) {
    if (signal?.aborted) {
      throw new DOMException('Aborted', 'AbortError')
    }
    try {
      return await fetchRoadReferenceNearOnlineOnce(lat, lng, opts)
    } catch (e) {
      lastErr = e
      const name = e && typeof e === 'object' && 'name' in e ? String(e.name) : ''
      if (name === 'AbortError' || signal?.aborted) throw e
      if (attempt < 2) {
        await sleepMs(400 * (attempt + 1))
      }
    }
  }
  throw lastErr instanceof Error
    ? lastErr
    : new Error('NVDB: oppslag feilet')
}

export const fetchRoadReferenceNear = fetchRoadReferenceNearOnline

/**
 * @param {unknown} o
 * @returns {string}
 */
function adresseObjectNavn(o) {
  if (!o || typeof o !== 'object') return ''
  const ad = /** @type {{ navn?: unknown }} */ (o)
  if (typeof ad.navn === 'string' && ad.navn.trim()) {
    return ad.navn.trim()
  }
  return ''
}

/**
 * @param {unknown} hit Første treff fra /posisjon
 * @returns {string}
 */
function extractAdresseNavnFromPosisjonHit(hit) {
  if (!hit || typeof hit !== 'object') return ''
  const h = /** @type {{ adresse?: unknown, adresser?: unknown }} */ (hit)
  let n = adresseObjectNavn(h.adresse)
  if (n) return n
  const arr = h.adresser
  if (Array.isArray(arr)) {
    for (const a of arr) {
      n = adresseObjectNavn(a)
      if (n) return n
    }
  }
  return ''
}

/**
 * NVDB Posisjon-API: returnerer vegreferanse direkte fra koordinater.
 * Serverside segment-valg — ingen lokal scoring/WKT-interpolasjon.
 * @param {number} lat
 * @param {number} lng
 * @param {{ signal?: AbortSignal, accuracyM?: number }} [opts]
 * @returns {Promise<import('./nvdbVegref.js').VegrefDescribeResult | null>}
 */
async function fetchRoadPositionDirectOnce(lat, lng, opts = {}) {
  const { signal } = opts
  const accM =
    typeof opts.accuracyM === 'number' && !Number.isNaN(opts.accuracyM)
      ? opts.accuracyM
      : 28
  const maksAvstand = accM > 40 ? 60 : 30

  const url = new URL(NVDB_POSISJON)
  url.searchParams.set('lat', String(lat))
  url.searchParams.set('lon', String(lng))
  url.searchParams.set('maks_avstand', String(maksAvstand))

  const r = await fetch(url.toString(), {
    signal,
    headers: {
      'X-Client': 'Scanix',
      Accept: 'application/json',
    },
  })

  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`NVDB posisjon ${r.status}${t ? `: ${t.slice(0, 120)}` : ''}`)
  }

  let data
  try {
    data = await r.json()
  } catch {
    throw new Error('NVDB posisjon: ugyldig JSON')
  }

  if (!Array.isArray(data) || data.length === 0) return null

  const hit = data[0]
  const vref = hit?.vegsystemreferanse
  const vs = vref?.vegsystem
  const str = vref?.strekning
  if (!vs) return null

  const baseRoad = formatVegsystemLine(vs)
  const baseRoadShort = formatVegsystemShort(vs)
  const addrNameFromHit = extractAdresseNavnFromPosisjonHit(hit)
  const meterRaw = str?.meter
  let meterVal = null
  if (typeof meterRaw === 'number' && Number.isFinite(meterRaw)) {
    meterVal = Math.round(meterRaw)
  } else if (typeof meterRaw === 'string' && meterRaw.trim()) {
    const n = parseInt(meterRaw.replace(/[^\d-]/g, ''), 10)
    if (!Number.isNaN(n) && n >= 0) meterVal = n
  }
  const distToRoad = typeof hit.avstand === 'number' ? hit.avstand : 0

  const vls = hit?.veglenkesekvens
  const vlsId =
    vls && typeof vls.veglenkesekvensid === 'number' && Number.isFinite(vls.veglenkesekvensid)
      ? vls.veglenkesekvensid
      : null
  const vk = vs?.vegkategori
  const vn = vs?.nummer
  const sNum = str?.strekning
  const dNum = str?.delstrekning
  const stableNvdbId =
    vlsId != null
      ? `vls:${vlsId}`
      : typeof vk === 'string' && typeof vn === 'number' && !Number.isNaN(vn)
        ? `vs:${vk}-${vn}-S${sNum ?? ''}D${dNum ?? ''}`
        : null

  const primaryDisplay = addrNameFromHit || baseRoad
  const primaryDisplayShort = addrNameFromHit || baseRoadShort

  return {
    roadLine: baseRoad,
    roadLineShort: baseRoadShort,
    roadLineDisplay: primaryDisplay,
    roadLineDisplayShort: primaryDisplayShort,
    s: str?.strekning != null ? String(str.strekning) : '–',
    d: str?.delstrekning != null ? String(str.delstrekning) : '–',
    m: meterVal != null ? String(meterVal) : '–',
    kortform: typeof vref?.kortform === 'string' ? vref.kortform : '',
    distToRoadM: distToRoad,
    skipMeterUpdate: false,
    nvdbId: stableNvdbId,
    vegkategori: typeof vk === 'string' ? vk : null,
    _vegrefMeta: { source: 'posisjon' },
  }
}

/**
 * Posisjon-API med retry (maks 2 forsøk).
 * @param {number} lat
 * @param {number} lng
 * @param {{ signal?: AbortSignal, accuracyM?: number }} [opts]
 */
export async function fetchRoadPositionDirect(lat, lng, opts = {}) {
  const { signal } = opts
  let lastErr = null
  for (let attempt = 0; attempt < 2; attempt++) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    try {
      return await fetchRoadPositionDirectOnce(lat, lng, opts)
    } catch (e) {
      lastErr = e
      const name = e && typeof e === 'object' && 'name' in e ? String(e.name) : ''
      if (name === 'AbortError' || signal?.aborted) throw e
      if (attempt < 1) await sleepMs(350)
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error('NVDB posisjon: oppslag feilet')
}
