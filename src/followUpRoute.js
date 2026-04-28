/**
 * Oppfølgingsrute: lokale ruter med punkter fra NVDB vegsystemreferanse (veg + S/D + meter).
 * Standardlagring er localStorage. Synk til Supabase (delsky) skjer bare når brukeren eksplisitt ber om det.
 */

import { fetchLatLngFromVegsystemBatch } from './nvdbVegref.js'

export const FOLLOWUP_ROUTES_VERSION = 1
export const FOLLOWUP_ROUTES_STORAGE_PREFIX = 'scanix-followup-routes-v'
export const FOLLOWUP_ROAD_SUGGEST_KEY_PREFIX = 'scanix-followup-road-suggest-v'

/**
 * @typedef {{ id: string, title: string, createdAt: string, updatedAt: string, markers: FollowUpMarker[] }} FollowUpRoute
 * @typedef {{
 *   id: string,
 *   roadDisplay: string,
 *   s: number,
 *   d: number,
 *   meter: number,
 *   lat: number,
 *   lng: number,
 *   batchRef: string,
 *   kortform?: string,
 * }} FollowUpMarker
 */

/**
 * @param {string} userId
 */
export function followUpRoutesStorageKey(userId) {
  return `${FOLLOWUP_ROUTES_STORAGE_PREFIX}${FOLLOWUP_ROUTES_VERSION}-user-${userId}`
}

/**
 * @param {string} userId
 */
export function followUpRoadSuggestStorageKey(userId) {
  return `${FOLLOWUP_ROAD_SUGGEST_KEY_PREFIX}${FOLLOWUP_ROUTES_VERSION}-user-${userId}`
}

/**
 * @param {string} raw
 */
export function normalizeRoadToken(raw) {
  let t = String(raw || '')
    .trim()
    .replace(/\s+/g, '')
    .toUpperCase()
  if (!t) return ''
  if (/^E(\d+)$/.test(t)) t = `EV${RegExp.$1}`
  else if (/^R(\d+)$/.test(t)) t = `RV${RegExp.$1}`
  else if (/^F(\d+)$/.test(t)) t = `FV${RegExp.$1}`
  else if (/^K(\d+)$/.test(t)) t = `KV${RegExp.$1}`
  else if (/^P(\d+)$/.test(t)) t = `PV${RegExp.$1}`
  if (/^\d{2,5}$/.test(t)) t = `FV${t}`
  if (!/^(EV|RV|FV|KV|PV|SKV)\d+$/.test(t)) return ''
  return t
}

/**
 * @param {string} roadNorm
 * @param {number} meter
 * @param {number} s
 * @param {number} d
 */
export function buildVegsystemBatchRef(roadNorm, meter, s, d) {
  if (!roadNorm) return null
  const m = Math.round(Number(meter))
  const si = Math.max(1, Math.round(Number(s)) || 1)
  const di = Math.max(1, Math.round(Number(d)) || 1)
  if (!Number.isFinite(m) || m < 0) return null
  return `${roadNorm}S${si}D${di}m${m}`
}

/**
 * @param {string} userId
 * @returns {Record<string, number>}
 */
export function loadRoadSuggestCounts(userId) {
  try {
    const raw = localStorage.getItem(followUpRoadSuggestStorageKey(userId))
    if (!raw) return {}
    const o = JSON.parse(raw)
    if (!o || typeof o !== 'object') return {}
    /** @type {Record<string, number>} */
    const out = {}
    for (const k of Object.keys(o)) {
      const n = Number(o[k])
      if (k && Number.isFinite(n) && n > 0) out[k] = Math.min(999, Math.floor(n))
    }
    return out
  } catch {
    return {}
  }
}

/**
 * @param {string} userId
 * @param {string} roadNorm
 */
export function recordRoadSuggestion(userId, roadNorm) {
  const k = normalizeRoadToken(roadNorm)
  if (!k || !userId) return
  const counts = loadRoadSuggestCounts(userId)
  counts[k] = (counts[k] || 0) + 1
  try {
    localStorage.setItem(
      followUpRoadSuggestStorageKey(userId),
      JSON.stringify(counts),
    )
  } catch {
    /* quota */
  }
}

/**
 * @param {string} userId
 * @returns {string[]}
 */
export function getRoadSuggestionsForDatalist(userId) {
  const c = loadRoadSuggestCounts(userId)
  return Object.entries(c)
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'nb'))
    .map(([road]) => road)
    .slice(0, 24)
}

/**
 * @param {unknown} x
 * @returns {FollowUpMarker | null}
 */
function normalizeMarker(x) {
  if (!x || typeof x !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (x)
  const id = typeof o.id === 'string' ? o.id : crypto.randomUUID()
  const roadDisplay = typeof o.roadDisplay === 'string' ? o.roadDisplay : ''
  const s = Math.max(1, Math.round(Number(o.s)) || 1)
  const d = Math.max(1, Math.round(Number(o.d)) || 1)
  const meter = Math.round(Number(o.meter)) || 0
  const lat = Number(o.lat)
  const lng = Number(o.lng)
  const batchRef = typeof o.batchRef === 'string' ? o.batchRef : ''
  const kortform = typeof o.kortform === 'string' ? o.kortform : ''
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return {
    id,
    roadDisplay,
    s,
    d,
    meter,
    lat,
    lng,
    batchRef,
    kortform,
  }
}

/**
 * @param {unknown} x
 * @returns {FollowUpRoute | null}
 */
function normalizeRoute(x) {
  if (!x || typeof x !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (x)
  const id = typeof o.id === 'string' ? o.id : crypto.randomUUID()
  const title = typeof o.title === 'string' ? o.title.trim().slice(0, 120) : 'Uten navn'
  const createdAt =
    typeof o.createdAt === 'string' ? o.createdAt : new Date().toISOString()
  const updatedAt =
    typeof o.updatedAt === 'string' ? o.updatedAt : createdAt
  const rawM = Array.isArray(o.markers) ? o.markers : []
  const markers = rawM.map(normalizeMarker).filter(Boolean)
  return {
    id,
    title: title || 'Uten navn',
    createdAt,
    updatedAt,
    markers: /** @type {FollowUpMarker[]} */ (markers),
  }
}

/**
 * @param {unknown} input
 * @returns {FollowUpRoute[]}
 */
export function normalizeFollowUpRoutesList(input) {
  if (!Array.isArray(input)) return []
  return input.map(normalizeRoute).filter(Boolean)
}

/**
 * Flett lokale og fjern-ruter: ved samme id vinner nyeste `updatedAt`.
 * @param {FollowUpRoute[]} local
 * @param {FollowUpRoute[]} remote
 * @returns {FollowUpRoute[]}
 */
export function mergeFollowUpRoutesByUpdatedAt(local, remote) {
  const parseTs = (iso) => {
    const t = Date.parse(typeof iso === 'string' ? iso : '')
    return Number.isFinite(t) ? t : 0
  }
  const byId = new Map(
    (Array.isArray(local) ? local : []).map((r) => [r.id, r]),
  )
  for (const r of Array.isArray(remote) ? remote : []) {
    if (!r?.id) continue
    const prev = byId.get(r.id)
    if (!prev) {
      byId.set(r.id, r)
      continue
    }
    byId.set(
      r.id,
      parseTs(r.updatedAt) >= parseTs(prev.updatedAt) ? r : prev,
    )
  }
  return [...byId.values()].sort(
    (a, b) => parseTs(b.updatedAt) - parseTs(a.updatedAt),
  )
}

/**
 * @param {string} userId
 * @returns {FollowUpRoute[]}
 */
export function loadFollowUpRoutes(userId) {
  if (!userId) return []
  try {
    const raw = localStorage.getItem(followUpRoutesStorageKey(userId))
    if (!raw) return []
    const data = JSON.parse(raw)
    if (!data || typeof data !== 'object') return []
    const arr = Array.isArray(data.routes) ? data.routes : []
    return arr.map(normalizeRoute).filter(Boolean)
  } catch {
    return []
  }
}

/**
 * @param {string} userId
 * @param {FollowUpRoute[]} routes
 */
export function saveFollowUpRoutes(userId, routes) {
  if (!userId) return
  try {
    localStorage.setItem(
      followUpRoutesStorageKey(userId),
      JSON.stringify({
        version: FOLLOWUP_ROUTES_VERSION,
        routes,
      }),
    )
  } catch {
    /* quota */
  }
}

/**
 * @param {string} title
 * @returns {FollowUpRoute}
 */
export function createEmptyFollowUpRoute(title = '') {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    title: String(title || '').trim().slice(0, 120) || 'Ny oppfølgingsrute',
    createdAt: now,
    updatedAt: now,
    markers: [],
  }
}

/**
 * @param {string} roadInput
 * @param {number} meter
 * @param {number} s
 * @param {number} d
 * @param {{ signal?: AbortSignal }} [opts]
 * @returns {Promise<{ lat: number, lng: number, batchRef: string, kortform: string, roadDisplay: string } | null>}
 */
export async function resolveFollowUpPoint(roadInput, meter, s, d, opts = {}) {
  const roadNorm = normalizeRoadToken(roadInput)
  if (!roadNorm) return null
  const batchRef = buildVegsystemBatchRef(roadNorm, meter, s, d)
  if (!batchRef) return null
  const res = await fetchLatLngFromVegsystemBatch(batchRef, opts)
  if (!res) return null
  return {
    lat: res.lat,
    lng: res.lng,
    batchRef,
    kortform: res.kortform || '',
    roadDisplay: roadNorm,
  }
}

/**
 * @param {string} jsonText
 * @returns {FollowUpRoute[] | null}
 */
export function parseFollowUpRoutesImport(jsonText) {
  try {
    const data = JSON.parse(jsonText)
    if (!data || typeof data !== 'object') return null
    const arr = Array.isArray(data.routes) ? data.routes : Array.isArray(data) ? data : null
    if (!arr) return null
    const out = arr.map(normalizeRoute).filter(Boolean)
    return /** @type {FollowUpRoute[]} */ (out)
  } catch {
    return null
  }
}

/**
 * @param {FollowUpRoute[]} routes
 */
export function serializeFollowUpRoutesExport(routes) {
  return JSON.stringify(
    { version: FOLLOWUP_ROUTES_VERSION, exportedAt: new Date().toISOString(), routes },
    null,
    0,
  )
}
