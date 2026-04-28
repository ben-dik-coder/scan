/**
 * Registrerings-spor (?regtrace=1 / innstilling).
 */

/** @param {string} s */
export function utf8ByteLength(s) {
  if (typeof s !== 'string') return 0
  try {
    return new TextEncoder().encode(s).length
  } catch {
    return s.length
  }
}

const LS_PERSIST = 'scanix-register-trace-debug-persist'
const LS_REASON = 'scanix-register-trace-persist-reason'

/** @returns {boolean} */
export function isRegisterTraceDebugEnabled() {
  try {
    if (typeof window !== 'undefined' && window.location?.search) {
      if (new URLSearchParams(window.location.search).has('regtrace'))
        return true
    }
  } catch {
    /* ignore */
  }
  return isRegisterTraceDebugPersisted()
}

/** @returns {boolean} */
export function isRegisterTraceDebugPersisted() {
  try {
    if (typeof localStorage === 'undefined') return false
    return localStorage.getItem(LS_PERSIST) === '1'
  } catch {
    return false
  }
}

/** @param {boolean} on */
export function setRegisterTraceDebugPersisted(on) {
  try {
    if (typeof localStorage === 'undefined') return
    if (on) localStorage.setItem(LS_PERSIST, '1')
    else localStorage.removeItem(LS_PERSIST)
  } catch {
    /* ignore */
  }
}

/** @param {string} reason */
export function setRegtracePersistReason(reason) {
  try {
    if (typeof localStorage === 'undefined') return
    if (typeof reason === 'string' && reason)
      localStorage.setItem(LS_REASON, reason.slice(0, 200))
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} json
 * @param {unknown} payload
 */
export function regtraceLocalStorageWrite(json, payload) {
  if (!isRegisterTraceDebugEnabled()) return
  try {
    console.info('[Scanix regtrace] localStorage', json?.length ?? 0, payload)
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} note
 * @param {{ clicks?: number, photos?: number }} meta
 */
export function regtraceRebuildMarkers(note, meta) {
  if (!isRegisterTraceDebugEnabled()) return
  try {
    console.info('[Scanix regtrace] rebuildMarkers', note, meta)
  } catch {
    /* ignore */
  }
}

/**
 * @param {string} reason
 * @param {unknown} sess
 */
export function regtraceSessionAfterPersistFlush(reason, sess) {
  if (!isRegisterTraceDebugEnabled()) return
  try {
    console.info('[Scanix regtrace] persist', reason, sess?.id ?? sess)
  } catch {
    /* ignore */
  }
}
