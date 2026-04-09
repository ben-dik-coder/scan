import {
  resolveRoadReferenceFromSegments,
  segmentStableId,
} from './nvdbVegref.js'

const OFFLINE_DB_NAME = 'scanix-vegref-offline-v1'
const OFFLINE_DB_VERSION = 2
const OFFLINE_STORE_SEGMENTS = 'segments'
const OFFLINE_STORE_META = 'meta'
const OFFLINE_META_KEY = 'offline-package'

/** Maks antall segmentrader i IndexedDB; eldste (storedAt) slettes ved overskudd. */
export const MAX_OFFLINE_SEGMENTS = 28000

/**
 * @typedef {{
 *   id: string
 *   bbox: [number, number, number, number]
 *   segment: object
 *   storedAt?: number
 * }} OfflineSegmentRow
 */

let offlineDbPromise = null

function openOfflineDb() {
  if (offlineDbPromise) return offlineDbPromise
  offlineDbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(OFFLINE_DB_NAME, OFFLINE_DB_VERSION)
    req.onupgradeneeded = (event) => {
      const db = event.target.result
      const oldV = event.oldVersion
      if (!db.objectStoreNames.contains(OFFLINE_STORE_SEGMENTS)) {
        db.createObjectStore(OFFLINE_STORE_SEGMENTS, { keyPath: 'id' })
      }
      if (!db.objectStoreNames.contains(OFFLINE_STORE_META)) {
        db.createObjectStore(OFFLINE_STORE_META)
      }
      if (oldV < 2) {
        const tx = event.target.transaction
        const store = tx.objectStore(OFFLINE_STORE_SEGMENTS)
        const cur = store.openCursor()
        cur.onsuccess = () => {
          const cursor = cur.result
          if (cursor) {
            const v = cursor.value
            if (v && typeof v === 'object' && v.storedAt == null) {
              v.storedAt = Date.now()
              cursor.update(v)
            }
            cursor.continue()
          }
        }
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Kunne ikke åpne offline DB'))
  })
  return offlineDbPromise
}

function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error || new Error('IndexedDB transaction failed'))
    tx.onabort = () => reject(tx.error || new Error('IndexedDB transaction aborted'))
  })
}

function bboxForSegment(seg) {
  const wkt = seg?.geometri?.wkt
  if (typeof wkt !== 'string') return null
  const m =
    wkt.match(/LINESTRING\s+Z\s*\(([^)]+)\)/i) ||
    wkt.match(/LINESTRING\s*\(([^)]+)\)/i)
  if (!m) return null
  let minLat = Infinity
  let minLng = Infinity
  let maxLat = -Infinity
  let maxLng = -Infinity
  for (const part of m[1].split(',')) {
    const nums = part.trim().split(/\s+/).map(Number)
    if (nums.length < 2 || Number.isNaN(nums[0]) || Number.isNaN(nums[1])) continue
    const lat = nums[0]
    const lng = nums[1]
    if (lat < minLat) minLat = lat
    if (lng < minLng) minLng = lng
    if (lat > maxLat) maxLat = lat
    if (lng > maxLng) maxLng = lng
  }
  if (
    !Number.isFinite(minLat) ||
    !Number.isFinite(minLng) ||
    !Number.isFinite(maxLat) ||
    !Number.isFinite(maxLng)
  ) {
    return null
  }
  return [minLat, minLng, maxLat, maxLng]
}

function segmentsStoreName() {
  return OFFLINE_STORE_SEGMENTS
}

function metaStoreName() {
  return OFFLINE_STORE_META
}

function intersectsBbox(a, b) {
  return !(a[2] < b[0] || a[0] > b[2] || a[3] < b[1] || a[1] > b[3])
}

/**
 * @param {IDBDatabase} db
 */
async function finalizeOfflineMetaCount(db) {
  const meta = await getOfflineVegrefMeta()
  const tx = db.transaction(segmentsStoreName(), 'readonly')
  const req = tx.objectStore(segmentsStoreName()).count()
  const n = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Kunne ikke telle offline segmenter'))
  })
  await txDone(tx)
  const tx2 = db.transaction(metaStoreName(), 'readwrite')
  tx2.objectStore(metaStoreName()).put(
    {
      ...(meta && typeof meta === 'object' ? meta : {}),
      count: n,
    },
    OFFLINE_META_KEY,
  )
  await txDone(tx2)
}

/**
 * @param {IDBDatabase} db
 */
async function enforceOfflineSegmentQuota(db) {
  const meta = await getOfflineVegrefMeta()
  const tx = db.transaction(segmentsStoreName(), 'readonly')
  const req = tx.objectStore(segmentsStoreName()).getAll()
  const rows = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : [])
    req.onerror = () => reject(req.error || new Error('Kunne ikke lese offline segmenter'))
  })
  await txDone(tx)
  if (rows.length <= MAX_OFFLINE_SEGMENTS) return
  const sorted = [...rows].sort((a, b) => {
    const ta = typeof a.storedAt === 'number' ? a.storedAt : 0
    const tb = typeof b.storedAt === 'number' ? b.storedAt : 0
    if (ta !== tb) return ta - tb
    return String(a.id).localeCompare(String(b.id))
  })
  const excess = rows.length - MAX_OFFLINE_SEGMENTS
  const toDelete = sorted.slice(0, excess).map((r) => r.id)
  const tx2 = db.transaction([segmentsStoreName(), metaStoreName()], 'readwrite')
  const segStore = tx2.objectStore(segmentsStoreName())
  for (const id of toDelete) segStore.delete(id)
  tx2.objectStore(metaStoreName()).put(
    {
      ...(meta && typeof meta === 'object' ? meta : {}),
      count: rows.length - excess,
      quotaTrimmedAt: new Date().toISOString(),
    },
    OFFLINE_META_KEY,
  )
  await txDone(tx2)
}

export async function clearOfflineVegrefPackage() {
  const db = await openOfflineDb()
  const tx = db.transaction([segmentsStoreName(), metaStoreName()], 'readwrite')
  tx.objectStore(segmentsStoreName()).clear()
  tx.objectStore(metaStoreName()).delete(OFFLINE_META_KEY)
  await txDone(tx)
}

export async function importOfflineVegrefPackage(pkg) {
  const segments = Array.isArray(pkg?.segments) ? pkg.segments : []
  const version =
    typeof pkg?.version === 'string' && pkg.version.trim()
      ? pkg.version.trim()
      : 'unknown'
  const generatedAt =
    typeof pkg?.generatedAt === 'string' ? pkg.generatedAt : null
  const db = await openOfflineDb()
  const clearTx = db.transaction([segmentsStoreName(), metaStoreName()], 'readwrite')
  clearTx.objectStore(segmentsStoreName()).clear()
  clearTx.objectStore(metaStoreName()).delete(OFFLINE_META_KEY)
  await txDone(clearTx)

  const baseTs = Date.now()
  const tx = db.transaction([segmentsStoreName(), metaStoreName()], 'readwrite')
  const segStore = tx.objectStore(segmentsStoreName())
  let i = 0
  for (const seg of segments) {
    const idBase = segmentStableId(seg)
    const id =
      idBase != null ? String(idBase) : `${Math.random().toString(36).slice(2)}`
    const bbox = bboxForSegment(seg)
    if (!bbox) continue
    /** @type {OfflineSegmentRow} */
    const row = { id, bbox, segment: seg, storedAt: baseTs + i }
    i += 1
    segStore.put(row)
  }
  tx.objectStore(metaStoreName()).put(
    {
      version,
      generatedAt,
      count: i,
      importedAt: new Date().toISOString(),
    },
    OFFLINE_META_KEY,
  )
  await txDone(tx)
  await enforceOfflineSegmentQuota(db)
  await finalizeOfflineMetaCount(db)
}

export async function getOfflineVegrefMeta() {
  const db = await openOfflineDb()
  const tx = db.transaction(metaStoreName(), 'readonly')
  const req = tx.objectStore(metaStoreName()).get(OFFLINE_META_KEY)
  const value = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result || null)
    req.onerror = () => reject(req.error || new Error('Kunne ikke lese offline meta'))
  })
  await txDone(tx)
  return value
}

export async function hasOfflineVegrefPackage() {
  return Boolean(await getOfflineVegrefMeta())
}

export async function queryOfflineVegrefSegments(lat, lng, accuracyM = 28) {
  const db = await openOfflineDb()
  const tx = db.transaction(segmentsStoreName(), 'readonly')
  const req = tx.objectStore(segmentsStoreName()).getAll()
  /** @type {OfflineSegmentRow[]} */
  const rows = await new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(Array.isArray(req.result) ? req.result : [])
    req.onerror = () => reject(req.error || new Error('Kunne ikke lese offline segmenter'))
  })
  await txDone(tx)

  const padLat = Math.max(0.002, Math.min(0.02, accuracyM / 111000 + 0.001))
  const cos = Math.cos((lat * Math.PI) / 180) || 1
  const padLng = padLat / cos
  const queryBbox = [lat - padLat, lng - padLng, lat + padLat, lng + padLng]
  const matches = rows
    .filter((row) => Array.isArray(row.bbox) && intersectsBbox(row.bbox, queryBbox))
    .map((row) => row.segment)
  return matches.slice(0, 120)
}

export async function resolveOfflineRoadReferenceNear(lat, lng, opts = {}) {
  const segments = await queryOfflineVegrefSegments(lat, lng, opts.accuracyM)
  const res = resolveRoadReferenceFromSegments(segments, lat, lng, opts)
  if (res && typeof res === 'object') {
    const meta =
      res._vegrefMeta && typeof res._vegrefMeta === 'object' ? res._vegrefMeta : {}
    res._vegrefMeta = { ...meta, source: 'offline' }
  }
  return res
}

/**
 * Legg til / oppdater segmenter fra NVDB uten å tømme eksisterende offline-pakke.
 * Brukes for inkrementell lagring mens brukeren kjører (samme nettverkskall som vegreferanse).
 * @param {object[]} segments
 */
export async function mergeNvdbSegmentsIntoOfflineDb(segments) {
  if (!Array.isArray(segments) || segments.length === 0) return

  const db = await openOfflineDb()
  const existingRows = await new Promise((resolve, reject) => {
    const tx = db.transaction(segmentsStoreName(), 'readonly')
    const req = tx.objectStore(segmentsStoreName()).getAll()
    req.onsuccess = () => resolve(req.result || [])
    req.onerror = () => reject(req.error || new Error('Kunne ikke lese offline segmenter'))
  })
  const existingIds = new Set(
    existingRows.map((/** @type {{ id?: string }} */ r) => r.id).filter(Boolean),
  )

  let added = 0
  /** @type {OfflineSegmentRow[]} */
  const rows = []
  for (const seg of segments) {
    const idBase = segmentStableId(seg)
    if (idBase == null) continue
    const id = String(idBase)
    const bbox = bboxForSegment(seg)
    if (!bbox) continue
    if (!existingIds.has(id)) {
      existingIds.add(id)
      added += 1
    }
    rows.push({ id, bbox, segment: seg })
  }
  if (!rows.length) return

  const prevMeta = await getOfflineVegrefMeta()
  const prevCount = typeof prevMeta?.count === 'number' ? prevMeta.count : 0

  const touchTs = Date.now()
  const tx = db.transaction([segmentsStoreName(), metaStoreName()], 'readwrite')
  const segStore = tx.objectStore(segmentsStoreName())
  rows.forEach((row, idx) => {
    segStore.put({ ...row, storedAt: touchTs + idx })
  })
  tx.objectStore(metaStoreName()).put(
    {
      version:
        typeof prevMeta?.version === 'string' && prevMeta.version.trim()
          ? prevMeta.version
          : 'live-build',
      generatedAt:
        typeof prevMeta?.generatedAt === 'string'
          ? prevMeta.generatedAt
          : new Date().toISOString(),
      count: prevCount + added,
      lastLiveMergeAt: new Date().toISOString(),
      liveMerge: true,
    },
    OFFLINE_META_KEY,
  )
  await txDone(tx)
  await enforceOfflineSegmentQuota(db)
  await finalizeOfflineMetaCount(db)
}
