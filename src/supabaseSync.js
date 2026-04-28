/**
 * Supabase: profil + lagring av økter (user_app_state).
 * Brukes bare når VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY er satt.
 */

import { isMinDownloadMode } from './buildFlags.js'
import { normalizeFollowUpRoutesList } from './followUpRoute.js'
import { utf8ByteLength } from './registerTraceDebug.js'
import {
  isRegisterNetworkDebugEnabled,
  registerNetLogSupabaseUserAppStateUpsert,
} from './registerNetworkDebug.js'
import {
  cloudDeleteSessionShare,
  cloudFetchStandalonePhotosForFolder,
  cloudListIncomingSessionShares,
  cloudSendSessionShare,
  isScanixCloudApiConfigured,
} from './scanixCloudApi.js'

const AUTH_NAME_MAX_LEN = 120

/** @param {import('@supabase/supabase-js').SupabaseClient} supabase */
async function pickUnusedShortId(supabase) {
  const { data: rows, error } = await supabase.from('profiles').select('short_id')
  if (error) throw error
  const used = new Set((rows ?? []).map((r) => r.short_id))
  for (let i = 0; i < 800; i++) {
    const n = String(Math.floor(Math.random() * 100000)).padStart(5, '0')
    if (!used.has(n)) return n
  }
  for (let n = 0; n < 100000; n++) {
    const sid = String(n).padStart(5, '0')
    if (!used.has(sid)) return sid
  }
  return String(Date.now() % 100000).padStart(5, '0')
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} displayName
 */
export async function ensureProfile(supabase, userId, displayName) {
  const { data: row, error: selErr } = await supabase
    .from('profiles')
    .select('short_id, display_name')
    .eq('id', userId)
    .maybeSingle()
  if (selErr) throw selErr
  if (row?.short_id) {
    return {
      short_id: row.short_id,
      display_name: row.display_name ?? displayName,
    }
  }
  const shortId = await pickUnusedShortId(supabase)
  const name =
    typeof displayName === 'string' && displayName.trim()
      ? displayName.trim().slice(0, AUTH_NAME_MAX_LEN)
      : 'Bruker'
  const { error: insErr } = await supabase.from('profiles').insert({
    id: userId,
    display_name: name,
    short_id: shortId,
  })
  if (insErr) throw insErr
  return { short_id: shortId, display_name: name }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {import('@supabase/supabase-js').Session} session
 */
export async function buildCurrentUserFromSession(supabase, session) {
  const u = session.user
  const meta = u.user_metadata ?? {}
  const nameFromMeta =
    typeof meta.full_name === 'string' && meta.full_name.trim()
      ? meta.full_name.trim().slice(0, AUTH_NAME_MAX_LEN)
      : ''
  const profile = await ensureProfile(supabase, u.id, nameFromMeta || 'Bruker')
  return {
    id: u.id,
    email: typeof u.email === 'string' ? u.email : '',
    name:
      (typeof profile.display_name === 'string' && profile.display_name.trim()
        ? profile.display_name
        : nameFromMeta) || 'Bruker',
    shortId: profile.short_id,
  }
}

/**
 * @param {Record<string, unknown>} p
 */
export function parseUserAppStatePayload(p) {
  const sessions = Array.isArray(p.sessions) ? p.sessions : []
  const currentSessionId =
    typeof p.currentSessionId === 'string' ? p.currentSessionId : null
  const standalonePhotos = Array.isArray(p.standalonePhotos)
    ? p.standalonePhotos
    : []
  const frictionMeasurements = Array.isArray(p.frictionMeasurements)
    ? p.frictionMeasurements
    : []
  const frictionActiveSessionId =
    typeof p.frictionActiveSessionId === 'string'
      ? p.frictionActiveSessionId
      : null
  const frictionPreviousSessionId =
    typeof p.frictionPreviousSessionId === 'string'
      ? p.frictionPreviousSessionId
      : null
  const followUpRoutes = normalizeFollowUpRoutesList(p.followUpRoutes)
  return {
    sessions,
    currentSessionId,
    standalonePhotos,
    frictionMeasurements,
    frictionActiveSessionId,
    frictionPreviousSessionId,
    followUpRoutes,
  }
}

/** @param {unknown} err */
function isAbortOrTimeoutLike(err) {
  if (!err || typeof err !== 'object') return false
  const o = /** @type {{ name?: string; message?: unknown }} */ (err)
  const name = typeof o.name === 'string' ? o.name : ''
  const msg = typeof o.message === 'string' ? o.message : ''
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    /AbortError|TimeoutError|timed out|Request timed out/i.test(msg)
  )
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ mode?: 'auto' | 'full' | 'lightOnly' }} [opts]
 *   `auto`: prøv RPC uten bildedata (spar trafikk), fall tilbake til full payload.
 *   `full`: alltid hent full `payload` (tungt — brukes når økt trenger piksel).
 *   `lightOnly`: kun lett RPC, null hvis den feiler.
 * @returns {Promise<{ sessions: unknown[], currentSessionId: string | null, standalonePhotos?: unknown[], frictionMeasurements?: unknown[], frictionActiveSessionId?: string | null, frictionPreviousSessionId?: string | null, followUpRoutes?: unknown[] } | null>}
 */
export async function fetchUserAppState(supabase, userId, opts = {}) {
  if (isMinDownloadMode()) return null
  const mode = opts.mode ?? 'auto'

  if (mode !== 'full') {
    const { data: light, error: lightErr } = await supabase.rpc(
      'fetch_user_app_state_light',
      { p_user_id: userId },
    )
    if (
      !lightErr &&
      light != null &&
      typeof light === 'object' &&
      !Array.isArray(light)
    ) {
      return parseUserAppStatePayload(/** @type {Record<string, unknown>} */ (light))
    }
    if (lightErr) {
      const skipWarn =
        mode === 'auto' && isAbortOrTimeoutLike(lightErr)
      if (!skipWarn) {
        console.warn(
          'Supabase fetch_user_app_state_light:',
          lightErr.message,
          '— prøver full select fra user_app_state.',
        )
      }
    } else if (light == null) {
      console.warn(
        'Supabase fetch_user_app_state_light: tomt svar — prøver full select fra user_app_state.',
      )
    }
    if (mode === 'lightOnly') return null
  }

  const { data, error } = await supabase
    .from('user_app_state')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('Supabase fetchUserAppState:', error.message)
    return null
  }
  if (!data?.payload || typeof data.payload !== 'object') {
    console.warn(
      'Supabase fetchUserAppState: ingen payload-rad (ny bruker eller aldri vellykket opplasting til user_app_state).',
    )
    return null
  }
  return parseUserAppStatePayload(
    /** @type {Record<string, unknown>} */ (data.payload),
  )
}

/**
 * Henter **kun** standalone-bilder for én vei-mappe (med dataUrl) fra sky.
 * Kall når bruker åpner bilde-mappen i meny — ikke ved app-start.
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} folderKey f.eks. «FV7752»
 */
export async function fetchStandalonePhotosForFolder(
  supabase,
  userId,
  folderKey,
) {
  const folder =
    typeof folderKey === 'string' && folderKey.trim() ? folderKey.trim() : ''
  if (!folder) return []
  if (isScanixCloudApiConfigured()) {
    void supabase
    void userId
    return cloudFetchStandalonePhotosForFolder(folder)
  }
  const { data, error } = await supabase.rpc(
    'fetch_standalone_photos_folder',
    { p_user_id: userId, p_folder: folder },
  )
  if (error) {
    console.warn('Supabase fetchStandalonePhotosForFolder:', error.message)
    return []
  }
  if (data == null) return []
  if (Array.isArray(data)) return data
  if (typeof data === 'string') {
    try {
      const j = JSON.parse(data)
      if (Array.isArray(j)) return j
    } catch {
      return []
    }
  }
  return []
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ version: number, sessions: unknown[], currentSessionId: string | null, standalonePhotos?: unknown[], frictionMeasurements?: unknown[], frictionActiveSessionId?: string | null, frictionPreviousSessionId?: string | null, followUpRoutes?: unknown[] }} payload
 */
export async function upsertUserAppState(supabase, userId, payload) {
  if (isMinDownloadMode()) return
  const rowForSize = {
    user_id: userId,
    payload,
    updated_at: new Date().toISOString(),
  }
  const rpc = () =>
    supabase.rpc('upsert_user_app_state', { p_payload: payload })
  if (isRegisterNetworkDebugEnabled()) {
    const requestRowUtf8Bytes = utf8ByteLength(JSON.stringify(rowForSize))
    const payloadOnlyUtf8Bytes = utf8ByteLength(JSON.stringify(payload))
    const { error } = await rpc()
    if (error) {
      const msg = typeof error.message === 'string' ? error.message : ''
      if (error.name === 'AbortError' || /abort/i.test(msg)) return
      console.warn('Supabase upsertUserAppState:', msg || String(error))
      return
    }
    registerNetLogSupabaseUserAppStateUpsert({
      requestRowUtf8Bytes,
      responseUtf8Bytes: 0,
      payloadOnlyUtf8Bytes,
    })
    return
  }
  const { error } = await rpc()
  if (error) {
    const msg = typeof error.message === 'string' ? error.message : ''
    if (error.name === 'AbortError' || /abort/i.test(msg)) return
    console.warn('Supabase upsertUserAppState:', msg || String(error))
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} recipientShortId
 * @param {object} sessionPayload
 */
export async function sendSessionShare(supabase, recipientShortId, sessionPayload) {
  if (isScanixCloudApiConfigured()) {
    void supabase
    return cloudSendSessionShare(recipientShortId, sessionPayload)
  }
  const { data, error } = await supabase.rpc('send_session_share', {
    p_recipient_short_id: recipientShortId,
    p_session_payload: sessionPayload,
  })
  if (error) throw error
  return data
}

/**
 * Henter innboksliste. Bruker RPC uten full `session_payload` (unngår MB base64 over nett).
 * Full payload lastes ved «Åpne» (`openIncomingSharePreview`).
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function fetchIncomingSessionShares(supabase, userId) {
  if (isScanixCloudApiConfigured()) {
    void supabase
    void userId
    try {
      return await cloudListIncomingSessionShares()
    } catch (e) {
      const msg = e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e)
      console.warn('Scanix cloud list session-shares:', msg)
      return []
    }
  }
  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    'list_incoming_session_shares',
  )
  if (rpcError) {
    const rmsg = typeof rpcError.message === 'string' ? rpcError.message : ''
    if (
      rpcError.name !== 'AbortError' &&
      !/abort/i.test(rmsg)
    ) {
      console.warn(
        'Supabase list_incoming_session_shares:',
        rmsg || String(rpcError),
      )
    }
  }
  if (!rpcError && Array.isArray(rpcRows)) {
    return rpcRows
  }
  const { data, error } = await supabase
    .from('session_shares')
    .select(
      'id, from_short_id, from_display_name, created_at, session_payload',
    )
    .eq('to_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(40)
  if (error) {
    const msg = typeof error.message === 'string' ? error.message : ''
    if (error.name !== 'AbortError' && !/abort/i.test(msg)) {
      console.warn('Supabase fetchIncomingSessionShares:', msg || String(error))
    }
    return []
  }
  return Array.isArray(data) ? data : []
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} shareId
 */
export async function deleteSessionShareRow(supabase, shareId) {
  if (isScanixCloudApiConfigured()) {
    void supabase
    await cloudDeleteSessionShare(shareId)
    return
  }
  const { error } = await supabase
    .from('session_shares')
    .delete()
    .eq('id', shareId)
  if (error) throw error
}
