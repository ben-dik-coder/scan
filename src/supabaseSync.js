/**
 * Supabase: profil + lagring av økter (user_app_state).
 * Brukes bare når VITE_SUPABASE_URL og VITE_SUPABASE_ANON_KEY er satt.
 */

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
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @returns {Promise<{ sessions: unknown[], currentSessionId: string | null, standalonePhotos?: unknown[], frictionMeasurements?: unknown[] } | null>}
 */
export async function fetchUserAppState(supabase, userId) {
  const { data, error } = await supabase
    .from('user_app_state')
    .select('payload')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) {
    console.warn('Supabase fetchUserAppState:', error.message)
    return null
  }
  if (!data?.payload || typeof data.payload !== 'object') return null
  const p = data.payload
  const sessions = Array.isArray(p.sessions) ? p.sessions : []
  const currentSessionId =
    typeof p.currentSessionId === 'string' ? p.currentSessionId : null
  const standalonePhotos = Array.isArray(p.standalonePhotos)
    ? p.standalonePhotos
    : []
  const frictionMeasurements = Array.isArray(p.frictionMeasurements)
    ? p.frictionMeasurements
    : []
  return { sessions, currentSessionId, standalonePhotos, frictionMeasurements }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {{ version: number, sessions: unknown[], currentSessionId: string | null, standalonePhotos?: unknown[], frictionMeasurements?: unknown[] }} payload
 */
export async function upsertUserAppState(supabase, userId, payload) {
  const row = {
    user_id: userId,
    payload,
    updated_at: new Date().toISOString(),
  }
  const { error } = await supabase.from('user_app_state').upsert(row, {
    onConflict: 'user_id',
  })
  if (error) {
    console.warn('Supabase upsertUserAppState:', error.message)
  }
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} recipientShortId
 * @param {object} sessionPayload
 */
export async function sendSessionShare(supabase, recipientShortId, sessionPayload) {
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
  const { data: rpcRows, error: rpcError } = await supabase.rpc(
    'list_incoming_session_shares',
  )
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
    console.warn('Supabase fetchIncomingSessionShares:', error.message)
    return []
  }
  return Array.isArray(data) ? data : []
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} shareId
 */
export async function deleteSessionShareRow(supabase, shareId) {
  const { error } = await supabase
    .from('session_shares')
    .delete()
    .eq('id', shareId)
  if (error) throw error
}
