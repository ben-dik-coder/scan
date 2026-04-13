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
 *   fetchRoadPositionDirect: typeof import('./nvdbVegref.js').fetchRoadPositionDirect
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

/** Vent litt før supplerende segmentert-kall (veinavn) — unngår å stable NVDB på kald start. */
const POSISJON_ENRICH_SEGMENT_DELAY_MS = 1600

/**
 * Ikke avbryt pågående NVDB-kall ved mikro-bevegelse (reduserer «henger» / evig retry).
 * Skaler litt med GPS-nøyaktighet.
 */
const VEGREF_INFLIGHT_COALESCE_BASE_M = 6

/** Gjenbruk siste NVDB-treff når posisjon er i nærheten (offline / nettfeil). */
const OFFLINE_REUSE_NVDB_M = 50

/** Monoton tid fra GPS (unngår out-of-order fixes som gir bakover-meter). */
let lastGpsTimestamp = 0

/** Eksponentiell glatting av posisjon før NVDB (reduserer jitter). */
let smoothLat = /** @type {number | null} */ (null)
let smoothLng = /** @type {number | null} */ (null)

/** @type {number} */
let segmentConfidence = 0

/** Siste tidspunkt NVDB-segment faktisk ble oppdatert (for confidence-decay). */
let lastNvdbSegmentApplyAt = 0
/** Siste decay-steg (maks én gang per ~2 s ved inaktivitet). */
let lastConfidenceDecayAt = 0

/**
 * NVDB posisjon returnerer ett treff uten klient-hysterese — i tettbygd kan ID flakse.
 * Vi bytter ikke visning til nytt segment før: tydelig lav avstand til vei, eller to påfølgende
 * forespørsler med samme nye ID (samme som pickBestSegment-idéen).
 */
let posisjonPendingNewNvdbId = /** @type {string | number | null} */ (null)

/**
 * Unngå gjentatte segmentert-kall for samme posisjon-NVDB-id når visning allerede er beriket
 * eller segment ikke ga bedre navn. Settes først når et forsøk er ferdig (suksess eller «ingen bedring»).
 */
let lastPosisjonEnrichNvdbId = /** @type {string | number | null} */ (null)

/** Egen avbryter for veinavn-berikelse — må ikke kobles til hoved-NVDB `AbortController` (ny GPS avbryter den). */
let posisjonEnrichAbort = /** @type {AbortController | null} */ (null)

function abortPosisjonEnrichInFlight() {
  if (posisjonEnrichAbort) {
    posisjonEnrichAbort.abort()
    posisjonEnrichAbort = null
  }
}

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
    _vegrefMeta: { source: 'coord-fallback' },
  }
}

/**
 * Koordinat-fallback (midlertidig nett-/NVDB-feil): da må vi ikke throttle like hardt,
 * ellers henger UI i °N/°Ø til brukeren refresher.
 * @param {VegrefDescribeResult | null} [res]
 */
function isCoordFallbackDisplay(res) {
  if (!res || typeof res !== 'object') return false
  const meta = /** @type {{ _vegrefMeta?: { source?: string } }} */ (res)
    ._vegrefMeta
  if (meta?.source === 'coord-fallback') return true
  const line = String(
    /** @type {{ roadLine?: unknown }} */ (res).roadLine || '',
  ).trim()
  return /^Posisjon\s+[\d.]+°N/i.test(line)
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
    const metaSrc = res._vegrefMeta?.source

    if (
      metaSrc === 'posisjon' &&
      oid != null &&
      nid != null &&
      String(oid) !== String(nid)
    ) {
      const dist =
        typeof res.distToRoadM === 'number' && Number.isFinite(res.distToRoadM)
          ? res.distToRoadM
          : 999
      const acc =
        typeof ctx.accuracyM === 'number' && !Number.isNaN(ctx.accuracyM)
          ? ctx.accuracyM
          : 28
      const clearOnRoad = dist <= Math.min(11, Math.max(5.5, acc * 0.3))
      const pendingMatch =
        posisjonPendingNewNvdbId != null &&
        String(posisjonPendingNewNvdbId) === String(nid)
      if (clearOnRoad) {
        posisjonPendingNewNvdbId = null
      } else if (pendingMatch) {
        posisjonPendingNewNvdbId = null
      } else {
        posisjonPendingNewNvdbId = nid
        return
      }
    } else if (
      nid != null &&
      oid != null &&
      String(nid) === String(oid)
    ) {
      posisjonPendingNewNvdbId = null
    }

    const segmentChanged =
      oid != null &&
      nid != null &&
      String(oid) !== String(nid)
    logVegrefMetric({
      accuracyM: ctx.accuracyM,
      speedMps: ctx.speedMps,
      online: ctx.online !== false,
      source:
        metaSrc === 'offline'
          ? 'offline'
          : metaSrc === 'posisjon'
            ? 'posisjon'
            : 'online',
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
  posisjonPendingNewNvdbId = null
}

export function initVegrefLive(h) {
  hooks = h
}

export function vegrefStopPipeline() {
  abortPosisjonEnrichInFlight()
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

/** Kall fra UI ved veksling av vegsegment (API-kompatibilitet). */
export function vegrefClearSegmentLock() {}

/**
 * Stillestående (parkert): svært lav fart og høy segment-confidence.
 * (GPS rapporterer ofte ~0 m/s under kjøring – ikke bruk dette til å stoppe NVDB.)
 * @param {number} speed
 * @param {number} segmentConfidence
 */
export function isStationary(speed, segmentConfidence) {
  return speed < 0.35 && segmentConfidence > 7
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
 * @param {string} s
 */
function isOfficialVegsystemLineOnly(s) {
  const t = String(s || '').trim()
  if (!t) return true
  return /^(Europaveg|Riksveg|Fylkesveg|Kommunal veg|Privat veg|Skogsbilveg|Ukjent veg|Veg)\b/i.test(
    t,
  )
}

/**
 * Når posisjon-API bare gir offisiell vegkategori-linje, suppler med segmentert treff
 * som ofte har `adresse.navn` (f.eks. Åsveien). Bevar S/D/meter fra posisjon.
 * Kjører i bakgrunnen etter første apply — unngår å doble NVDB-laten ved oppstart.
 * @param {VegrefDescribeResult} res
 * @param {number} lat
 * @param {number} lng
 * @param {{
 *   accuracyM: number
 *   prevNvdbId: string | number | null
 *   userHeadingDeg: number | null | undefined
 *   speed: number
 * }} fetchOpts
 * @param {VegrefHooks} h
 * @param {{ accuracyM?: number, speedMps?: number, online?: boolean }} applyCtx
 */
function schedulePosisjonDisplayEnrichFromSegments(
  res,
  lat,
  lng,
  fetchOpts,
  h,
  applyCtx,
) {
  if (!res?._vegrefMeta || res._vegrefMeta.source !== 'posisjon') return
  if (!h.fetchRoadReferenceNear) return
  const nid = res.nvdbId
  if (nid == null) return
  const disp = String(res.roadLineDisplay || res.roadLine || '').trim()
  if (!isOfficialVegsystemLineOnly(disp)) return
  if (String(lastPosisjonEnrichNvdbId) === String(nid)) return

  abortPosisjonEnrichInFlight()
  const enrichCtrl = new AbortController()
  posisjonEnrichAbort = enrichCtrl
  const enrichSignal = enrichCtrl.signal
  const targetNvdbId = nid

  void (async () => {
    try {
      await new Promise((r) =>
        setTimeout(r, POSISJON_ENRICH_SEGMENT_DELAY_MS),
      )
      if (enrichSignal.aborted) return
      const segRes = await h.fetchRoadReferenceNear(lat, lng, {
        signal: enrichSignal,
        accuracyM: fetchOpts.accuracyM,
        prevNvdbId: fetchOpts.prevNvdbId,
        userHeadingDeg: fetchOpts.userHeadingDeg,
        speed: fetchOpts.speed,
      })
      if (enrichSignal.aborted) return
      if (!segRes) {
        lastPosisjonEnrichNvdbId = targetNvdbId
        return
      }
      const segDisp = String(segRes.roadLineDisplay || segRes.roadLine || '').trim()
      if (!segDisp || isOfficialVegsystemLineOnly(segDisp)) {
        lastPosisjonEnrichNvdbId = targetNvdbId
        return
      }
      if (segDisp === disp) {
        lastPosisjonEnrichNvdbId = targetNvdbId
        return
      }
      const merged = {
        ...res,
        roadLineDisplay: segRes.roadLineDisplay,
        roadLineDisplayShort:
          segRes.roadLineDisplayShort ||
          segRes.roadLineShort ||
          segRes.roadLineDisplay,
        roadLine: segRes.roadLine || res.roadLine,
        roadLineShort: segRes.roadLineShort || res.roadLineShort,
      }
      const cur = lastAppliedRes
      const curId =
        cur && typeof cur === 'object' && 'nvdbId' in cur
          ? /** @type {{ nvdbId?: string | number | null }} */ (cur).nvdbId
          : null
      if (
        curId != null &&
        String(curId) !== String(targetNvdbId)
      ) {
        return
      }
      if (lastAppliedLat != null && lastAppliedLng != null && hooks) {
        const drift = hooks.haversineM(lastAppliedLat, lastAppliedLng, lat, lng)
        if (drift > 140) return
      }
      cacheLat = lat
      cacheLng = lng
      cacheRes = merged
      if (enrichSignal.aborted) return
      applyNvdbNullable(merged, lat, lng, applyCtx)
      lastPosisjonEnrichNvdbId = targetNvdbId
    } catch (e) {
      if (/** @type {{ name?: string }} */ (e).name === 'AbortError') return
      lastPosisjonEnrichNvdbId = null
    } finally {
      if (posisjonEnrichAbort === enrichCtrl) posisjonEnrichAbort = null
    }
  })()
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
  segmentConfidence = 0
  lastNvdbSegmentApplyAt = 0
  lastConfidenceDecayAt = 0
  smoothHeading = null
  lastSpeed = 0
  lastPosForSpeed = null
  posisjonPendingNewNvdbId = null
  lastPosisjonEnrichNvdbId = null
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
  /* Litt mindre vekt på siste fix ved høy fart → mindre GPS-støy i NVDB-inndata */
  const aSmooth = highSpeed ? 0.38 : 0.3
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
  const inCoordFallbackUi = isCoordFallbackDisplay(lastAppliedRes)
  /** Når vi viser koordinat-fallback: tillat oftere nytt NVDB-forsøk (samme logikk ellers). */
  const recoverMs = 280
  const recoverMoveM = 1.2
  const throttled =
    !forceImmediate &&
    (inCoordFallbackUi
      ? now - lastFetchMs < recoverMs && moved < recoverMoveM
      : now - lastFetchMs < minInterval && moved < minMove)
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
      const fetchOpts = { signal, accuracyM }
      let res = null

      if (preferOffline && h.fetchRoadReferenceNearOffline) {
        res = await h.fetchRoadReferenceNearOffline(useLat, useLng, fetchOpts)
      }

      if (!res && online && h.fetchRoadPositionDirect) {
        try {
          res = await h.fetchRoadPositionDirect(useLat, useLng, fetchOpts)
        } catch (e) {
          if (/** @type {{ name?: string }} */ (e).name === 'AbortError') throw e
        }
      }

      if (!res && online) {
        const prevId =
          lastAppliedRes && typeof lastAppliedRes === 'object' && 'nvdbId' in lastAppliedRes
            ? /** @type {{ nvdbId?: string | number | null }} */ (lastAppliedRes).nvdbId
            : null
        res = await h.fetchRoadReferenceNear(useLat, useLng, {
          ...fetchOpts,
          prevNvdbId: prevId ?? null,
          userHeadingDeg: effHeadingDeg,
          speed: speedMps,
        })
      }

      if (!res && !online && h.fetchRoadReferenceNearOffline) {
        res = await h.fetchRoadReferenceNearOffline(useLat, useLng, fetchOpts)
      }

      if (signal.aborted) return
      if (seq !== fetchGeneration) return
      if (res) {
        cacheLat = useLat
        cacheLng = useLng
        cacheRes = res
      }
      if (seq !== fetchGeneration) return
      const applyCtx = { accuracyM, speedMps, online }
      applyNvdbNullable(res, useLat, useLng, applyCtx)
      if (
        res &&
        online &&
        h.fetchRoadReferenceNear &&
        res._vegrefMeta?.source === 'posisjon'
      ) {
        schedulePosisjonDisplayEnrichFromSegments(
          res,
          useLat,
          useLng,
          {
            accuracyM,
            prevNvdbId: res.nvdbId ?? null,
            userHeadingDeg: effHeadingDeg,
            speed: speedMps,
          },
          h,
          applyCtx,
        )
      }
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
