/**
 * Felles NVDB-oppslag for forsiden og KMT (ta bilde), med én throttlet pipeline,
 * avbrudd mot utdaterte svar, og offline-/nettverksfallback uten å blokkere UI.
 * Når nett er «på» men NVDB feiler: forsøk nedlastet segmentpakke (IndexedDB) før koordinat-fallback.
 */

import {
  bearingDeg,
  clearSegmentNearCache,
  normalizeSurfacePreference,
} from './nvdbVegref.js'
import { vegrefDebugTrace } from './vegrefDebugTrace.js'
import { logVegrefMetric } from './vegrefMetrics.js'
import { postScanixDebugIngest } from './scanixDebugIngest.js'

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
 *   getRecentTrace?: () => Array<{ lat: number, lng: number, at: number }>
 *   applyHome: (res: VegrefDescribeResult) => void
 *   applyKmt: (res: VegrefDescribeResult | null) => void
 *   beforeNvdbFetch?: () => void
 *   getSurfacePreference?: () => string
 *   skipNetworkWhenOfflineReady?: (lat: number, lng: number) => boolean
 *   getVegrefDataMode?: () => 'minimal' | 'normal'
 * }} VegrefHooks
 */

/** Pars meter for vegref-debug (samme logikk som parseKmtMeterInt i main). */
function meterIntForMetric(m) {
  if (m == null) return null
  const t = String(m).trim()
  if (!t || t === '–' || t === '-') return null
  const n = parseInt(t.replace(/\D/g, ''), 10)
  return Number.isFinite(n) ? n : null
}

/**
 * 0 = E/R/F, 1 = K/ukjent, 2 = P/S — for rask recovery fra feil sideveg i posisjon-laget.
 * @param {unknown} res
 */
function vegrefResultCategoryTier(res) {
  if (!res || typeof res !== 'object') return 1
  const vk = /** @type {{ vegkategori?: unknown }} */ (res).vegkategori
  if (typeof vk === 'string') {
    const c = vk.trim().toUpperCase()
    if (c === 'E' || c === 'R' || c === 'F') return 0
    if (c === 'K') return 1
    if (c === 'P' || c === 'S') return 2
  }
  const kf = /** @type {{ kortform?: unknown }} */ (res).kortform
  if (typeof kf === 'string') {
    const s = kf.trim()
    if (/^(Fv|Rv|Ev)\s/i.test(s) || /^(Fv|Rv|Ev)\d/i.test(s)) return 0
    if (/^(Pv|Sv)\s/i.test(s) || /^(Pv|Sv)\d/i.test(s)) return 2
  }
  return 1
}

/** Felles timing for forsiden og KMT – samme opplevd hastighet. */
/* Fix H4: strammet fra 400/2 → 300/1.2 slik at pipeline fyrer oftere ved
   moderat fart (en ny NVDB-respons per ~sekund matcher typisk GPS-cadence,
   og 1.2 m min-move slipper gjennom oppdateringer også ved gåtempo). */
export const VEGREF_MIN_INTERVAL_MS = 200
export const VEGREF_MIN_MOVE_M = 0.7

/** LRU-cache for /posisjon-svar (reduserer gjentatte kall ved GPS-jitter). */
const POSISJON_CACHE_TTL_MS = 16_000
const POSISJON_CACHE_MAX = 50
/** @type {Map<string, { res: VegrefDescribeResult, at: number, lat: number, lng: number }>} */
let posisjonCache = new Map()
/**
 * Pending-segmentbytte aksepteres uansett etter denne tiden, slik at GPS-støy
 * mellom parallelle veier ikke «låser» UI på feil vei.
 */
/** Kortere enn før: raskere aksept av bekreftet ny nvdb-id (færre «wait»-ticks). */
const POSISJON_PENDING_ACCEPT_MS = 650

/**
 * Ikke avbryt pågående NVDB-kall ved mikro-bevegelse (reduserer «henger» / evig retry).
 * Skaler litt med GPS-nøyaktighet.
 */
const VEGREF_INFLIGHT_COALESCE_BASE_M = 3.5

/** Gjenbruk siste treff ved stasjonær / lav fart (parkert, dårlig dekning). */
const OFFLINE_REUSE_NVDB_M = 50

/**
 * Horisont for gjenbruk av siste cache-treff: ved kjøring må den være kort,
 * ellers sitter meteren fast på gammelt m (f.eks. m4555) mens offline
 * midlertidig returnerer null og nett er skippet.
 * @returns {number}
 */
function offlineReuseMaxM() {
  const s = lastSpeed
  if (s >= 22) return 26
  if (s >= 15) return 32
  if (s >= 8) return 40
  if (s >= 3) return 46
  return OFFLINE_REUSE_NVDB_M
}

/** Monoton tid fra GPS (unngår out-of-order fixes som gir bakover-meter). */
let lastGpsTimestamp = 0

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
/** Tidspunkt (ms) da vi først så en kandidat-ny-id — brukes til å akseptere etter timeout. */
let posisjonPendingFirstSeenAt = 0
/** Forhindre umiddelbar flip-flop mellom to road-id ved kryss/støy. */
let lastAcceptedRoadSwitchAt = 0
let lastAcceptedRoadSwitchFromId = /** @type {string | number | null} */ (null)
let lastAcceptedRoadSwitchToId = /** @type {string | number | null} */ (null)
const ROAD_SWITCH_LOCKOUT_MS = 900

/** Siste GPS-punkter til trace-momentum i `pickBestSegment` (fallback hvis `getRecentTrace` mangler). */
let lastTraceSamples = /** @type {Array<{ lat: number, lng: number, at: number }>} */ ([])

function posisjonCacheKey(lat, lng) {
  /* Finere nøkkel (~1.1 m) så vi ikke gjenbruker feil vei ved korte skifter. */
  return `${Math.round(lat * 1e5)}:${Math.round(lng * 1e5)}`
}

/**
 * @param {VegrefHooks} h
 * @param {number} lat
 * @param {number} lng
 */
function getPosisjonFromCache(h, lat, lng) {
  const key = posisjonCacheKey(lat, lng)
  const hit = posisjonCache.get(key)
  if (!hit) return null
  if (Date.now() - hit.at > POSISJON_CACHE_TTL_MS) {
    posisjonCache.delete(key)
    return null
  }
  if (h.haversineM(hit.lat, hit.lng, lat, lng) > 2.5) return null
  return hit.res
}

/**
 * @param {number} lat
 * @param {number} lng
 * @param {VegrefDescribeResult} res
 */
function setPosisjonCache(lat, lng, res) {
  const key = posisjonCacheKey(lat, lng)
  posisjonCache.set(key, {
    res: /** @type {VegrefDescribeResult} */ ({ ...res }),
    at: Date.now(),
    lat,
    lng,
  })
  while (posisjonCache.size > POSISJON_CACHE_MAX) {
    const first = posisjonCache.keys().next().value
    if (first) posisjonCache.delete(first)
  }
}

/**
 * @param {VegrefHooks} h
 * @param {number} lat
 * @param {number} lng
 * @param {{ signal?: AbortSignal, accuracyM?: number }} fetchOpts
 */
async function fetchRoadPositionDirectCached(h, lat, lng, fetchOpts) {
  if (!h.fetchRoadPositionDirect) return null
  const cached = getPosisjonFromCache(h, lat, lng)
  if (cached) return cached
  const res = await h.fetchRoadPositionDirect(lat, lng, fetchOpts)
  if (res) setPosisjonCache(lat, lng, res)
  return res
}

/**
 * @param {VegrefHooks} h
 */
function getTraceSamplesForFetch(h) {
  if (typeof h.getRecentTrace === 'function') {
    const t = h.getRecentTrace()
    if (Array.isArray(t) && t.length >= 4) return t
  }
  return lastTraceSamples.length >= 4 ? lastTraceSamples : []
}

/**
 * @param {VegrefDescribeResult | null} pos
 * @param {VegrefDescribeResult | null} seg
 * @returns {VegrefDescribeResult | null}
 */
function mergePosisjonAndSegmentParallelResults(pos, seg) {
  if (!pos || !seg) return null
  const pMeta = /** @type {{ _vegrefMeta?: { source?: string } }} */ (pos)
    ._vegrefMeta?.source
  const sMeta = /** @type {{ _vegrefMeta?: { source?: string } }} */ (seg)
    ._vegrefMeta?.source
  if (pMeta === 'posisjon' && sMeta !== 'posisjon') {
    if (!posisjonEnrichSameVegsystemAsPosisjon(pos, seg)) return null
    return mergePosisjonWithSegmentDisplay(
      /** @type {object} */ (pos),
      /** @type {object} */ (seg),
    )
  }
  if (sMeta === 'posisjon' && pMeta !== 'posisjon') {
    if (!posisjonEnrichSameVegsystemAsPosisjon(seg, pos)) return null
    return mergePosisjonWithSegmentDisplay(
      /** @type {object} */ (seg),
      /** @type {object} */ (pos),
    )
  }
  return null
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

/** Separat display-clock: jevn UI uavhengig av GPS/NVDB-kadens. */
const VEGREF_DISPLAY_TICK_MS = 120
/** @type {VegrefDescribeResult | null} */
let pendingDisplayRes = null
let pendingDisplayLat = /** @type {number | null} */ (null)
let pendingDisplayLng = /** @type {number | null} */ (null)
let hasPendingDisplay = false
let lastDisplayFlushAt = 0
/** @type {ReturnType<typeof setTimeout> | null} */
let displayFlushTimer = null

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
    if (d < offlineReuseMaxM()) {
      return cacheRes
    }
  }
  /* Mellom to offline-geometrier kan posisjon flytte seg litt mer enn
   * cache-gjenbruksradius — da ville vi tidligere alltid falt til °N/°Ø.
   * Kort «sticky» av siste faktisk viste offline-treff (samme som apply bruker)
   * gir stabil veilinja og mindre UI-støy. */
  if (
    hooks &&
    lastAppliedRes &&
    typeof lastAppliedRes === 'object' &&
    lastAppliedLat != null &&
    lastAppliedLng != null
  ) {
    const meta = /** @type {{ _vegrefMeta?: { source?: string } }} */ (
      lastAppliedRes
    )._vegrefMeta
    if (meta?.source === 'offline') {
      const line = String(
        /** @type {{ roadLine?: unknown }} */ (lastAppliedRes).roadLine || '',
      )
      const nid = /** @type {{ nvdbId?: unknown }} */ (lastAppliedRes).nvdbId
      if (!/^Posisjon\s+[\d.]+°N/i.test(line) && nid != null) {
        const dAnchor = hooks.haversineM(lastAppliedLat, lastAppliedLng, lat, lng)
        const stickyM = Math.max(offlineReuseMaxM() * 3.4, 118)
        if (dAnchor < stickyM) {
          const prevDist = /** @type {{ distToRoadM?: unknown }} */ (
            lastAppliedRes
          ).distToRoadM
          return {
            ...lastAppliedRes,
            m: '–',
            distToRoadM:
              typeof prevDist === 'number' && Number.isFinite(prevDist)
                ? Math.max(prevDist, dAnchor * 0.28)
                : dAnchor * 0.35,
            _vegrefMeta: {
              ...(typeof meta === 'object' && meta != null ? meta : {}),
              source: 'offline',
              staleHold: true,
            },
          }
        }
      }
    }
  }
  return buildCoordFallback(lat, lng)
}

/**
 * @param {VegrefDescribeResult | null} res
 * @param {number} lat
 * @param {number} lng
 */
function flushPendingDisplayToOpenUis() {
  const h = hooks
  if (!h) return
  if (!hasPendingDisplay || pendingDisplayLat == null || pendingDisplayLng == null) {
    return
  }

  const effective =
    pendingDisplayRes ||
    offlineOrFallbackResult(pendingDisplayLat, pendingDisplayLng)

  lastAppliedRes = effective
  lastAppliedLat = pendingDisplayLat
  lastAppliedLng = pendingDisplayLng
  lastDisplayFlushAt = Date.now()
  displayFlushTimer = null
  pendingDisplayRes = null
  pendingDisplayLat = null
  pendingDisplayLng = null
  hasPendingDisplay = false

  if (h.getViewHome()) {
    h.applyHome(effective)
  }
  if (h.getKmtOpen()) {
    h.applyKmt(effective)
  }
}

/**
 * @param {VegrefDescribeResult | null} res
 * @param {number} lat
 * @param {number} lng
 */
function applyToOpenUIs(res, lat, lng) {
  const h = hooks
  if (!h) return
  hasPendingDisplay = true
  pendingDisplayRes = res
  pendingDisplayLat = lat
  pendingDisplayLng = lng
  const now = Date.now()
  if (now - lastDisplayFlushAt >= VEGREF_DISPLAY_TICK_MS) {
    flushPendingDisplayToOpenUis()
    return
  }
  if (displayFlushTimer != null) return
  const wait = Math.max(8, VEGREF_DISPLAY_TICK_MS - (now - lastDisplayFlushAt))
  displayFlushTimer = setTimeout(() => {
    flushPendingDisplayToOpenUis()
  }, wait)
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
      const spd =
        typeof ctx.speedMps === 'number' && !Number.isNaN(ctx.speedMps)
          ? ctx.speedMps
          : 0
      /* Ved stor radius må vi slippe gjennom første treff oftere — ellers venter UI på to NVDB-runder. */
      /* Litt slakkere terskel ved høy fart (større lateral GPS-feil vs vei). */
      const distCap = Math.min(40, 24 + (spd > 18 ? (spd - 18) * 0.45 : 0))
      const clearOnRoad = dist <= Math.min(distCap, Math.max(7, acc * 0.38))
      const pendingMatch =
        posisjonPendingNewNvdbId != null &&
        String(posisjonPendingNewNvdbId) === String(nid)
      const oldTier = vegrefResultCategoryTier(lastAppliedRes)
      const newTier = vegrefResultCategoryTier(res)
      const recoveryToPublic =
        oldTier >= 2 &&
        newTier <= 1 &&
        dist <= Math.min(38, 20 + acc * 0.55)
      const pendingAgedOut =
        posisjonPendingNewNvdbId != null &&
        posisjonPendingFirstSeenAt > 0 &&
        Date.now() - posisjonPendingFirstSeenAt >= POSISJON_PENDING_ACCEPT_MS
      /* Fix H2: vls:-IDer (unsegmented veglenkesekvens) er ofte 1-tick-treff
         i kryss/avkjørsler — aldri aksept via clearOnRoad alene. Krev minst
         én bekreftelse (pendingMatch) eller timeout. Segmenterte kf:-IDer
         beholder rask aksept. */
      const isVlsOnly =
        typeof nid === 'string' && nid.startsWith('vls:')
      const _clearOnRoadEff = clearOnRoad && !isVlsOnly
      const flipFlopBlocked =
        oid != null &&
        nid != null &&
        lastAcceptedRoadSwitchFromId != null &&
        lastAcceptedRoadSwitchToId != null &&
        String(oid) === String(lastAcceptedRoadSwitchToId) &&
        String(nid) === String(lastAcceptedRoadSwitchFromId) &&
        Date.now() - lastAcceptedRoadSwitchAt < ROAD_SWITCH_LOCKOUT_MS
      const _pendingAccepted =
        !flipFlopBlocked &&
        (recoveryToPublic || _clearOnRoadEff || pendingMatch || pendingAgedOut)
      // #region agent log H2
      vegrefDebugTrace('pending_dec', {
        hyp: 'H2',
        accepted: _pendingAccepted,
        reason: recoveryToPublic
          ? 'recoveryToPublic'
          : _clearOnRoadEff
            ? 'clearOnRoad'
            : pendingMatch
              ? 'pendingMatch'
              : pendingAgedOut
                ? 'pendingAgedOut'
                : clearOnRoad && isVlsOnly
                  ? 'waitVlsConfirm'
                  : 'wait',
        oid: oid != null ? String(oid) : null,
        nid: nid != null ? String(nid) : null,
        dist: Math.round(dist * 10) / 10,
        acc: Math.round(acc * 10) / 10,
        spd: Math.round(spd * 100) / 100,
        distCapClear: Math.round(Math.min(distCap, Math.max(7, acc * 0.38)) * 10) / 10,
        oldTier,
        newTier,
        isVlsOnly,
        flipFlopBlocked,
        runId: 'post-fix',
      })
      // #endregion
      if (_pendingAccepted) {
        lastAcceptedRoadSwitchAt = Date.now()
        lastAcceptedRoadSwitchFromId = oid
        lastAcceptedRoadSwitchToId = nid
        posisjonPendingNewNvdbId = null
        posisjonPendingFirstSeenAt = 0
      } else {
        /* Nullstill timer bare hvis ID-en faktisk er en ny kandidat — ellers
         * mister vi retning når posisjon-API flakser mellom to paralleller. */
        if (
          posisjonPendingNewNvdbId == null ||
          String(posisjonPendingNewNvdbId) !== String(nid)
        ) {
          posisjonPendingNewNvdbId = nid
          posisjonPendingFirstSeenAt = Date.now()
        }
        return
      }
    } else if (
      nid != null &&
      oid != null &&
      String(nid) === String(oid)
    ) {
      posisjonPendingNewNvdbId = null
      posisjonPendingFirstSeenAt = 0
    }

    const segmentChanged =
      oid != null &&
      nid != null &&
      String(oid) !== String(nid)
    logVegrefMetric({
      type: 'home-meter-pipeline',
      meterM: meterIntForMetric(
        /** @type {{ m?: unknown }} */ (res).m,
      ),
      accuracyM: ctx.accuracyM,
      speedMps: ctx.speedMps,
      online: ctx.online !== false,
      source:
        metaSrc === 'offline'
          ? 'offline'
          : metaSrc === 'posisjon'
            ? 'posisjon'
            : metaSrc === 'coord-fallback'
              ? 'coord-fallback'
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
    applyToOpenUIs(res, lat, lng)
    return
  }

  const off = offlineOrFallbackResult(lat, lng)
  lastAppliedRes = off
  lastAppliedLat = lat
  lastAppliedLng = lng
  applyToOpenUIs(off, lat, lng)
}

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
  posisjonPendingFirstSeenAt = 0
}

export function initVegrefLive(h) {
  hooks = h
}

export function vegrefStopPipeline() {
  if (nvdbAbort) {
    nvdbAbort.abort()
    nvdbAbort = null
  }
  if (displayFlushTimer != null) {
    clearTimeout(displayFlushTimer)
    displayFlushTimer = null
  }
  hasPendingDisplay = false
  pendingDisplayRes = null
  pendingDisplayLat = null
  pendingDisplayLng = null
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
  applyToOpenUIs(lastAppliedRes, lastAppliedLat, lastAppliedLng)
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
  if (dt < 0.15) return lastSpeed
  const speed = Math.min(d / dt, 80)
  lastSpeed = speed
  return speed
}

function normalizeKortformKey(kf) {
  return String(kf ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
}

function normRoadLine(s) {
  return String(s ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

/**
 * Ikke bland inn gatenavn fra et annet vegsystem (parallelle veier / feil segment).
 */
function posisjonEnrichSameVegsystemAsPosisjon(res, segRes) {
  if (!res || !segRes) return false
  const rk = normalizeKortformKey(
    /** @type {{ kortform?: unknown }} */ (res).kortform,
  )
  const sk = normalizeKortformKey(
    /** @type {{ kortform?: unknown }} */ (segRes).kortform,
  )
  if (rk && sk && rk === sk) return true
  const rl = normRoadLine(
    /** @type {{ roadLine?: unknown }} */ (res).roadLine,
  )
  const sl = normRoadLine(
    /** @type {{ roadLine?: unknown }} */ (segRes).roadLine,
  )
  if (rl && sl && rl === sl) return true
  const rsh = normRoadLine(
    /** @type {{ roadLineShort?: unknown }} */ (res).roadLineShort,
  )
  const ssh = normRoadLine(
    /** @type {{ roadLineShort?: unknown }} */ (segRes).roadLineShort,
  )
  if (rsh && ssh && rsh === ssh) return true
  /* Oppstart / parallelle API-kall: kortform og veilinje kan mangle den ene runden — S/D
   * er like stabile identifikatorer og tillater merge som ellers gir mergedOk=false. */
  const rs = String(/** @type {{ s?: unknown }} */ (res).s ?? '').trim()
  const rd = String(/** @type {{ d?: unknown }} */ (res).d ?? '').trim()
  const ss = String(/** @type {{ s?: unknown }} */ (segRes).s ?? '').trim()
  const sd = String(/** @type {{ d?: unknown }} */ (segRes).d ?? '').trim()
  if (rs && rd && ss && sd && rs === ss && rd === sd) return true
  return false
}

function isDashMeter(m) {
  const t = String(m ?? '').trim()
  return t === '' || t === '–' || t === '-'
}

/**
 * @param {object} res
 * @param {object} segRes
 */
function mergePosisjonWithSegmentDisplay(res, segRes) {
  return {
    ...res,
    roadLineDisplay: segRes.roadLineDisplay,
    roadLineDisplayShort:
      segRes.roadLineDisplayShort ||
      segRes.roadLineShort ||
      segRes.roadLineDisplay,
    roadLine: segRes.roadLine || res.roadLine,
    roadLineShort: segRes.roadLineShort || res.roadLineShort,
    m: isDashMeter(res.m) && !isDashMeter(segRes.m) ? segRes.m : res.m,
    s: isDashMeter(res.s) && !isDashMeter(segRes.s) ? segRes.s : res.s,
    d: isDashMeter(res.d) && !isDashMeter(segRes.d) ? segRes.d : res.d,
    /* Bruk segment-id videre, så pickBestSegment kan holde oss på samme vei. */
    nvdbId: segRes.nvdbId ?? res.nvdbId,
  }
}

/**
 * Segment-oppslag bruker stabile segment-id/kortform, mens posisjon-API lager egne `vls:`/`vs:`-nøkler.
 * Når vi har en segment-lås, bør videre oppslag prioritere segmentert resolver.
 * @param {string | number | null | undefined} nvdbId
 */
function isSegmentStableNvdbId(nvdbId) {
  if (nvdbId == null) return false
  const id = String(nvdbId).trim()
  if (!id) return false
  return !/^v(?:ls|s):/i.test(id)
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
  segmentConfidence = 0
  lastNvdbSegmentApplyAt = 0
  lastConfidenceDecayAt = 0
  smoothHeading = null
  lastSpeed = 0
  lastPosForSpeed = null
  posisjonPendingNewNvdbId = null
  posisjonPendingFirstSeenAt = 0
  lastAcceptedRoadSwitchAt = 0
  lastAcceptedRoadSwitchFromId = null
  lastAcceptedRoadSwitchToId = null
  lastTraceSamples = []
  posisjonCache = new Map()
  clearSegmentNearCache()
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

  const onlineFlag =
    typeof navigator === 'undefined' || navigator.onLine !== false
  vegrefDebugTrace('gps_in', {
    lat: Math.round(lat * 1e5) / 1e5,
    lng: Math.round(lng * 1e5) / 1e5,
    accuracyM: Math.round(accuracyM * 10) / 10,
    speedMps: Math.round(speedMps * 100) / 100,
    online: onlineFlag,
    forceImmediate: Boolean(forceImmediate),
  })
  const gpsLat = lat
  const gpsLng = lng
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

  /* NVDB må bruke samme punkt som GPS (kart/markør). Glatting her ga systematisk avvik under kjøring. */
  const nvdbLat = gpsLat
  const nvdbLng = gpsLng

  lastTraceSamples = [
    ...lastTraceSamples,
    { lat: nvdbLat, lng: nvdbLng, at: Date.now() },
  ].slice(-10)

  if (nvdbAbort && inFlightAnchorLat != null && inFlightAnchorLng != null) {
    const movedInflight = h.haversineM(
      inFlightAnchorLat,
      inFlightAnchorLng,
      nvdbLat,
      nvdbLng,
    )
    let coalesceRadius = Math.max(
      VEGREF_INFLIGHT_COALESCE_BASE_M,
      accuracyM * 0.42,
    )
    if (lastSpeed > 28) coalesceRadius *= 0.45
    else if (lastSpeed > 18) coalesceRadius *= 0.65
    else if (lastSpeed < 3 && lastSpeed >= 0.4)
      /* Gange: kort strekning mens NVDB svarer — ikke krev ~6 m før ny tick tas inn.
         Ikke bruk ved veldig lav fart (stillestående / støy) — unngå ekstra NVDB-spam. */
      coalesceRadius *= 0.62
    if (posisjonPendingNewNvdbId != null) coalesceRadius *= 0.55
    /* Med ferdig offline-pakke er pipelinen rask (IndexedDB): ikke stå og
       vente på inflight med stor «luft» — da henger meteren sekunder bak. */
    if (
      typeof h.skipNetworkWhenOfflineReady === 'function' &&
      h.skipNetworkWhenOfflineReady(nvdbLat, nvdbLng)
    ) {
      coalesceRadius *= 0.52
    }
    if (!forceImmediate && movedInflight < coalesceRadius) {
      // #region agent log H4
      vegrefDebugTrace('coalesce_skip', {
        hyp: 'H4',
        movedInflight: Math.round(movedInflight * 10) / 10,
        coalesceRadius: Math.round(coalesceRadius * 10) / 10,
        accuracyM: Math.round(accuracyM * 10) / 10,
        speed: Math.round(lastSpeed * 100) / 100,
        pendingId: posisjonPendingNewNvdbId != null ? String(posisjonPendingNewNvdbId) : null,
      })
      // #endregion
      return
    }
  }

  const now = Date.now()
  const moved =
    lastFetchLat == null
      ? Infinity
      : h.haversineM(lastFetchLat, lastFetchLng, nvdbLat, nvdbLng)
  let minInterval =
    accuracyM > 48
      ? VEGREF_MIN_INTERVAL_MS + 260
      : accuracyM > 36
        ? VEGREF_MIN_INTERVAL_MS + 140
        : VEGREF_MIN_INTERVAL_MS
  let minMove =
    accuracyM > 48 ? 5.5 : accuracyM > 36 ? 4 : VEGREF_MIN_MOVE_M
  if (lastSpeed > 32) {
    minInterval = Math.max(120, minInterval - 180)
    minMove = Math.max(0.4, minMove - 3)
  } else if (lastSpeed > 22) {
    minInterval = Math.max(150, minInterval - 140)
    minMove = Math.max(0.5, minMove - 2)
  } else if (lastSpeed < 3 && accuracyM <= 28) {
    /* Gåing: kortere intervall og mindre min-move ved god GPS. */
    const floorMs = accuracyM <= 22 ? 180 : 210
    minInterval = Math.max(floorMs, minInterval - 42)
    minMove = Math.max(accuracyM <= 22 ? 0.6 : 0.75, minMove - 0.32)
  }
  if (posisjonPendingNewNvdbId != null) {
    minInterval = Math.max(160, minInterval * 0.58)
    minMove = Math.max(0.4, minMove * 0.55)
  }
  /* Minimal-modus bruker allerede sekvensiell NVDB (én kjede om gangen) —
     ekstra ×2 på intervall/move ga trege meter-tikk uten stor databesparelse. */
  const inCoordFallbackUi = isCoordFallbackDisplay(lastAppliedRes)
  /** Når vi viser koordinat-fallback: tillat oftere nytt NVDB-forsøk (samme logikk ellers). */
  const recoverMs = 280
  const recoverMoveM = 1.2
  const throttled =
    !forceImmediate &&
    (inCoordFallbackUi
      ? now - lastFetchMs < recoverMs && moved < recoverMoveM
      : now - lastFetchMs < minInterval && moved < minMove)
  if (throttled) {
    // #region agent log H4
    vegrefDebugTrace('throttle_skip', {
      hyp: 'H4',
      sinceLastMs: now - lastFetchMs,
      moved: Math.round(moved * 10) / 10,
      minInterval,
      minMove: Math.round(minMove * 10) / 10,
      accuracyM: Math.round(accuracyM * 10) / 10,
      speed: Math.round(lastSpeed * 100) / 100,
      inCoordFallbackUi,
    })
    // #endregion
    return
  }

  lastFetchMs = now
  lastFetchLat = nvdbLat
  lastFetchLng = nvdbLng

  if (nvdbAbort) nvdbAbort.abort()
  nvdbAbort = new AbortController()
  const { signal } = nvdbAbort
  const seq = fetchGeneration + 1
  fetchGeneration = seq
  inFlightAnchorLat = nvdbLat
  inFlightAnchorLng = nvdbLng

  const online = typeof navigator === 'undefined' || navigator.onLine !== false
  // #region agent log (debug ff8b7b)
  const __vg0 = performance.now()
  // #endregion

  if (!online && !h.fetchRoadReferenceNearOffline) {
    inFlightAnchorLat = null
    inFlightAnchorLng = null
    const off = offlineOrFallbackResult(nvdbLat, nvdbLng)
    applyToOpenUIs(off, nvdbLat, nvdbLng)
    return
  }

  // #region agent log (debug ff8b7b)
  {
    const syncMs = performance.now() - __vg0
    if (syncMs > 48) {
      const _pl = JSON.stringify({
        sessionId: 'ff8b7b',
        hypothesisId: 'H4',
        location: 'vegrefLive.js:vegrefNotifyGps',
        message: 'slow_sync_before_async',
        data: {
          syncMs: Math.round(syncMs * 10) / 10,
          forceImmediate: Boolean(opts.forceImmediate),
        },
        timestamp: Date.now(),
      })
      postScanixDebugIngest(_pl)
    }
  }
  // #endregion

  void (async () => {
    const surfacePreference =
      typeof h.getSurfacePreference === 'function'
        ? normalizeSurfacePreference(h.getSurfacePreference())
        : 'motor'
    const fetchOpts = { signal, accuracyM, surfacePreference }
    const currentShownId =
      lastAppliedRes && typeof lastAppliedRes === 'object' && 'nvdbId' in lastAppliedRes
        ? /** @type {{ nvdbId?: string | number | null }} */ (lastAppliedRes).nvdbId
        : null
    const stablePrevNvdbId = isSegmentStableNvdbId(currentShownId)
      ? currentShownId
      : null
    const traceSamples = getTraceSamplesForFetch(h)
    const segmentFetchOpts = {
      ...fetchOpts,
      prevNvdbId: stablePrevNvdbId,
      userHeadingDeg: effHeadingDeg,
      speed: speedMps,
      traceSamples,
    }
    let res = null
    try {
      /* ---- LOKAL FØRST: alltid prøv nedlastet/prefetched data ---- */
      if (h.fetchRoadReferenceNearOffline) {
        try {
          res = await h.fetchRoadReferenceNearOffline(nvdbLat, nvdbLng, {
            ...fetchOpts,
            prevNvdbId: stablePrevNvdbId,
            userHeadingDeg: effHeadingDeg,
            speed: speedMps,
            traceSamples,
          })
        } catch {
          /* IndexedDB utilgjengelig */
        }
      }

      if (res) {
        /* Offline-treff = autoritativt. Ingen nett-promote, ingen
           safety-net, ingen «kanskje overskriv om nett kommer med noe
           bedre». Det er nettopp dette som skiller den nye pipelinen
           fra ekte offline-modus, og det var årsaken til at meteren
           flakket selv om dataene var forhåndsnedlastet. */
        if (signal.aborted || seq !== fetchGeneration) return
        const offDistInitial =
          typeof res.distToRoadM === 'number' && Number.isFinite(res.distToRoadM)
            ? res.distToRoadM
            : null
        cacheLat = nvdbLat
        cacheLng = nvdbLng
        cacheRes = res
        vegrefDebugTrace('pipeline_res', {
          hasRes: true,
          source: 'offline-first',
          nvdbId: res?.nvdbId != null ? String(res.nvdbId) : null,
          m: res?.m != null ? String(res.m) : null,
          distToRoadM:
            offDistInitial != null ? Math.round(offDistInitial * 10) / 10 : null,
          road: String(res?.roadLineShort || res?.roadLine || '').slice(0, 140),
        })
        const applyCtx = { accuracyM, speedMps, online }
        applyNvdbNullable(res, nvdbLat, nvdbLng, applyCtx)
        return
      }

      if (
        typeof h.skipNetworkWhenOfflineReady === 'function' &&
        h.skipNetworkWhenOfflineReady(nvdbLat, nvdbLng)
      ) {
        if (signal.aborted || seq !== fetchGeneration) return
        const off = offlineOrFallbackResult(nvdbLat, nvdbLng)
        vegrefDebugTrace('pipeline_res', {
          hasRes: Boolean(off),
          source: 'offline-null-skip-net',
          nvdbId: off?.nvdbId != null ? String(off.nvdbId) : null,
          m: off?.m != null ? String(off.m) : null,
          distToRoadM:
            typeof off?.distToRoadM === 'number' && Number.isFinite(off.distToRoadM)
              ? Math.round(off.distToRoadM * 10) / 10
              : null,
          road: String(off?.roadLineShort || off?.roadLine || '').slice(0, 140),
        })
        const applyCtx = { accuracyM, speedMps, online }
        applyNvdbNullable(off, nvdbLat, nvdbLng, applyCtx)
        return
      }

      if (
        typeof h.shouldPreferOfflineResolver === 'function' &&
        h.shouldPreferOfflineResolver()
      ) {
        if (signal.aborted || seq !== fetchGeneration) return
        const off = offlineOrFallbackResult(nvdbLat, nvdbLng)
        vegrefDebugTrace('pipeline_res', {
          hasRes: Boolean(off),
          source: 'offline-only-policy',
          nvdbId: off?.nvdbId != null ? String(off.nvdbId) : null,
          m: off?.m != null ? String(off.m) : null,
          distToRoadM:
            typeof off?.distToRoadM === 'number' && Number.isFinite(off.distToRoadM)
              ? Math.round(off.distToRoadM * 10) / 10
              : null,
          road: String(off?.roadLineShort || off?.roadLine || '').slice(0, 140),
        })
        const applyCtx = { accuracyM, speedMps, online }
        applyNvdbNullable(off, nvdbLat, nvdbLng, applyCtx)
        return
      }

      /* ---- NETT-FALLBACK: lokal data mangler for dette punktet ---- */
      h.beforeNvdbFetch?.()

      const dataMode =
        typeof h.getVegrefDataMode === 'function' ? h.getVegrefDataMode() : 'minimal'
      const dataMinimal = dataMode !== 'normal'

      if (online && h.fetchRoadReferenceNear) {
        if (
          dataMinimal &&
          h.fetchRoadPositionDirect &&
          h.fetchRoadReferenceNear
        ) {
          const _t0 = Date.now()
          let segMs = -1
          let posMs = -1
          try {
            const tSeg = Date.now()
            res = await h.fetchRoadReferenceNear(
              nvdbLat,
              nvdbLng,
              segmentFetchOpts,
            )
            segMs = Date.now() - tSeg
          } catch {
            res = null
          }
          if (!res) {
            try {
              const tPos = Date.now()
              res = await fetchRoadPositionDirectCached(
                h,
                nvdbLat,
                nvdbLng,
                fetchOpts,
              )
              posMs = Date.now() - tPos
            } catch (e) {
              if (/** @type {{ name?: string }} */ (e).name === 'AbortError')
                throw e
            }
          }
          vegrefDebugTrace('fetch_split', {
            hyp: 'H5',
            mode: 'minimal-sequential',
            totalMs: Date.now() - _t0,
            posMs,
            segMs,
            posOk: posMs >= 0 && Boolean(res),
            segOk: posMs < 0 && Boolean(res),
            mergedOk: false,
            posSrc:
              res && /** @type {any} */ (res)._vegrefMeta?.source === 'posisjon'
                ? 'posisjon'
                : null,
            segHasMeter: Boolean(
              res &&
                /** @type {any} */ (res).m != null &&
                !isDashMeter(/** @type {any} */ (res).m),
            ),
            segDist:
              res && typeof /** @type {any} */ (res).distToRoadM === 'number'
                ? Math.round(/** @type {any} */ (res).distToRoadM * 10) / 10
                : null,
            accuracyM: Math.round(accuracyM * 10) / 10,
            speed: Math.round(speedMps * 100) / 100,
          })
        } else if (
          online &&
          h.fetchRoadPositionDirect &&
          h.fetchRoadReferenceNear
        ) {
          const _t0 = Date.now()
          let _posMs = -1
          let _segMs = -1
          const [pos, seg] = await Promise.all([
            fetchRoadPositionDirectCached(h, nvdbLat, nvdbLng, fetchOpts)
              .then((r) => {
                _posMs = Date.now() - _t0
                return r
              })
              .catch(() => {
                _posMs = Date.now() - _t0
                return null
              }),
            h.fetchRoadReferenceNear(nvdbLat, nvdbLng, segmentFetchOpts)
              .then((r) => {
                _segMs = Date.now() - _t0
                return r
              })
              .catch(() => {
                _segMs = Date.now() - _t0
                return null
              }),
          ])
          const merged = mergePosisjonAndSegmentParallelResults(pos, seg)
          res = merged || pos || seg
          vegrefDebugTrace('fetch_split', {
            hyp: 'H5',
            mode: 'parallel',
            totalMs: Date.now() - _t0,
            posMs: _posMs,
            segMs: _segMs,
            posOk: Boolean(pos),
            segOk: Boolean(seg),
            mergedOk: Boolean(merged),
            posSrc: pos && /** @type {any} */ (pos)._vegrefMeta?.source
              ? String(/** @type {any} */ (pos)._vegrefMeta.source)
              : null,
            segHasMeter: Boolean(
              seg &&
                /** @type {any} */ (seg).m != null &&
                !isDashMeter(/** @type {any} */ (seg).m),
            ),
            segDist:
              seg && typeof /** @type {any} */ (seg).distToRoadM === 'number'
                ? Math.round(/** @type {any} */ (seg).distToRoadM * 10) / 10
                : null,
            accuracyM: Math.round(accuracyM * 10) / 10,
            speed: Math.round(speedMps * 100) / 100,
          })
        } else {
          try {
            res = await h.fetchRoadReferenceNear(
              nvdbLat,
              nvdbLng,
              segmentFetchOpts,
            )
          } catch {
            res = null
          }
        }
      }

      if (!res && online && h.fetchRoadPositionDirect && !dataMinimal) {
        try {
          res = await fetchRoadPositionDirectCached(
            h,
            nvdbLat,
            nvdbLng,
            fetchOpts,
          )
        } catch (e) {
          if (/** @type {{ name?: string }} */ (e).name === 'AbortError') throw e
        }
      }

      if (
        res &&
        online &&
        h.fetchRoadReferenceNear &&
        res._vegrefMeta?.source === 'posisjon' &&
        isDashMeter(/** @type {{ m?: unknown }} */ (res).m)
      ) {
        try {
          const prevIdFill =
            res && typeof res === 'object' && 'nvdbId' in res
              ? /** @type {{ nvdbId?: string | number | null }} */ (res).nvdbId
              : null
          const segFill = await h.fetchRoadReferenceNear(nvdbLat, nvdbLng, {
            ...fetchOpts,
            prevNvdbId: prevIdFill ?? null,
            userHeadingDeg: effHeadingDeg,
            speed: speedMps,
            traceSamples,
          })
          if (
            segFill &&
            posisjonEnrichSameVegsystemAsPosisjon(res, segFill) &&
            !isDashMeter(segFill.m)
          ) {
            res = {
              ...res,
              m: segFill.m,
              s: isDashMeter(res.s) && !isDashMeter(segFill.s) ? segFill.s : res.s,
              d: isDashMeter(res.d) && !isDashMeter(segFill.d) ? segFill.d : res.d,
              nvdbId: segFill.nvdbId ?? res.nvdbId,
            }
          }
        } catch {
          /* behold posisjon uten meter */
        }
      }

      if (!res && online && h.fetchRoadReferenceNear && !dataMinimal) {
        res = await h.fetchRoadReferenceNear(nvdbLat, nvdbLng, segmentFetchOpts)
      }

      if (signal.aborted) return
      if (seq !== fetchGeneration) return
      if (res) {
        cacheLat = nvdbLat
        cacheLng = nvdbLng
        cacheRes = res
      }
      if (seq !== fetchGeneration) return
      vegrefDebugTrace('pipeline_res', {
        hasRes: Boolean(res),
        source:
          res && typeof res === 'object' && '_vegrefMeta' in res
            ? String(
                /** @type {{ _vegrefMeta?: { source?: string } }} */ (res)
                  ._vegrefMeta?.source || '',
              )
            : '',
        nvdbId: res?.nvdbId != null ? String(res.nvdbId) : null,
        m: res?.m != null ? String(res.m) : null,
        distToRoadM:
          typeof res?.distToRoadM === 'number' && Number.isFinite(res.distToRoadM)
            ? Math.round(res.distToRoadM * 10) / 10
            : null,
        road: String(res?.roadLineShort || res?.roadLine || '').slice(0, 140),
      })
      const applyCtx = { accuracyM, speedMps, online }
      applyNvdbNullable(res, nvdbLat, nvdbLng, applyCtx)
    } catch (e) {
      if (/** @type {{ name?: string }} */ (e).name === 'AbortError') return
      vegrefDebugTrace('pipeline_err', {
        name:
          e && typeof e === 'object' && 'name' in e
            ? String(/** @type {{ name?: unknown }} */ (e).name)
            : '',
        message:
          e instanceof Error
            ? e.message.slice(0, 400)
            : String(e).slice(0, 400),
      })
      if (seq !== fetchGeneration) return
      /** @type {VegrefDescribeResult | null} */
      let errRes = null
      if (h.fetchRoadReferenceNearOffline) {
        try {
          errRes = await h.fetchRoadReferenceNearOffline(
            nvdbLat,
            nvdbLng,
            segmentFetchOpts,
          )
        } catch {
          /* manglende pakke eller IndexedDB */
        }
      }
      if (seq !== fetchGeneration) return
      if (errRes) {
        cacheLat = nvdbLat
        cacheLng = nvdbLng
        cacheRes = errRes
      }
      const off = errRes || offlineOrFallbackResult(nvdbLat, nvdbLng)
      if (seq !== fetchGeneration) return
      applyToOpenUIs(off, nvdbLat, nvdbLng)
    } finally {
      if (seq === fetchGeneration) {
        inFlightAnchorLat = null
        inFlightAnchorLng = null
      }
    }
  })()
}
