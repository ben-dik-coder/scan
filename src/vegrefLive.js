/**
 * Felles NVDB-oppslag for forsiden og KMT (ta bilde), med én throttlet pipeline,
 * avbrudd mot utdaterte svar, og offline-/nettverksfallback uten å blokkere UI.
 */

import { bearingDeg } from './nvdbVegref.js'

/** @typedef {ReturnType<import('./nvdbVegref.js').fetchRoadReferenceNear> extends Promise<infer R> ? R : never} VegrefDescribeResult */

/**
 * @typedef {{
 *   haversineM: (lat1: number, lng1: number, lat2: number, lng2: number) => number
 *   fetchRoadReferenceNear: typeof import('./nvdbVegref.js').fetchRoadReferenceNear
 *   getViewHome: () => boolean
 *   getKmtOpen: () => boolean
 *   applyHome: (res: VegrefDescribeResult) => void
 *   applyKmt: (res: VegrefDescribeResult | null) => void
 *   beforeNvdbFetch?: () => void
 * }} VegrefHooks
 */

/** Felles timing for forsiden og KMT – samme opplevd hastighet. */
export const VEGREF_MIN_INTERVAL_MS = 450
export const VEGREF_MIN_MOVE_M = 2

/**
 * Ikke avbryt pågående NVDB-kall ved mikro-bevegelse (reduserer «henger» / evig retry).
 * Skaler litt med GPS-nøyaktighet.
 */
const VEGREF_INFLIGHT_COALESCE_BASE_M = 12

/** Gjenbruk siste NVDB-treff når posisjon er i nærheten (offline / nettfeil). */
const OFFLINE_REUSE_NVDB_M = 90

/** Monoton tid fra GPS (unngår out-of-order fixes som gir bakover-meter). */
let lastGpsTimestamp = 0

/** Eksponentiell glatting av posisjon før NVDB (reduserer jitter). */
let smoothLat = /** @type {number | null} */ (null)
let smoothLng = /** @type {number | null} */ (null)

/** Må bekreftes dynamisk (fart) + confidence før UI bytter segment (anti-hopping). */
let candidateSegmentId = /** @type {string | number | null} */ (null)
let candidateSince = 0

/** @type {number} */
let segmentConfidence = 0

/** Siste tidspunkt NVDB-segment faktisk ble oppdatert (for confidence-decay). */
let lastNvdbSegmentApplyAt = 0
/** Siste decay-steg (maks én gang per ~2 s ved inaktivitet). */
let lastConfidenceDecayAt = 0

/** Glattet kompassretning [0,360) — reduserer hopp mellom GPS-rammer. */
let smoothHeading = /** @type {number | null} */ (null)

let lastSpeed = 0
/** @type {{ lat: number, lng: number, timestamp: number } | null} */
let lastPosForSpeed = null

let hooks = /** @type {VegrefHooks | null} */ (null)

let lastFetchMs = 0
let lastFetchLat = /** @type {number | null} */ (null)
let lastFetchLng = /** @type {number | null} */ (null)

/** @type {AbortController | null} */
let nvdbAbort = null
let fetchGeneration = 0
/** Posisjon da siste NVDB-forespørsel startet (for å unngå avbrudd ved GPS-støy). */
let inFlightAnchorLat = /** @type {number | null} */ (null)
let inFlightAnchorLng = /** @type {number | null} */ (null)

/** Siste vellykkede NVDB (for offline-gjenbruk). */
let cacheLat = /** @type {number | null} */ (null)
let cacheLng = /** @type {number | null} */ (null)
/** @type {VegrefDescribeResult | null} */
let cacheRes = null

/** Siste vi faktisk viste (for reapply etter DOM-bytt). */
/** @type {VegrefDescribeResult | null} */
let lastAppliedRes = null
let lastAppliedLat = /** @type {number | null} */ (null)
let lastAppliedLng = /** @type {number | null} */ (null)

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {VegrefDescribeResult}
 */
function buildCoordFallback(lat, lng) {
  const la = lat.toFixed(4)
  const lo = lng.toFixed(4)
  return {
    roadLine: `Posisjon ${la}°N ${lo}°Ø`,
    roadLineShort: `${la}°N`,
    roadLineDisplay: `${la}°N, ${lo}°Ø`,
    roadLineDisplayShort: `${la}°N`,
    s: '–',
    d: '–',
    m: '–',
    kortform: '',
    distToRoadM: 0,
    nvdbId: null,
  }
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {VegrefDescribeResult | null}
 */
function offlineOrFallbackResult(lat, lng) {
  if (
    cacheRes != null &&
    cacheLat != null &&
    cacheLng != null &&
    hooks
  ) {
    const d = hooks.haversineM(cacheLat, cacheLng, lat, lng)
    if (d < OFFLINE_REUSE_NVDB_M) {
      return cacheRes
    }
  }
  return buildCoordFallback(lat, lng)
}

/**
 * @param {VegrefDescribeResult | null} res
 * @param {number} lat
 * @param {number} lng
 */
function applyToOpenUIs(res, lat, lng) {
  const h = hooks
  if (!h) return

  const effective =
    res ||
    offlineOrFallbackResult(lat, lng)

  lastAppliedRes = effective
  lastAppliedLat = lat
  lastAppliedLng = lng

  if (h.getViewHome()) {
    h.applyHome(effective)
  }
  if (h.getKmtOpen()) {
    h.applyKmt(effective)
  }
}

/**
 * NVDB null online: behold forsiden, KMT kan vise «ingen treff».
 * @param {VegrefDescribeResult | null} res
 * @param {number} lat
 * @param {number} lng
 */
function applyNvdbNullable(res, lat, lng) {
  const h = hooks
  if (!h) return

  if (res) {
    const oid =
      lastAppliedRes &&
      typeof lastAppliedRes === 'object' &&
      'nvdbId' in lastAppliedRes
        ? /** @type {{ nvdbId?: string | number | null }} */ (lastAppliedRes)
            .nvdbId
        : null
    const nid =
      res && typeof res === 'object' && 'nvdbId' in res
        ? /** @type {{ nvdbId?: string | number | null }} */ (res).nvdbId
        : null
    if (nid != null) {
      if (oid != null && String(nid) === String(oid)) {
        segmentConfidence = Math.min(10, segmentConfidence + 1)
      } else {
        segmentConfidence = 0
      }
      lastNvdbSegmentApplyAt = Date.now()
    }
    lastAppliedRes = res
    lastAppliedLat = lat
    lastAppliedLng = lng
    if (h.getViewHome()) h.applyHome(res)
    if (h.getKmtOpen()) h.applyKmt(res)
    return
  }

  const off = offlineOrFallbackResult(lat, lng)
  lastAppliedRes = off
  lastAppliedLat = lat
  lastAppliedLng = lng
  if (h.getViewHome()) h.applyHome(off)
  if (h.getKmtOpen()) h.applyKmt(off)
}

/**
 * @param {VegrefHooks} h
 */
export function initVegrefLive(h) {
  hooks = h
}

export function vegrefStopPipeline() {
  if (nvdbAbort) {
    nvdbAbort.abort()
    nvdbAbort = null
  }
  fetchGeneration += 1
  inFlightAnchorLat = null
  inFlightAnchorLng = null
}

/** Etter navigasjon / nytt DOM: tegn siste kjente ref på nytt. */
export function vegrefReapplyLastToDom() {
  const h = hooks
  if (!h || !lastAppliedRes || lastAppliedLat == null || lastAppliedLng == null) {
    return
  }
  if (h.getViewHome()) h.applyHome(lastAppliedRes)
  if (h.getKmtOpen()) h.applyKmt(lastAppliedRes)
}

export function vegrefHasLastDisplay() {
  return lastAppliedRes != null
}

/**
 * Kall fra UI når nytt segment vises (nullstiller hard lock / kandidat).
 */
export function vegrefClearSegmentLock() {
  candidateSegmentId = null
  candidateSince = 0
}

/**
 * Stillestående: lav fart og høy segment-confidence (meter skal ikke jittere).
 * @param {number} speed
 * @param {number} segmentConfidence
 */
export function isStationary(speed, segmentConfidence) {
  return speed < 1 && segmentConfidence > 5
}

/** Bruker siste fart og confidence fra vegref-pipelinen. */
export function vegrefIsStationary() {
  return isStationary(lastSpeed, segmentConfidence)
}

export function vegrefGetLastSpeed() {
  return lastSpeed
}

export function vegrefGetSegmentConfidence() {
  return segmentConfidence
}

/**
 * @param {number} speedMps
 * @returns {number}
 */
function getHardSegmentLockMs(speedMps) {
  const s =
    typeof speedMps === 'number' && !Number.isNaN(speedMps) ? speedMps : 0
  return s > 15 ? 800 : s > 5 ? 1200 : 1600
}

/**
 * @param {number | null | undefined} h
 * @returns {number | null}
 */
function smoothHeadingFn(h) {
  if (h == null || Number.isNaN(h)) return smoothHeading
  if (smoothHeading == null) return (smoothHeading = h)

  const diff = ((h - smoothHeading + 540) % 360) - 180
  smoothHeading = (smoothHeading + diff * 0.3 + 360) % 360
  return smoothHeading
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {number} [timestamp]
 * @param {(a: number, b: number, c: number, d: number) => number} haversineMFn
 */
function computeSpeed(lat, lng, timestamp, haversineMFn) {
  const ts =
    typeof timestamp === 'number' && !Number.isNaN(timestamp)
      ? timestamp
      : Date.now()
  if (!lastPosForSpeed) {
    lastPosForSpeed = { lat, lng, timestamp: ts }
    return 0
  }
  const d = haversineMFn(
    lastPosForSpeed.lat,
    lastPosForSpeed.lng,
    lat,
    lng,
  )
  const dt = (ts - lastPosForSpeed.timestamp) / 1000
  lastPosForSpeed = { lat, lng, timestamp: ts }
  if (dt <= 0) return lastSpeed
  const speed = d / dt
  lastSpeed = speed
  return speed
}

/**
 * Nytt NVDB-segment må være stabilt før apply (unngår hopp i kryss / parallelle veier).
 * @param {VegrefDescribeResult} res
 * @param {number} speedMps
 */
function shouldDeferSegmentChange(res, speedMps) {
  if (!res || res.nvdbId == null) return false
  const newId = res.nvdbId
  const lastId =
    lastAppliedRes &&
    typeof lastAppliedRes === 'object' &&
    'nvdbId' in lastAppliedRes &&
    /** @type {{ nvdbId?: unknown }} */ (lastAppliedRes).nvdbId != null
      ? /** @type {{ nvdbId: string | number }} */ (lastAppliedRes).nvdbId
      : null
  if (lastId == null) {
    candidateSegmentId = null
    return false
  }
  if (String(newId) === String(lastId)) {
    candidateSegmentId = null
    return false
  }
  const meta = /** @type {{ _vegrefMeta?: { newSegScore?: number, prevSegScore?: number | null } }} */ (
    res
  )._vegrefMeta
  if (
    meta &&
    typeof meta.newSegScore === 'number' &&
    meta.prevSegScore != null &&
    typeof meta.prevSegScore === 'number'
  ) {
    if (meta.newSegScore < meta.prevSegScore * 0.7) {
      candidateSegmentId = null
      candidateSince = 0
      return false
    }
    if (
      speedMps > 8 &&
      meta.newSegScore < meta.prevSegScore * 0.85
    ) {
      candidateSegmentId = null
      candidateSince = 0
      return false
    }
  }
  if (candidateSegmentId !== newId) {
    candidateSegmentId = newId
    candidateSince = Date.now()
    return true
  }
  const baseLock = getHardSegmentLockMs(speedMps)
  const confFactor = 1 + segmentConfidence * 0.1
  const lockMs = Math.min(2800, baseLock * confFactor)
  if (Date.now() - candidateSince < lockMs) {
    return true
  }
  candidateSegmentId = null
  return false
}

export function vegrefResetSessionCache() {
  vegrefStopPipeline()
  lastFetchMs = 0
  lastFetchLat = null
  lastFetchLng = null
  cacheLat = null
  cacheLng = null
  cacheRes = null
  lastAppliedRes = null
  lastAppliedLat = null
  lastAppliedLng = null
  inFlightAnchorLat = null
  inFlightAnchorLng = null
  lastGpsTimestamp = 0
  smoothLat = null
  smoothLng = null
  candidateSegmentId = null
  candidateSince = 0
  segmentConfidence = 0
  lastNvdbSegmentApplyAt = 0
  lastConfidenceDecayAt = 0
  smoothHeading = null
  lastSpeed = 0
  lastPosForSpeed = null
}

/** Første oppslag etter åpning av KMT: ikke vent på throttling. */
export function vegrefResetThrottle() {
  lastFetchMs = 0
  lastFetchLat = null
  lastFetchLng = null
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {{ forceImmediate?: boolean, accuracyM?: number, timestamp?: number, userHeadingDeg?: number | null }} [opts]
 */
export function vegrefNotifyGps(lat, lng, opts = {}) {
  const h = hooks
  if (!h || lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return
  }

  if (
    opts.timestamp != null &&
    typeof opts.timestamp === 'number' &&
    opts.timestamp < lastGpsTimestamp
  ) {
    return
  }
  if (opts.timestamp != null && typeof opts.timestamp === 'number') {
    lastGpsTimestamp = opts.timestamp
  }

  const wallNow = Date.now()
  if (
    lastNvdbSegmentApplyAt > 0 &&
    wallNow - lastNvdbSegmentApplyAt > 2000 &&
    wallNow - lastConfidenceDecayAt >= 2000
  ) {
    segmentConfidence = Math.max(0, segmentConfidence - 0.1)
    lastConfidenceDecayAt = wallNow
  }

  const { forceImmediate = false } = opts
  const accuracyM =
    typeof opts.accuracyM === 'number' && !Number.isNaN(opts.accuracyM)
      ? opts.accuracyM
      : 28

  const tsForSpeed =
    opts.timestamp != null && typeof opts.timestamp === 'number'
      ? opts.timestamp
      : Date.now()
  const prevForHeading = lastPosForSpeed
  const posBeforeSpeed = lastPosForSpeed
    ? {
        lat: lastPosForSpeed.lat,
        lng: lastPosForSpeed.lng,
        timestamp: lastPosForSpeed.timestamp,
      }
    : null
  const lastSpeedBefore = lastSpeed
  const speedMps = computeSpeed(lat, lng, tsForSpeed, h.haversineM)
  if (posBeforeSpeed && speedMps < 0.5) {
    const jump = h.haversineM(
      posBeforeSpeed.lat,
      posBeforeSpeed.lng,
      lat,
      lng,
    )
    if (jump > 10) {
      lastPosForSpeed = posBeforeSpeed
      lastSpeed = lastSpeedBefore
      return
    }
  }

  let effHeadingDeg =
    typeof opts.userHeadingDeg === 'number' && !Number.isNaN(opts.userHeadingDeg)
      ? opts.userHeadingDeg
      : null
  if (effHeadingDeg == null && prevForHeading) {
    effHeadingDeg = bearingDeg(
      prevForHeading.lat,
      prevForHeading.lng,
      lat,
      lng,
    )
  }

  const effHeadingSmoothed = smoothHeadingFn(effHeadingDeg)
  if (effHeadingSmoothed != null) {
    effHeadingDeg = effHeadingSmoothed
  }

  const highSpeed = lastSpeed > 15
  const aSmooth = highSpeed ? 0.5 : 0.3
  const aKeep = 1 - aSmooth

  let useLat = lat
  let useLng = lng
  if (smoothLat == null || smoothLng == null) {
    smoothLat = lat
    smoothLng = lng
  } else {
    smoothLat = smoothLat * aKeep + lat * aSmooth
    smoothLng = smoothLng * aKeep + lng * aSmooth
  }
  useLat = smoothLat
  useLng = smoothLng

  /* Stillestående: ikke spam NVDB på vanlige GPS-tikk (unngår meter-jitter). */
  /* KMT åpning bruker forceImmediate — da må oppslag/stille reapply fortsatt gå igjennom. */
  if (lastSpeed < 1 && segmentConfidence > 5 && !forceImmediate) {
    return
  }

  if (nvdbAbort && inFlightAnchorLat != null && inFlightAnchorLng != null) {
    const movedInflight = h.haversineM(
      inFlightAnchorLat,
      inFlightAnchorLng,
      useLat,
      useLng,
    )
    const coalesceRadius = Math.max(
      VEGREF_INFLIGHT_COALESCE_BASE_M,
      accuracyM * 0.42,
    )
    if (!forceImmediate && movedInflight < coalesceRadius) {
      return
    }
  }

  const now = Date.now()
  const moved =
    lastFetchLat == null
      ? Infinity
      : h.haversineM(lastFetchLat, lastFetchLng, useLat, useLng)
  const minInterval =
    accuracyM > 48
      ? VEGREF_MIN_INTERVAL_MS + 420
      : accuracyM > 36
        ? VEGREF_MIN_INTERVAL_MS + 220
        : VEGREF_MIN_INTERVAL_MS
  const minMove =
    accuracyM > 48 ? 7 : accuracyM > 36 ? 5 : VEGREF_MIN_MOVE_M
  const throttled =
    !forceImmediate &&
    now - lastFetchMs < minInterval &&
    moved < minMove
  if (throttled) return

  lastFetchMs = now
  lastFetchLat = useLat
  lastFetchLng = useLng

  if (nvdbAbort) nvdbAbort.abort()
  nvdbAbort = new AbortController()
  const { signal } = nvdbAbort
  const seq = fetchGeneration + 1
  fetchGeneration = seq
  inFlightAnchorLat = useLat
  inFlightAnchorLng = useLng

  const online = typeof navigator === 'undefined' || navigator.onLine !== false

  if (!online) {
    inFlightAnchorLat = null
    inFlightAnchorLng = null
    const off = offlineOrFallbackResult(useLat, useLng)
    applyToOpenUIs(off, useLat, useLng)
    return
  }

  h.beforeNvdbFetch?.()

  void (async () => {
    try {
      const prevId =
        lastAppliedRes && typeof lastAppliedRes === 'object' && 'nvdbId' in lastAppliedRes
          ? /** @type {{ nvdbId?: string | number | null }} */ (lastAppliedRes).nvdbId
          : null
      const res = await h.fetchRoadReferenceNear(useLat, useLng, {
        signal,
        accuracyM,
        prevNvdbId: prevId ?? null,
        userHeadingDeg: effHeadingDeg,
        speed: speedMps,
      })
      if (signal.aborted) return
      if (seq !== fetchGeneration) return
      if (
        res &&
        lastSpeed >= 2 &&
        shouldDeferSegmentChange(res, lastSpeed)
      ) {
        if (seq !== fetchGeneration) return
        return
      }
      if (seq !== fetchGeneration) return
      if (res) {
        candidateSegmentId = null
        cacheLat = useLat
        cacheLng = useLng
        cacheRes = res
      }
      if (seq !== fetchGeneration) return
      applyNvdbNullable(res, useLat, useLng)
    } catch (e) {
      if (/** @type {{ name?: string }} */ (e).name === 'AbortError') return
      if (seq !== fetchGeneration) return
      const off = offlineOrFallbackResult(useLat, useLng)
      if (seq !== fetchGeneration) return
      applyToOpenUIs(off, useLat, useLng)
    } finally {
      if (seq === fetchGeneration) {
        inFlightAnchorLat = null
        inFlightAnchorLng = null
      }
    }
  })()
}
