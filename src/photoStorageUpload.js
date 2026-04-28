/**
 * Opplasting av fotobilder til Supabase Storage eller Scanix Cloud API (R2 presign) + kø (localStorage).
 * `user_app_state` saniteres før upsert slik at full `dataUrl` ikke sendes når `storageFullPath` finnes.
 */

import { isMinDownloadMode } from './buildFlags.js'
import { getSupabase } from './supabaseClient.js'
import { getPhotoDataUrl } from './photoBlobStore.js'
import {
  cloudPresignAndPutPhotoPair,
  isScanixCloudApiConfigured,
} from './scanixCloudApi.js'
import {
  getCachedNativeNetworkStatus,
  isCapacitorNativePlatform,
  refreshNativeNetworkStatus,
} from './nativeNetworkMetered.js'

export const PHOTO_STORAGE_BUCKET = 'scanix-user-photos'

const QUEUE_KEY = 'scanix-photo-upload-queue-v1'
const WIFI_ONLY_LS_KEY = 'scanix-photo-upload-wifi-only'

/** @returns {boolean} true når bruker har slått på «Tillat opplasting på mobilnett». */
export function readPhotoUploadAllowOnCellular() {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(WIFI_ONLY_LS_KEY) === '0'
  } catch {
    return false
  }
}

/**
 * @param {boolean} allow true = tillat opplasting på mobilnett (ikke utsett når connection er cellular).
 */
export function writePhotoUploadAllowOnCellular(allow) {
  try {
    if (typeof localStorage === 'undefined') return
    if (allow) localStorage.setItem(WIFI_ONLY_LS_KEY, '0')
    else localStorage.removeItem(WIFI_ONLY_LS_KEY)
  } catch {
    /* ignore */
  }
}

/** @typedef {{ photoId: string, attempts: number }} QueuedPhoto */

/** @type {((photoId: string, paths: { storageFullPath: string, storageThumbPath: string }) => void) | null} */
let onUploaded = null

/**
 * @param {(photoId: string, paths: { storageFullPath: string, storageThumbPath: string }) => void} fn
 */
export function setPhotoStorageUploadCallbacks(fn) {
  onUploaded = typeof fn === 'function' ? fn : null
}

export function shouldDeferPhotoUploadOnNetwork() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false)
    return true
  if (readPhotoUploadAllowOnCellular()) return false

  if (isCapacitorNativePlatform()) {
    const n = getCachedNativeNetworkStatus()
    if (n) {
      if (!n.connected) return true
      if (n.connectionType === 'wifi') return false
      return true
    }
    /** Native uten lest status ennå: utsett én runde (refresh kjøres fra kø/oppstart). */
    return true
  }

  const c =
    typeof navigator !== 'undefined' ? navigator.connection : null
  /**
   * Uten Network Information API (mange iOS Safari / WKWebView): ikke gjett «Wi‑Fi».
   * (I Capacitor-app brukes @capacitor/network i stedet, se over.)
   */
  if (!c || typeof c.type !== 'string') return true
  try {
    if (c.saveData === true) return true
  } catch {
    /* ignore */
  }
  return c.type !== 'wifi' && c.type !== 'ethernet'
}

/** @returns {number} antall bilder som venter i opplastingskøen */
export function getPhotoUploadQueueCount() {
  return readQueue().length
}

/** @returns {QueuedPhoto[]} */
function readQueue() {
  try {
    const s = localStorage.getItem(QUEUE_KEY)
    if (!s) return []
    const j = JSON.parse(s)
    if (!Array.isArray(j)) return []
    return j.filter(
      (x) => x && typeof x.photoId === 'string' && x.photoId.length > 0,
    )
  } catch {
    return []
  }
}

/** @param {QueuedPhoto[]} q */
function writeQueue(q) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
  } catch (e) {
    console.warn('photoStorageUpload queue persist', e)
  }
}

export function enqueuePhotoStorageUpload(photoId) {
  if (typeof photoId !== 'string' || !photoId) return
  const q = readQueue()
  if (q.some((x) => x.photoId === photoId)) return
  q.push({ photoId, attempts: 0 })
  writeQueue(q)
}

/**
 * Når bildekøen har poster men ikke lastes opp pga nett (offline eller utsett mobilnett).
 * @returns {{ reason: 'offline' | 'cellular', count: number } | null}
 */
export function getPhotoUploadQueueDeferralUi() {
  const count = readQueue().length
  if (count === 0) return null
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { reason: 'offline', count }
  }
  if (shouldDeferPhotoUploadOnNetwork()) {
    return { reason: 'cellular', count }
  }
  return null
}

/**
 * Når tung delsky-trafikk (hente/sende `user_app_state` m.m.) skal utsettes pga. mobilnett.
 *
 * **Native (Capacitor):** samme som bildekø — streng Wi‑Fi/mobil-sjekk.
 * **Vanlig nettleser:** utsett bare når nettleseren faktisk rapporterer `connection.type`
 * (f.eks. `cellular`). Mangler API (vanlig på desktop) → ikke blokker, ellers ser ikke web
 * økter som er synket fra telefon.
 *
 * @returns {'offline' | 'metered' | null} null = tillatt
 */
export function getHeavyCloudTrafficDeferralReason() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'offline'
  }
  if (readPhotoUploadAllowOnCellular()) return null

  if (!isCapacitorNativePlatform()) {
    const c = typeof navigator !== 'undefined' ? navigator.connection : null
    if (!c || typeof c.type !== 'string') {
      return null
    }
    try {
      if (c.saveData === true) return 'metered'
    } catch {
      /* ignore */
    }
    if (c.type === 'wifi' || c.type === 'ethernet') return null
    if (c.type === 'cellular' || c.type === 'wimax') return 'metered'
    return null
  }

  if (shouldDeferPhotoUploadOnNetwork()) return 'metered'
  return null
}

/**
 * @param {string} dataUrl
 * @param {{ maxEdge?: number, quality?: number }} [opts]
 * @returns {Promise<string>}
 */
export function makeThumbDataUrlFromDataUrl(dataUrl, opts = {}) {
  const maxEdge = opts.maxEdge ?? 200
  const quality = opts.quality ?? 0.78
  return new Promise((resolve, reject) => {
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
      reject(new Error('invalid data url'))
      return
    }
    const img = new Image()
    img.onload = () => {
      try {
        let w = img.naturalWidth || img.width
        let h = img.naturalHeight || img.height
        if (!w || !h) {
          reject(new Error('image has no dimensions'))
          return
        }
        const scale = Math.min(1, maxEdge / Math.max(w, h))
        w = Math.max(1, Math.round(w * scale))
        h = Math.max(1, Math.round(h * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('no canvas context'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        const out = canvas.toDataURL('image/jpeg', quality)
        if (!out.startsWith('data:image/')) {
          reject(new Error('thumb encode failed'))
          return
        }
        resolve(out)
      } catch (e) {
        reject(e)
      }
    }
    img.onerror = () => reject(new Error('image load failed'))
    img.src = dataUrl
  })
}

/**
 * @param {string} dataUrl
 * @returns {Blob}
 */
function dataUrlToBlob(dataUrl) {
  const m = String(dataUrl).match(/^data:([^;,]+);base64,(.+)$/i)
  if (!m) throw new Error('invalid data url for blob')
  const mime = m[1]
  const b64 = m[2]
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime || 'application/octet-stream' })
}

/**
 * Mobil lagrer ofte bare `storageFullPath` (…/full.jpg) i JSON etter optimalisering;
 * nettleseren trenger `storageThumbPath` for rask henting uten å gjette. Samme mønster
 * som i `tryDrainPhotoUploadQueue` (`full.jpg` / `thumb.jpg`). Ingen endring i filer på disk.
 * @param {unknown} ph
 */
export function ensureStorageThumbPathParallelToFull(ph) {
  if (!ph || typeof ph !== 'object') return ph
  const o = /** @type {Record<string, unknown>} */ (ph)
  const full =
    typeof o.storageFullPath === 'string' ? o.storageFullPath.trim() : ''
  const th =
    typeof o.storageThumbPath === 'string' ? o.storageThumbPath.trim() : ''
  if (!full || th) return ph
  if (/full\.jpg$/i.test(full)) {
    return {
      ...o,
      storageThumbPath: full.replace(/full\.jpg$/i, 'thumb.jpg'),
    }
  }
  return ph
}

/**
 * Eldre synk / payload kan ha bare `storageThumbPath` (…/thumb.jpg). Fullskjerm og annen
 * logikk forventer ofte `storageFullPath`; utled samme katalog + `full.jpg` uten å endre bucket.
 * @param {unknown} ph
 */
export function ensureStorageFullPathParallelToThumb(ph) {
  if (!ph || typeof ph !== 'object') return ph
  const o = /** @type {Record<string, unknown>} */ (ph)
  const th =
    typeof o.storageThumbPath === 'string' ? o.storageThumbPath.trim() : ''
  const full =
    typeof o.storageFullPath === 'string' ? o.storageFullPath.trim() : ''
  if (!th || full) return ph
  if (/thumb\.jpg$/i.test(th)) {
    return {
      ...o,
      storageFullPath: th.replace(/thumb\.jpg$/i, 'full.jpg'),
    }
  }
  return ph
}

/**
 * @param {unknown} ph
 */
function stripDataUrlIfStorage(ph) {
  if (!ph || typeof ph !== 'object') return ph
  const o = /** @type {Record<string, unknown>} */ (ph)
  const path =
    typeof o.storageFullPath === 'string' && o.storageFullPath.trim()
  if (!path) return ph
  const { dataUrl: _drop, ...rest } = o
  return rest
}

/**
 * Fjern full JPEG fra sky-payload når miniatyr finnes: fullfil ligger i IndexedDB
 * og sendes til Storage ved Wi‑Fi (unngår hundrevis av KB mobildata per bilde mot Postgres).
 * @param {unknown} ph
 */
function stripDataUrlIfThumbPresent(ph) {
  const o = stripDataUrlIfStorage(ph)
  if (!o || typeof o !== 'object') return ensureStorageThumbPathParallelToFull(o)
  const rec = /** @type {Record<string, unknown>} */ (o)
  const thumb =
    typeof rec.thumbDataUrl === 'string' &&
    rec.thumbDataUrl.startsWith('data:image/')
  const full =
    typeof rec.dataUrl === 'string' && rec.dataUrl.startsWith('data:image/')
  if (thumb && full) {
    const { dataUrl: _drop, ...rest } = rec
    return ensureStorageThumbPathParallelToFull(rest)
  }
  return ensureStorageThumbPathParallelToFull(o)
}

/**
 * Returnerer en kopi av payload der foto-objekter uten `storageFullPath` beholdes,
 * og poster med `storageFullPath` får fjernet `dataUrl` (spar bandbredde mot Supabase).
 * @param {{
 *   version?: number
 *   sessions?: unknown[]
 *   currentSessionId?: string | null
 *   standalonePhotos?: unknown[]
 *   frictionMeasurements?: unknown[]
 *   frictionActiveSessionId?: string | null
 *   frictionPreviousSessionId?: string | null
 *   followUpRoutes?: unknown[]
 * }} payload
 */
/**
 * Fjerner base64 fra ett foto-objekt før `send_session_share` (unngår 10–100 MB jsonb mot Postgres).
 * Beholder metadata + `storageFullPath` / `storageThumbPath` når de finnes.
 * @param {unknown} ph
 */
export function stripPhotoForSessionShareRpc(ph) {
  const base =
    ph && typeof ph === 'object'
      ? { .../** @type {Record<string, unknown>} */ (ph) }
      : ph
  return stripDataUrlIfThumbPresent(
    ensureStorageThumbPathParallelToFull(
      ensureStorageFullPathParallelToThumb(base),
    ),
  )
}

/**
 * Krever at hvert bilde har `storageFullPath` (sky) — ellers returneres `ok: false`.
 * @param {unknown[]} photos
 * @returns {{ ok: true, photos: object[] } | { ok: false, message: string, missingIds: string[] }}
 */
export function preparePhotosArrayForShareRpc(photos) {
  if (!Array.isArray(photos)) return { ok: true, photos: [] }
  /** @type {string[]} */
  const missing = []
  /** @type {object[]} */
  const out = []
  for (const ph of photos) {
    const s = stripPhotoForSessionShareRpc(ph)
    if (!s || typeof s !== 'object') continue
    const o = /** @type {Record<string, unknown>} */ (s)
    const full =
      typeof o.storageFullPath === 'string' && o.storageFullPath.trim() !== ''
    if (!full) {
      const id = typeof o.id === 'string' ? o.id : ''
      if (id) missing.push(id)
      continue
    }
    const { dataUrl: _d, thumbDataUrl: _t, ...rest } = o
    out.push(rest)
  }
  if (missing.length) {
    return {
      ok: false,
      message: `${missing.length} bilde(r) er ikke ferdig opplastet til sky (mangler lagringssti). Vent på Wi‑Fi/sync, eller slå på «Tillat opplasting på mobilnett» under Innstillinger → Offline, og prøv igjen.`,
      missingIds: missing,
    }
  }
  return { ok: true, photos: out }
}

export function sanitizeUserAppStateForSupabasePayload(payload) {
  const sessions = Array.isArray(payload.sessions)
    ? payload.sessions.map((s) => {
        if (!s || typeof s !== 'object') return s
        const so = /** @type {Record<string, unknown>} */ (s)
        const photos = Array.isArray(so.photos)
          ? so.photos.map(stripDataUrlIfThumbPresent)
          : so.photos
        return { ...so, photos }
      })
    : payload.sessions
  const standalonePhotos = Array.isArray(payload.standalonePhotos)
    ? payload.standalonePhotos.map(stripDataUrlIfThumbPresent)
    : payload.standalonePhotos
  return {
    ...payload,
    sessions,
    standalonePhotos,
  }
}

const MAX_ATTEMPTS = 5

/** Pause mellom to fullførte bilde-leveranser til Storage (demper burst mot Supabase). */
const PHOTO_UPLOAD_GAP_MS = 260

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms)
  })
}

/**
 * Midlertidige feil: ikke hamre umiddelbart igjen — gir DB/helsesjekker luft.
 * @param {unknown} e
 */
function isTransientSupabaseUploadError(e) {
  if (!e || typeof e !== 'object') return false
  const o = /** @type {Record<string, unknown>} */ (e)
  const status = Number(o.statusCode ?? o.status ?? NaN)
  if (
    status === 408 ||
    status === 429 ||
    status === 502 ||
    status === 503 ||
    status === 504
  )
    return true
  const name = typeof o.name === 'string' ? o.name : ''
  if (name === 'AuthRetryableFetchError' || name === 'TimeoutError') return true
  const msg = String(o.message || '')
  if (/timeout|timed out|temporarily|unavailable|503|502|504|429/i.test(msg)) return true
  if (msg === 'Failed to fetch' || msg.includes('Load failed')) return true
  return false
}

/** @type {Promise<void> | null} */
let photoUploadDrainInFlight = null

/**
 * @param {{ userId?: string | null }} [ctx]
 */
export async function tryDrainPhotoUploadQueue(ctx = {}) {
  if (isMinDownloadMode()) return
  const userId = typeof ctx.userId === 'string' ? ctx.userId : ''
  if (!userId) return
  const sb = getSupabase()
  const useCloud = isScanixCloudApiConfigured()
  if (!useCloud && !sb) return

  if (photoUploadDrainInFlight) return photoUploadDrainInFlight

  photoUploadDrainInFlight = (async () => {
    await refreshNativeNetworkStatus()

    let q = readQueue()
    while (q.length > 0) {
      if (shouldDeferPhotoUploadOnNetwork()) break
      const head = q[0]
      if (!head?.photoId) {
        q = q.slice(1)
        writeQueue(q)
        continue
      }
      const photoId = head.photoId
      let fullDataUrl = null
      try {
        fullDataUrl = await getPhotoDataUrl(photoId)
      } catch {
        fullDataUrl = null
      }
      if (
        typeof fullDataUrl !== 'string' ||
        !fullDataUrl.startsWith('data:image/')
      ) {
        console.warn(
          'photoStorageUpload: mangler piksel i IDB for',
          photoId,
          '— fjerner fra kø',
        )
        q = q.filter((x) => x.photoId !== photoId)
        writeQueue(q)
        continue
      }

      const fullPath = `${userId}/photos/${photoId}/full.jpg`
      const thumbPath = `${userId}/photos/${photoId}/thumb.jpg`

      try {
        const fullBlob = dataUrlToBlob(fullDataUrl)

        let thumbBlob
        try {
          const thumbDataUrl = await makeThumbDataUrlFromDataUrl(fullDataUrl, {
            maxEdge: 200,
            quality: 0.78,
          })
          thumbBlob = dataUrlToBlob(thumbDataUrl)
        } catch (e) {
          console.warn('photoStorageUpload thumb', photoId, e)
          thumbBlob = fullBlob
        }

        if (useCloud) {
          await cloudPresignAndPutPhotoPair(
            fullPath,
            thumbPath,
            fullBlob,
            thumbBlob,
          )
        } else {
          const { error: upFull } = await sb.storage
            .from(PHOTO_STORAGE_BUCKET)
            .upload(fullPath, fullBlob, {
              upsert: true,
              contentType: fullBlob.type || 'image/jpeg',
            })
          if (upFull) throw upFull
          const { error: upThumb } = await sb.storage
            .from(PHOTO_STORAGE_BUCKET)
            .upload(thumbPath, thumbBlob, {
              upsert: true,
              contentType: 'image/jpeg',
            })
          if (upThumb) throw upThumb
        }

        q = q.filter((x) => x.photoId !== photoId)
        writeQueue(q)
        try {
          onUploaded?.(photoId, {
            storageFullPath: fullPath,
            storageThumbPath: thumbPath,
          })
        } catch (e) {
          console.warn('photoStorageUpload onUploaded', e)
        }
        await delay(PHOTO_UPLOAD_GAP_MS)
      } catch (e) {
        head.attempts = (head.attempts || 0) + 1
        if (head.attempts >= MAX_ATTEMPTS) {
          console.warn(
            'photoStorageUpload: gir opp etter',
            MAX_ATTEMPTS,
            'forsøk',
            photoId,
            e,
          )
          q = q.filter((x) => x.photoId !== photoId)
        } else {
          q = [...q.slice(1), head]
        }
        writeQueue(q)
        if (isTransientSupabaseUploadError(e) && head.attempts < MAX_ATTEMPTS) {
          const backoffMs = Math.min(
            25_000,
            900 * 2 ** Math.min(head.attempts - 1, 5),
          )
          await delay(backoffMs)
        }
        break
      }
    }
  })()

  try {
    await photoUploadDrainInFlight
  } finally {
    photoUploadDrainInFlight = null
  }
}
