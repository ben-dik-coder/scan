/**
 * Felles NVDB-oppslag for forsiden og KMT (ta bilde), med én throttlet pipeline,
 * avbrudd mot utdaterte svar, og offline-/nettverksfallback uten å blokkere UI.
 */

import { bearingDeg } from './nvdbVegref.js'
import { logVegrefMetric } from './vegrefMetrics.js'

/** @typedef {ReturnType<import('./nvdbVegref.js').fetchRoadReferenceNear> extends Promise<infer R> ? R : never} VegrefDescribeResult */

/**
 * @typedef {{
 *   haversineM: (lat1: number, lng1: number, lat2: number, lng2: number) => number
 *   fetchRoadReferenceNear: typeof import('./nvdbVegref.js').fetchRoadReferenceNear
 *   fetchRoadReferenceNearOffline?: typeof import('./vegrefLocal.js').resolveOfflineRoadReferenceNear
 *   shouldPreferOfflineResolver?: () => boolean
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
const OFFLINE_REUSE_NVDB_M = 200

/** Monoton tid fra GPS (unngår out-of-order fixes som gir bakover-meter). */
let lastGpsTimestamp = 0

/** Siste gang NVDB ble kalt mens stillestående (periodisk refresh). */
let lastStationaryFetchMs = 0
/** Intervall for NVDB-kall når stillestående (ms). */
const STATIONARY_REFRESH_MS = 8000

/** Eksponentiell glatting av posisjon før NVDB (reduserer jitter). */
let smoothLat = /** @type {number | null} */ (null)
let smoothLng = /** @type {number | null} */ (null)

/** Må bekreftes dynamisk (fart) + confidence før UI bytter segment (anti-hopping). */
let candidateSegmentId = /** @type {string | number | null} */ (null)
let candidateSince = 0
let candidateWins = 0

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
 * @param {{ accuracyM?: number, speedMps?: number, online?: boolean }} [ctx]
 */
function applyNvdbNullable(res, lat, lng, ctx = {}) {
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
    const segmentChanged =
      oid != null &&
      nid != null &&
      String(oid) !== String(nid)
    logVegrefMetric({
      accuracyM: ctx.accuracyM,
      speedMps: ctx.speedMps,
      online: ctx.online !== false,
      source:
        res._vegrefMeta?.source === 'offline' ? 'offline' : 'online',
      distToRoadM:
        typeof res.distToRoadM === 'number' && Number.isFinite(res.distToRoadM)
          ? res.distToRoadM
          : null,
      nvdbId: nid,
      segmentChanged,
      lat: Math.round(lat * 1e5) / 1e5,
      lng: Math.round(lng * 1e5) / 1e5,
    })
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
/**
 * Gjenopprett pipeline-cache fra localStorage (offline / rask første visning).
 * @param {number} lat
 * @param {number} lng
 * @param {VegrefDescribeResult} res
 */
export function vegrefHydrateFromPersisted(lat, lng, res) {
  if (lat == null || lng == null || !res || typeof res !== 'object') return
  cacheLat = lat
  cacheLng = lng
  cacheRes = res
  lastAppliedRes = res
  lastAppliedLat = lat
  lastAppliedLng = lng
}

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
  lastStationaryFetchMs = 0
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
  candidateWins = 0
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
    candidateSince = 0
    candidateWins = 0
    return false
  }
  if (String(newId) === String(lastId)) {
    candidateSegmentId = null
    candidateSince = 0
    candidateWins = 0
    return false
  }
  const meta = /** @type {{ _vegrefMeta?: { newSegScore?: number, prevSegScore?: number | null, scoreDelta?: number | null, source?: string } }} */ (
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
      candidateWins = 0
      return false
    }
    if (
      speedMps > 8 &&
      meta.newSegScore < meta.prevSegScore * 0.85
    ) {
      candidateSegmentId = null
      candidateSince = 0
      candidateWins = 0
      return false
    }
  }
  if (candidateSegmentId !== newId) {
    candidateSegmentId = newId
    candidateSince = Date.now()
    candidateWins = 1
    return true
  }
  candidateWins += 1
  const baseLock = getHardSegmentLockMs(speedMps)
  const confFactor = 1 + segmentConfidence * 0.1
  const lockMs = Math.min(2800, baseLock * confFactor)
  const stableForMs = Date.now() - candidateSince
  let requiredWins =
    speedMps < 1 ? 4 : speedMps < 3 ? 3 : speedMps < 8 ? 2 : 1
  const source = meta && typeof meta.source === 'string' ? meta.source : null
  if (source === 'offline') requiredWins += 1
  if (
    meta &&
    typeof meta.scoreDelta === 'number' &&
    Number.isFinite(meta.scoreDelta) &&
    meta.scoreDelta > 25
  ) {
    requiredWins = Math.max(1, requiredWins - 1)
  }
  if (stableForMs < lockMs || candidateWins < requiredWins) {
    return true
  }
  /* Lock expired — accept the segment change instead of resetting. */
  candidateSegmentId = null
  candidateSince = 0
  candidateWins = 0
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
  candidateWins = 0
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
    segmentConfidence = Math.max(0, segmentConfidence - 0.5)
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
  let gpsLat = lat
  let gpsLng = lng
  if (posBeforeSpeed && speedMps < 0.5) {
    const jump = h.haversineM(
      posBeforeSpeed.lat,
      posBeforeSpeed.lng,
      lat,
      lng,
    )
    if (jump > 10) {
      /* GPS jump detected — restore speed AND use previous position for
         smoothing/heading so the jump doesn't pollute downstream. */
      lastPosForSpeed = posBeforeSpeed
      lastSpeed = lastSpeedBefore
      gpsLat = posBeforeSpeed.lat
      gpsLng = posBeforeSpeed.lng
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
      gpsLat,
      gpsLng,
    )
  }

  const effHeadingSmoothed = smoothHeadingFn(effHeadingDeg)
  if (effHeadingSmoothed != null) {
    effHeadingDeg = effHeadingSmoothed
  }

  const highSpeed = lastSpeed > 15
  const aSmooth = highSpeed ? 0.5 : 0.3
  const aKeep = 1 - aSmooth

  let useLat = gpsLat
  let useLng = gpsLng
  if (smoothLat == null || smoothLng == null) {
    smoothLat = gpsLat
    smoothLng = gpsLng
  } else {
    smoothLat = smoothLat * aKeep + gpsLat * aSmooth
    smoothLng = smoothLng * aKeep + gpsLng * aSmooth
  }
  useLat = smoothLat
  useLng = smoothLng

  /* Stillestående: reduser frekvens men IKKE stopp helt (unngår permanent frys). */
  if (lastSpeed < 1 && segmentConfidence > 5 && !forceImmediate) {
    const now2 = Date.now()
    if (now2 - lastStationaryFetchMs < STATIONARY_REFRESH_MS) {
      return
    }
    lastStationaryFetchMs = now2
  }

  if (nvdbAbort && inFlightAnchorLat != null && inFlightAnchorLng != null) {
    const movedInflight = h.haversineM(
      inFlightAnchorLat,
      inFlightAnchorLng,
      useLat,
      useLng,
    )
    let coalesceRadius = Math.max(
      VEGREF_INFLIGHT_COALESCE_BASE_M,
      accuracyM * 0.42,
    )
    if (lastSpeed > 28) coalesceRadius *= 0.68
    else if (lastSpeed > 18) coalesceRadius *= 0.82
    if (!forceImmediate && movedInflight < coalesceRadius) {
      return
    }
  }

  const now = Date.now()
  const moved =
    lastFetchLat == null
      ? Infinity
      : h.haversineM(lastFetchLat, lastFetchLng, useLat, useLng)
  let minInterval =
    accuracyM > 48
      ? VEGREF_MIN_INTERVAL_MS + 420
      : accuracyM > 36
        ? VEGREF_MIN_INTERVAL_MS + 220
        : VEGREF_MIN_INTERVAL_MS
  let minMove =
    accuracyM > 48 ? 7 : accuracyM > 36 ? 5 : VEGREF_MIN_MOVE_M
  if (lastSpeed > 32) {
    minInterval = Math.max(260, minInterval - 110)
    minMove = Math.max(1, minMove - 2)
  } else if (lastSpeed > 22) {
    minInterval = Math.max(300, minInterval - 70)
    minMove = Math.max(1, minMove - 1)
  }
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
  const preferOffline =
    Boolean(h.fetchRoadReferenceNearOffline) &&
    (typeof h.shouldPreferOfflineResolver === 'function'
      ? h.shouldPreferOfflineResolver()
      : !online)

  if (!online && !h.fetchRoadReferenceNearOffline) {
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
      const fetchOpts = {
        signal,
        accuracyM,
        prevNvdbId: prevId ?? null,
        userHeadingDeg: effHeadingDeg,
        speed: speedMps,
      }
      let res = null
      if (preferOffline && h.fetchRoadReferenceNearOffline) {
        res = await h.fetchRoadReferenceNearOffline(useLat, useLng, fetchOpts)
      }
      if (!res && online) {
        res = await h.fetchRoadReferenceNear(useLat, useLng, fetchOpts)
      }
      if (!res && !online && h.fetchRoadReferenceNearOffline) {
        res = await h.fetchRoadReferenceNearOffline(useLat, useLng, fetchOpts)
      }
      if (signal.aborted) return
      if (seq !== fetchGeneration) return
      if (
        res &&
        shouldDeferSegmentChange(res, speedMps)
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
      applyNvdbNullable(res, useLat, useLng, {
        accuracyM,
        speedMps,
        online,
      })
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
