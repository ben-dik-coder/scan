/**
 * Felles NVDB-oppslag for forsiden og KMT (ta bilde), med én throttlet pipeline,
 * avbrudd mot utdaterte svar, og offline-/nettverksfallback uten å blokkere UI.
 */

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

/** Gjenbruk siste NVDB-treff når posisjon er i nærheten (offline / nettfeil). */
const OFFLINE_REUSE_NVDB_M = 90

let hooks = /** @type {VegrefHooks | null} */ (null)

let lastFetchMs = 0
let lastFetchLat = /** @type {number | null} */ (null)
let lastFetchLng = /** @type {number | null} */ (null)

/** @type {AbortController | null} */
let nvdbAbort = null
let fetchGeneration = 0

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
    lastAppliedRes = res
    lastAppliedLat = lat
    lastAppliedLng = lng
    if (h.getViewHome()) h.applyHome(res)
    if (h.getKmtOpen()) h.applyKmt(res)
    return
  }

  if (h.getViewHome()) {
    /* Behold siste visning – ikke tøm. */
  }
  if (h.getKmtOpen()) {
    h.applyKmt(null)
  }
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
 * @param {{ forceImmediate?: boolean }} [opts]
 */
export function vegrefNotifyGps(lat, lng, opts = {}) {
  const h = hooks
  if (!h || lat == null || lng == null || Number.isNaN(lat) || Number.isNaN(lng)) {
    return
  }

  const { forceImmediate = false } = opts
  const now = Date.now()
  const moved =
    lastFetchLat == null
      ? Infinity
      : h.haversineM(lastFetchLat, lastFetchLng, lat, lng)
  const throttled =
    !forceImmediate &&
    now - lastFetchMs < VEGREF_MIN_INTERVAL_MS &&
    moved < VEGREF_MIN_MOVE_M
  if (throttled) return

  lastFetchMs = now
  lastFetchLat = lat
  lastFetchLng = lng

  if (nvdbAbort) nvdbAbort.abort()
  nvdbAbort = new AbortController()
  const { signal } = nvdbAbort
  const seq = fetchGeneration + 1
  fetchGeneration = seq

  const online = typeof navigator === 'undefined' || navigator.onLine !== false

  if (!online) {
    const off = offlineOrFallbackResult(lat, lng)
    applyToOpenUIs(off, lat, lng)
    return
  }

  h.beforeNvdbFetch?.()

  void (async () => {
    try {
      const res = await h.fetchRoadReferenceNear(lat, lng, { signal })
      if (signal.aborted) return
      if (seq !== fetchGeneration) return
      if (res) {
        cacheLat = lat
        cacheLng = lng
        cacheRes = res
      }
      applyNvdbNullable(res, lat, lng)
    } catch (e) {
      if (/** @type {{ name?: string }} */ (e).name === 'AbortError') return
      if (seq !== fetchGeneration) return
      const off = offlineOrFallbackResult(lat, lng)
      applyToOpenUIs(off, lat, lng)
    }
  })()
}
