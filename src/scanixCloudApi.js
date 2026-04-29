/**
 * Egen backend (f.eks. Cloudflare Worker + R2) for app-state og bilder.
 * Aktiveres når `VITE_SCANIX_CLOUD_API_BASE_URL` er satt (Vite / build).
 *
 * Forventet API (tilpass på server — dette er kontrakten klienten bruker):
 *
 * **GET /v1/app-state**
 * - 200: JSON med samme toppnivå som `parseUserAppStatePayload` forventer
 *   (`sessions`, `currentSessionId`, `standalonePhotos`, …), eller `{ "payload": { … } }`.
 * - 404: ingen lagret tilstand (ny bruker).
 *
 * **PUT /v1/app-state**
 * - Body: JSON-objekt med app-state (samme som dagens `user_app_state.payload`).
 * - 204 eller 200 uten krav til kropp.
 *
 * **HEAD /v1/app-state** (valgfritt, anbefalt)
 * - 404 = ingen rad → klient kan køe første baseline-upload.
 * - 200 = finnes (kropp ignoreres).
 * - 405 = ikke implementert → klient prøver **GET /v1/app-state/meta** med `{ "exists": boolean }`.
 *
 * **POST /v1/photos/presign-put**
 * - Body: `{ "fullPath": string, "thumbPath": string, "fullContentType"?: string, "thumbContentType"?: string }`
 * - Svar: `{ "fullPutUrl": string, "thumbPutUrl": string }` (presignerte PUT-URL-er til R2).
 *
 * **GET /v1/photos/signed-url?path=…&expires=…**
 * - Svar: `{ "url": string }` (presignert GET for én objektsti, samme logiske sti som i JSON, f.eks. `userId/photos/…/full.jpg`).
 *
 * **Del økt / innboks (tidligere Supabase `session_shares` + RPC):**
 *
 * **GET /v1/session-shares** — liste (lett, uten `session_payload`), samme felt som
 * `list_incoming_session_shares`: `id`, `from_short_id`, `from_display_name`, `created_at`,
 * `photo_count`, `click_count`, `share_kind`. Svar: JSON-array eller `{ "rows": [ … ] }`.
 *
 * **GET /v1/session-shares/:id** — full `session_payload` for «Åpne». Svar:
 * `{ "session_payload": { … } }` eller rett JSON-objekt som *er* payload.
 *
 * **POST /v1/session-shares** — body `{ "recipientShortId": string, "sessionPayload": object }`.
 * Svar: `{ "id": string }` (uuid for raden).
 *
 * **DELETE /v1/session-shares/:id** — fjern mottatt deling (204/200).
 *
 * **Frittstående bilder per vei-mappe (tidligere `fetch_standalone_photos_folder`):**
 *
 * **GET /v1/standalone-photos/folder?folder=FV7752** — JSON-array med foto-objekter (som RPC),
 * eller `{ "photos": [ … ] }`.
 *
 * **Auth:** Enten `VITE_SCANIX_CLOUD_BEARER_TOKEN` (statisk, kun dev/test), eller Supabase
 * `access_token` fra `getSupabase().auth.getSession()` når brukeren er innlogget (API-et bør validere JWT).
 */

import { getSupabase, isSupabaseConfigured } from './supabaseClient.js'

const FETCH_TIMEOUT_MS = 92_000

/**
 * @returns {string}
 */
function baseUrl() {
  const u =
    typeof import.meta.env.VITE_SCANIX_CLOUD_API_BASE_URL === 'string'
      ? import.meta.env.VITE_SCANIX_CLOUD_API_BASE_URL.trim()
      : ''
  return u.replace(/\/$/, '')
}

export function isScanixCloudApiConfigured() {
  return baseUrl().length > 0
}

/**
 * @returns {Promise<Record<string, string>>}
 */
export async function scanixCloudAuthHeaders() {
  const staticTok =
    typeof import.meta.env.VITE_SCANIX_CLOUD_BEARER_TOKEN === 'string'
      ? import.meta.env.VITE_SCANIX_CLOUD_BEARER_TOKEN.trim()
      : ''
  if (staticTok) {
    return { Authorization: `Bearer ${staticTok}` }
  }
  if (isSupabaseConfigured()) {
    const sb = getSupabase()
    if (sb) {
      try {
        const {
          data: { session },
        } = await sb.auth.getSession()
        const t =
          session && typeof session.access_token === 'string'
            ? session.access_token
            : ''
        if (t) return { Authorization: `Bearer ${t}` }
      } catch {
        /* ignore */
      }
    }
  }
  return {}
}

/**
 * @param {string} path e.g. `/v1/app-state`
 * @param {RequestInit} [init]
 */
async function cloudFetch(path, init = {}) {
  const b = baseUrl()
  const p = path.startsWith('/') ? path : `/${path}`
  const url = `${b}${p}`
  const auth = await scanixCloudAuthHeaders()
  const ctrl = new AbortController()
  const t = setTimeout(() => {
    try {
      ctrl.abort(new DOMException('Request timed out', 'TimeoutError'))
    } catch {
      ctrl.abort()
    }
  }, FETCH_TIMEOUT_MS)
  try {
    const headers = {
      Accept: 'application/json',
      ...auth,
      ...(init.headers && typeof init.headers === 'object'
        ? /** @type {Record<string, string>} */ (init.headers)
        : {}),
    }
    return await fetch(url, { ...init, headers, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

/**
 * @param {string} path
 * @param {string} method
 * @param {unknown} [jsonBody]
 */
async function cloudJson(path, method, jsonBody) {
  const r = await cloudFetch(path, {
    method,
    headers:
      jsonBody !== undefined
        ? { 'Content-Type': 'application/json' }
        : undefined,
    body: jsonBody !== undefined ? JSON.stringify(jsonBody) : undefined,
  })
  return r
}

/**
 * @returns {Promise<boolean | null>} false = ingen tilstand, true = finnes, null = ukjent
 */
export async function cloudProbeAppStateExists() {
  try {
    const r = await cloudFetch('/v1/app-state', { method: 'HEAD' })
    if (r.status === 404) return false
    if (r.status === 200) return true
    if (r.status === 405) {
      const r2 = await cloudJson('/v1/app-state/meta', 'GET')
      if (!r2.ok) return null
      const j = await r2.json()
      if (j && typeof j === 'object' && typeof j.exists === 'boolean')
        return j.exists
      return null
    }
    return null
  } catch {
    return null
  }
}

/**
 * @returns {Promise<Record<string, unknown> | null>} rå payload-objekt til parseUserAppStatePayload
 */
export async function cloudFetchAppStateJson() {
  const r = await cloudJson('/v1/app-state', 'GET')
  if (r.status === 404) return null
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`cloud app-state GET ${r.status}: ${t.slice(0, 200)}`)
  }
  const body = await r.json()
  if (!body || typeof body !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (body)
  if (o.payload && typeof o.payload === 'object' && !Array.isArray(o.payload)) {
    return /** @type {Record<string, unknown>} */ (o.payload)
  }
  return o
}

/**
 * @param {Record<string, unknown>} payload
 */
export async function cloudPutAppState(payload) {
  const r = await cloudJson('/v1/app-state', 'PUT', payload)
  if (!r.ok && r.status !== 204) {
    const t = await r.text().catch(() => '')
    throw new Error(`cloud app-state PUT ${r.status}: ${t.slice(0, 200)}`)
  }
}

/**
 * @param {string} fullPath
 * @param {string} thumbPath
 * @param {Blob} fullBlob
 * @param {Blob} thumbBlob
 */
export async function cloudPresignAndPutPhotoPair(
  fullPath,
  thumbPath,
  fullBlob,
  thumbBlob,
) {
  const r = await cloudJson('/v1/photos/presign-put', 'POST', {
    fullPath,
    thumbPath,
    fullContentType: fullBlob.type || 'image/jpeg',
    thumbContentType: thumbBlob.type || 'image/jpeg',
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`cloud presign-put ${r.status}: ${t.slice(0, 200)}`)
  }
  const j = await r.json()
  const fullPutUrl =
    j && typeof j === 'object' && typeof j.fullPutUrl === 'string'
      ? j.fullPutUrl
      : ''
  const thumbPutUrl =
    j && typeof j === 'object' && typeof j.thumbPutUrl === 'string'
      ? j.thumbPutUrl
      : ''
  if (!fullPutUrl || !thumbPutUrl) {
    throw new Error('cloud presign-put: mangler fullPutUrl/thumbPutUrl')
  }
  const put = async (url, blob) => {
    const up = await fetch(url, {
      method: 'PUT',
      headers: { 'Content-Type': blob.type || 'application/octet-stream' },
      body: blob,
    })
    if (!up.ok) {
      const tx = await up.text().catch(() => '')
      throw new Error(`R2 PUT ${up.status}: ${tx.slice(0, 120)}`)
    }
  }
  await put(fullPutUrl, fullBlob)
  await put(thumbPutUrl, thumbBlob)
}

/**
 * @param {string} path storage-sti (f.eks. userId/photos/…/full.jpg)
 * @param {number} [expiresSec]
 * @returns {Promise<string>} signert URL eller tom streng
 */
export async function cloudGetSignedReadUrlForPhotoPath(
  path,
  expiresSec = 3600,
) {
  const p = typeof path === 'string' ? path.trim() : ''
  if (!p) return ''
  try {
    const q = new URLSearchParams({
      path: p,
      expires: String(expiresSec),
    })
    const r = await cloudJson(`/v1/photos/signed-url?${q.toString()}`, 'GET')
    if (!r.ok) return ''
    const j = await r.json()
    return j && typeof j.url === 'string' ? j.url : ''
  } catch {
    return ''
  }
}

/**
 * @returns {Promise<unknown[]>}
 */
export async function cloudListIncomingSessionShares() {
  const r = await cloudJson('/v1/session-shares', 'GET')
  if (r.status === 404) return []
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`cloud session-shares list ${r.status}: ${t.slice(0, 200)}`)
  }
  const body = await r.json()
  if (Array.isArray(body)) return body
  if (body && typeof body === 'object' && Array.isArray(body.rows)) return body.rows
  return []
}

/**
 * @param {string} shareId
 * @returns {Promise<unknown>}
 */
export async function cloudGetSessionSharePayload(shareId) {
  const id = typeof shareId === 'string' ? shareId.trim() : ''
  if (!id) throw new Error('missing share id')
  const r = await cloudJson(
    `/v1/session-shares/${encodeURIComponent(id)}`,
    'GET',
  )
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`cloud session-share GET ${r.status}: ${t.slice(0, 200)}`)
  }
  const data = await r.json()
  if (!data || typeof data !== 'object') return null
  const o = /** @type {Record<string, unknown>} */ (data)
  if (o.session_payload != null) return o.session_payload
  return data
}

/**
 * @param {string} recipientShortId
 * @param {object} sessionPayload
 */
export async function cloudSendSessionShare(recipientShortId, sessionPayload) {
  const r = await cloudJson('/v1/session-shares', 'POST', {
    recipientShortId,
    sessionPayload,
  })
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    throw new Error(`cloud session-shares POST ${r.status}: ${t.slice(0, 200)}`)
  }
  const j = await r.json()
  return j
}

/**
 * @param {string} shareId
 */
export async function cloudDeleteSessionShare(shareId) {
  const id = typeof shareId === 'string' ? shareId.trim() : ''
  if (!id) throw new Error('missing share id')
  const r = await cloudJson(
    `/v1/session-shares/${encodeURIComponent(id)}`,
    'DELETE',
  )
  if (!r.ok && r.status !== 404) {
    const t = await r.text().catch(() => '')
    throw new Error(`cloud session-shares DELETE ${r.status}: ${t.slice(0, 200)}`)
  }
}

/**
 * @param {string} folderKey f.eks. «FV7752»
 * @returns {Promise<unknown[]>}
 */
export async function cloudFetchStandalonePhotosForFolder(folderKey) {
  const folder =
    typeof folderKey === 'string' && folderKey.trim() ? folderKey.trim() : ''
  if (!folder) return []
  const q = new URLSearchParams({ folder })
  const r = await cloudJson(
    `/v1/standalone-photos/folder?${q.toString()}`,
    'GET',
  )
  if (!r.ok) {
    const t = await r.text().catch(() => '')
    console.warn('Scanix cloud standalone folder:', r.status, t.slice(0, 120))
    return []
  }
  const data = await r.json()
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && Array.isArray(data.photos)) return data.photos
  return []
}

/**
 * @returns {Promise<{
 *  quotaBytes: number,
 *  usedBytes: number,
 *  percent: number,
 *  bySource: { r2Bytes: number, supabaseBytes: number },
 *  nearLimit: boolean,
 *  overLimit: boolean,
 *  updatedAt: string | null
 * } | null>}
 */
export async function cloudFetchStorageUsageSummary() {
  try {
    const r = await cloudJson('/v1/storage/usage-summary', 'GET')
    if (!r.ok) return null
    const j = await r.json()
    if (!j || typeof j !== 'object') return null
    const quotaBytes = Number(
      /** @type {{ quotaBytes?: unknown }} */ (j).quotaBytes,
    )
    const usedBytes = Number(
      /** @type {{ usedBytes?: unknown }} */ (j).usedBytes,
    )
    const percent = Number(
      /** @type {{ percent?: unknown }} */ (j).percent,
    )
    const src =
      /** @type {{ bySource?: unknown }} */ (j).bySource &&
      typeof /** @type {{ bySource?: unknown }} */ (j).bySource === 'object'
        ? /** @type {{ r2Bytes?: unknown, supabaseBytes?: unknown }} */ (
            /** @type {{ bySource?: unknown }} */ (j).bySource
          )
        : {}
    const updatedAtRaw = /** @type {{ updatedAt?: unknown }} */ (j).updatedAt
    return {
      quotaBytes: Number.isFinite(quotaBytes) && quotaBytes > 0 ? quotaBytes : 0,
      usedBytes: Number.isFinite(usedBytes) && usedBytes >= 0 ? usedBytes : 0,
      percent: Number.isFinite(percent) ? Math.max(0, Math.min(100, percent)) : 0,
      bySource: {
        r2Bytes:
          Number.isFinite(Number(src.r2Bytes)) && Number(src.r2Bytes) >= 0
            ? Number(src.r2Bytes)
            : 0,
        supabaseBytes:
          Number.isFinite(Number(src.supabaseBytes)) &&
          Number(src.supabaseBytes) >= 0
            ? Number(src.supabaseBytes)
            : 0,
      },
      nearLimit: Boolean(/** @type {{ nearLimit?: unknown }} */ (j).nearLimit),
      overLimit: Boolean(/** @type {{ overLimit?: unknown }} */ (j).overLimit),
      updatedAt: typeof updatedAtRaw === 'string' ? updatedAtRaw : null,
    }
  } catch {
    return null
  }
}
