/**
 * Nettverks-/sky-debug for registrering og Supabase (konsoll).
 */

const LS_NET = 'scanix-register-network-debug-persist'

/** @returns {boolean} */
export function isRegisterNetworkDebugPersisted() {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(LS_NET) === '1'
  } catch {
    return false
  }
}

/** @returns {boolean} */
export function isRegisterNetworkDebugEnabled() {
  try {
    if (typeof window !== 'undefined' && window.location?.search) {
      if (new URLSearchParams(window.location.search).has('regnet'))
        return true
    }
  } catch {
    /* ignore */
  }
  return isRegisterNetworkDebugPersisted()
}

/** @param {boolean} on */
export function setRegisterNetworkDebugPersisted(on) {
  try {
    if (typeof localStorage === 'undefined') return
    if (on) localStorage.setItem(LS_NET, '1')
    else localStorage.removeItem(LS_NET)
  } catch {
    /* ignore */
  }
}

function log(kind, a, b) {
  if (!isRegisterNetworkDebugEnabled()) return
  try {
    console.info('[Scanix regnet]', kind, a, b)
  } catch {
    /* ignore */
  }
}

/** @param {string | null} id */
export function registerNetSetActiveVegrefClickId(id) {
  log('vegref_click', id, null)
}

/**
 * @param {string} clickId
 * @param {unknown} row
 */
export function registerNetLogVegrefEnrich(clickId, row) {
  log('vegref_enrich', clickId, row)
}

/** @param {string} reason */
export function registerNetLogSupabasePushSkipped(reason, extra) {
  log('supabase_skip', reason, extra)
}

/**
 * @param {string} id
 * @param {unknown} meta
 */
export function registerNetLogRegisterTap(id, meta) {
  log('register_tap', id, meta)
}

/**
 * @param {{ requestRowUtf8Bytes: number, responseUtf8Bytes: number, payloadOnlyUtf8Bytes: number }} row
 */
export function registerNetLogSupabaseUserAppStateUpsert(row) {
  log('user_app_state_upsert', row, null)
}

/**
 * @param {string} urlStr
 * @param {unknown} r
 */
export async function registerNetMaybeLogNvdbPosisjon(urlStr, r) {
  if (!isRegisterNetworkDebugEnabled()) return
  log('nvdb_posisjon', urlStr?.slice?.(0, 120), r)
}
