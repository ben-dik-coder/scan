/**
 * Felles inngang for «delsky» app-state: Scanix Cloud API (R2) når konfigurert,
 * ellers Supabase Postgres/RPC som før.
 */

import { isMinDownloadMode } from './buildFlags.js'
import { getSupabase, isSupabaseConfigured } from './supabaseClient.js'
import {
  cloudFetchAppStateJson,
  cloudPutAppState,
  isScanixCloudApiConfigured,
} from './scanixCloudApi.js'
import {
  fetchUserAppState,
  parseUserAppStatePayload,
  upsertUserAppState,
} from './supabaseSync.js'
import {
  isRegisterNetworkDebugEnabled,
  registerNetLogSupabaseUserAppStateUpsert,
} from './registerNetworkDebug.js'
import { utf8ByteLength } from './registerTraceDebug.js'

export { isScanixCloudApiConfigured } from './scanixCloudApi.js'

export function isRemoteAppStateDataEnabled() {
  return isScanixCloudApiConfigured() || isSupabaseConfigured()
}

/**
 * @param {string} userId
 * @param {{ mode?: 'auto' | 'full' | 'lightOnly' }} [opts]
 */
export async function fetchRemoteUserAppState(userId, opts = {}) {
  if (isMinDownloadMode()) return null
  void userId
  if (isScanixCloudApiConfigured()) {
    void opts
    try {
      const raw = await cloudFetchAppStateJson()
      if (!raw) return null
      return parseUserAppStatePayload(raw)
    } catch (e) {
      console.warn('Scanix cloud fetchUserAppState:', e)
      return null
    }
  }
  const sb = getSupabase()
  if (!sb) return null
  return fetchUserAppState(sb, userId, opts)
}

/**
 * @param {string} userId
 * @param {Parameters<typeof upsertUserAppState>[2]} payload
 */
export async function upsertRemoteUserAppState(userId, payload) {
  if (isMinDownloadMode()) return
  if (isScanixCloudApiConfigured()) {
    void userId
    try {
      if (isRegisterNetworkDebugEnabled()) {
        const rowForSize = {
          user_id: userId,
          payload,
          updated_at: new Date().toISOString(),
        }
        const requestRowUtf8Bytes = utf8ByteLength(JSON.stringify(rowForSize))
        const payloadOnlyUtf8Bytes = utf8ByteLength(JSON.stringify(payload))
        await cloudPutAppState(/** @type {Record<string, unknown>} */ (payload))
        registerNetLogSupabaseUserAppStateUpsert({
          requestRowUtf8Bytes,
          responseUtf8Bytes: 0,
          payloadOnlyUtf8Bytes,
        })
      } else {
        await cloudPutAppState(/** @type {Record<string, unknown>} */ (payload))
      }
    } catch (e) {
      const msg =
        e && typeof e === 'object' && 'message' in e ? String(e.message) : String(e)
      if (!/abort|timeout/i.test(msg)) {
        console.warn('Scanix cloud upsertUserAppState:', msg)
      }
    }
    return
  }
  const sb = getSupabase()
  if (!sb) return
  await upsertUserAppState(sb, userId, payload)
}
